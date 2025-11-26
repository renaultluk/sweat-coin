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
    uint256 public rewardCooldown = 1 hours;
    
    // Events
    event HealthDataValidated(address indexed user, string activityType, uint256 value);
    event RewardIssued(address indexed user, uint256 amount, string reason);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    
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
        require(user != address(0), "Invalid user address");
        require(
            block.timestamp >= lastRewardTime[user] + rewardCooldown,
            "Reward cooldown not met"
        );
        
        uint256 totalReward = 0;
        
        // Calculate rewards based on activity
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
        
        // Mint tokens to the user using the interface
        if (totalReward > 0) {
            sweatCoin.mint(user, totalReward);  // ← Interface call!
            lastRewardTime[user] = block.timestamp;
            emit RewardIssued(user, totalReward, "Daily health activities");
        }
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
}
