// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ISweatCoin.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title HealthRewardsEngine
 * @dev Validates health data and rewards users with SweatCoin
 * Uses ISweatCoin interface to interact with the token contract
 */
contract HealthRewardsEngine is Ownable {
    // Reference to SweatCoin token using INTERFACE (not full contract)
    ISweatCoin public sweatCoin;

    IERC20 public sweatCoinERC20;
    
    // Trusted oracle that provides health data
    address public trustedOracle;
    
    // Reward rates (tokens per activity)
    uint256 public stepsRewardRate = 1 * 10**18; // 1 SWEAT per 1000 steps
    uint256 public sleepRewardRate = 5 * 10**18; // 5 SWEAT per good sleep night
    uint256 public exerciseRewardRate = 10 * 10**18; // 10 SWEAT per workout
    
    // Track last reward time to prevent spam
    mapping(address => uint256) public lastRewardTime;
    uint256 public rewardCooldown = 0;
    
    // Reference to DataMarketplace for integration
    address public dataMarketplace;
    
    /**
     * @dev Structure for storing anonymized health data entries
     * Note: No user addresses stored - privacy compliant
     */
    struct HealthDataEntry {
        uint256 timestamp;          // When data was recorded
        uint256 steps;              // Steps taken
        uint256 sleepHours;         // Sleep hours (in minutes)
        uint256 exerciseMinutes;    // Exercise minutes
        bool isValid;               // Whether entry is valid
    }
    
    // Mapping from day (timestamp / 86400) to aggregated daily stats
    struct DailyAggregate {
        uint256 date;               // Day timestamp (timestamp / 86400)
        uint256 totalSteps;         // Sum of all steps
        uint256 totalSleepHours;    // Sum of all sleep hours (in minutes)
        uint256 totalExerciseMinutes; // Sum of all exercise minutes
        uint256 entryCount;         // Number of entries
        bool exists;                // Whether this day has data
    }
    
    // Mapping from day (timestamp / 86400) to DailyAggregate
    mapping(uint256 => DailyAggregate) public dailyAggregates;
    
    // Array of all days that have data (for iteration)
    uint256[] private daysWithData;
    
    // Events
    event HealthDataValidated(address indexed user, string activityType, uint256 value);
    event RewardIssued(address indexed user, uint256 amount, string reason);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event HealthDataSubmitted(
        address indexed user,
        uint256 steps,
        bool goodSleep,
        uint256 exerciseMinutes,
        bool verifiedByOracle
    );
    event DataMarketplaceUpdated(address indexed oldMarketplace, address indexed newMarketplace);
    event HealthDataAggregated(uint256 indexed day, uint256 steps, uint256 sleepHours, uint256 exerciseMinutes, uint256 entryCount);
    
    constructor(address _sweatCoinAddress, address _oracleAddress) Ownable(msg.sender) {
        // Store the token contract address as an interface
        sweatCoin = ISweatCoin(_sweatCoinAddress);
        sweatCoinERC20 = IERC20(_sweatCoinAddress);
        trustedOracle = _oracleAddress;
    }
    
    /**
     * @dev Modifier to ensure only the oracle can submit health data
     */
    modifier onlyOracle() {
        require(msg.sender == trustedOracle, "Only oracle can submit data");
        _;
    }
    
    /**
     * @dev Oracle submits validated health data and triggers rewards
     * @param user Address of the user who generated the health data
     * @param steps Number of steps taken (already validated by oracle)
     * @param goodSleep Whether user had quality sleep (validated by oracle)
     * @param exerciseMinutes Minutes of exercise (validated by oracle)
     */
    function submitHealthData(
        address user,
        uint256 steps,
        bool goodSleep,
        uint256 exerciseMinutes
    ) external onlyOracle {
        _processHealthData(user, steps, goodSleep, exerciseMinutes, true);
    }

    /**
     * @dev Users can self-report their health data directly on-chain
     * @param steps Number of steps taken
     * @param goodSleep Whether they had quality sleep
     * @param exerciseMinutes Minutes of exercise performed
     *
     * NOTE: This path does not require the trusted oracle. Use in test/demo environments
     * or when user-reported data is acceptable. Cooldowns and reward rules still apply.
     */
    function submitSelfReportedData(
        uint256 steps,
        bool goodSleep,
        uint256 exerciseMinutes
    ) external {
        _processHealthData(msg.sender, steps, goodSleep, exerciseMinutes, false);
    }
    
    /**
     * @dev Internal function to aggregate health data by day
     * @param timestamp When the data was recorded
     * @param steps Number of steps
     * @param sleepHours Sleep hours in minutes (0 if no good sleep)
     * @param exerciseMinutes Exercise minutes
     */
    function _aggregateHealthData(
        uint256 timestamp,
        uint256 steps,
        uint256 sleepHours,
        uint256 exerciseMinutes
    ) internal {
        // Calculate day (timestamp / 86400 seconds per day)
        uint256 day = timestamp / 86400;
        
        DailyAggregate storage aggregate = dailyAggregates[day];
        
        if (!aggregate.exists) {
            // First entry for this day
            aggregate.date = day;
            aggregate.totalSteps = steps;
            aggregate.totalSleepHours = sleepHours;
            aggregate.totalExerciseMinutes = exerciseMinutes;
            aggregate.entryCount = 1;
            aggregate.exists = true;
            daysWithData.push(day);
        } else {
            // Add to existing aggregate
            aggregate.totalSteps += steps;
            aggregate.totalSleepHours += sleepHours;
            aggregate.totalExerciseMinutes += exerciseMinutes;
            aggregate.entryCount++;
        }
        
        emit HealthDataAggregated(day, steps, sleepHours, exerciseMinutes, aggregate.entryCount);
    }
    
    /**
     * @dev Update the oracle address (only owner)
     * @param newOracle Address of the new oracle
     */
    function updateOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle address");
        address oldOracle = trustedOracle;
        trustedOracle = newOracle;
        emit OracleUpdated(oldOracle, newOracle);
    }
    
    /**
     * @dev Update reward rates (only owner)
     */
    function updateRewardRates(
        uint256 _stepsRate,
        uint256 _sleepRate,
        uint256 _exerciseRate
    ) external onlyOwner {
        stepsRewardRate = _stepsRate;
        sleepRewardRate = _sleepRate;
        exerciseRewardRate = _exerciseRate;
    }
    
    /**
     * @dev Get user's current token balance (reads from token contract via interface)
     * @param user Address to check
     */
    function getUserBalance(address user) external view returns (uint256) {
        return sweatCoinERC20.balanceOf(user);  // ← Interface call!
    }

    /**
     * @dev Internal helper that handles validation, reward calculation, minting and aggregation
     */
    function _processHealthData(
        address user,
        uint256 steps,
        bool goodSleep,
        uint256 exerciseMinutes,
        bool verifiedByOracle
    ) internal {
        require(user != address(0), "Invalid user address");
        require(
            block.timestamp >= lastRewardTime[user] + rewardCooldown,
            "Reward cooldown not met"
        );

        uint256 totalReward = 0;

        if (steps >= 1000) {
            uint256 stepReward = (steps / 1000) * stepsRewardRate;
            totalReward += stepReward;
            emit HealthDataValidated(user, "steps", steps);
        }

        if (goodSleep) {
            totalReward += sleepRewardRate;
            emit HealthDataValidated(user, "sleep", 1);
        }

        if (exerciseMinutes >= 30) {
            uint256 exerciseReward = (exerciseMinutes / 30) * exerciseRewardRate;
            totalReward += exerciseReward;
            emit HealthDataValidated(user, "exercise", exerciseMinutes);
        }

        if (totalReward > 0) {
            sweatCoin.mint(user, totalReward);
            lastRewardTime[user] = block.timestamp;
            emit RewardIssued(user, totalReward, "Daily health activities");
            emit HealthDataSubmitted(user, steps, goodSleep, exerciseMinutes, verifiedByOracle);

            // Aggregate health data for marketplace (anonymized - no user address)
            uint256 sleepMinutes = goodSleep ? 420 : 0; // 7 hours in minutes if good sleep
            _aggregateHealthData(block.timestamp, steps, sleepMinutes, exerciseMinutes);
        } else {
            revert("No rewards earned");
        }
    }
    
    /**
     * @dev Set DataMarketplace address (only owner)
     * @param _dataMarketplace Address of the DataMarketplace contract
     */
    function setDataMarketplace(address _dataMarketplace) external onlyOwner {
        address oldMarketplace = dataMarketplace;
        dataMarketplace = _dataMarketplace;
        emit DataMarketplaceUpdated(oldMarketplace, _dataMarketplace);
    }
    
    /**
     * @dev Get aggregated health data for a specific day
     * @param day Day timestamp (timestamp / 86400)
     * @return aggregate DailyAggregate struct for that day
     */
    function getDailyAggregate(uint256 day) external view returns (DailyAggregate memory) {
        return dailyAggregates[day];
    }
    
    /**
     * @dev Get aggregated health data for a date range
     * @param startDay Start day (timestamp / 86400)
     * @param endDay End day (timestamp / 86400)
     * @return totalSteps Sum of all steps in range
     * @return totalSleepHours Sum of all sleep hours in range (in minutes)
     * @return totalExerciseMinutes Sum of all exercise minutes in range
     * @return totalEntries Total number of entries in range
     * @return uniqueDays Number of unique days with data
     */
    function getAggregatedDataForRange(uint256 startDay, uint256 endDay)
        external
        view
        returns (
            uint256 totalSteps,
            uint256 totalSleepHours,
            uint256 totalExerciseMinutes,
            uint256 totalEntries,
            uint256 uniqueDays
        )
    {
        require(startDay <= endDay, "Invalid date range");
        
        for (uint256 day = startDay; day <= endDay; day++) {
            DailyAggregate memory aggregate = dailyAggregates[day];
            if (aggregate.exists) {
                totalSteps += aggregate.totalSteps;
                totalSleepHours += aggregate.totalSleepHours;
                totalExerciseMinutes += aggregate.totalExerciseMinutes;
                totalEntries += aggregate.entryCount;
                uniqueDays++;
            }
        }
    }
    
    /**
     * @dev Get average health metrics for a date range
     * @param startDay Start day (timestamp / 86400)
     * @param endDay End day (timestamp / 86400)
     * @return avgSteps Average steps per entry
     * @return avgSleepHours Average sleep hours per entry (in minutes)
     * @return avgExerciseMinutes Average exercise minutes per entry
     * @return entryCount Total number of entries
     */
    function getAverageMetricsForRange(uint256 startDay, uint256 endDay)
        external
        view
        returns (
            uint256 avgSteps,
            uint256 avgSleepHours,
            uint256 avgExerciseMinutes,
            uint256 entryCount
        )
    {
        require(startDay <= endDay, "Invalid date range");
        
        uint256 totalSteps;
        uint256 totalSleepHours;
        uint256 totalExerciseMinutes;
        
        for (uint256 day = startDay; day <= endDay; day++) {
            DailyAggregate memory aggregate = dailyAggregates[day];
            if (aggregate.exists) {
                totalSteps += aggregate.totalSteps;
                totalSleepHours += aggregate.totalSleepHours;
                totalExerciseMinutes += aggregate.totalExerciseMinutes;
                entryCount += aggregate.entryCount;
            }
        }
        
        if (entryCount > 0) {
            avgSteps = totalSteps / entryCount;
            avgSleepHours = totalSleepHours / entryCount;
            avgExerciseMinutes = totalExerciseMinutes / entryCount;
        }
    }
    
    /**
     * @dev Get count of unique days with data in a range
     * @param startDay Start day (timestamp / 86400)
     * @param endDay End day (timestamp / 86400)
     * @return count Number of days with data
     */
    function getDaysWithDataCount(uint256 startDay, uint256 endDay) external view returns (uint256 count) {
        require(startDay <= endDay, "Invalid date range");
        
        for (uint256 day = startDay; day <= endDay; day++) {
            if (dailyAggregates[day].exists) {
                count++;
            }
        }
    }
}
