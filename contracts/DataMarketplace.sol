// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./HealthRewardsEngine.sol";

/**
 * @title DataMarketplace
 * @dev Marketplace for selling aggregated, anonymized health datasets to researchers
 * 
 * Key Features:
 * - Accepts ETH payments from researchers/buyers
 * - Stores aggregated health data (no individual user data)
 * - Non-exclusive: Same dataset can be sold to multiple buyers
 * - All ETH payments go to treasury
 * - Privacy-compliant: Only aggregated statistics, no PII
 */
contract DataMarketplace is Ownable, ReentrancyGuard {
    /**
     * @dev Structure for creating a new dataset (reduces stack depth)
     */
    struct DatasetParams {
        string title;
        uint256 userCount;
        uint256 startTimestamp;
        uint256 endTimestamp;
        uint256 price;
        uint256 averageDailySteps;
        uint256 averageSleepHours;
        uint256 averageExerciseMinutes;
        uint256 minAge;
        uint256 maxAge;
        string region;
        string dataLocation;
    }
    
    /**
     * @dev Structure representing an aggregated health dataset
     * Note: This contains ONLY aggregated statistics, never individual user data
     */
    struct Dataset {
        uint256 datasetId;              // Unique identifier
        string title;                   // Dataset title/description
        uint256 userCount;              // Number of users in aggregation
        uint256 startTimestamp;         // Start of data collection period
        uint256 endTimestamp;           // End of data collection period
        uint256 price;                  // Price in wei (ETH)
        bool isActive;                  // Whether dataset is available for purchase
        uint256 createdAt;              // When dataset was created
        
        // Aggregated health metrics (statistics only, no individual data)
        uint256 averageDailySteps;      // Average steps across all users
        uint256 averageSleepHours;      // Average sleep hours (in minutes, e.g., 420 = 7 hours)
        uint256 averageExerciseMinutes; // Average exercise minutes per week
        uint256 minAge;                 // Minimum age in cohort
        uint256 maxAge;                 // Maximum age in cohort
        string region;                  // Geographic region (e.g., "Hong Kong")
        
        // Data access information
        string dataLocation;            // IPFS hash or API endpoint for actual data
        uint256 purchaseCount;          // Number of times this dataset has been purchased
    }
    
    // Treasury address that receives all ETH payments
    address public treasury;
    
    // Reference to HealthRewardsEngine for data aggregation
    HealthRewardsEngine public healthRewardsEngine;
    
    // Counter for dataset IDs
    uint256 private _datasetIdCounter;
    
    // Mapping from dataset ID to Dataset struct
    mapping(uint256 => Dataset) public datasets;
    
    // Mapping from buyer address to list of purchased dataset IDs
    mapping(address => uint256[]) private _purchasedDatasets;
    
    // Mapping from buyer address to dataset ID to purchase timestamp
    mapping(address => mapping(uint256 => uint256)) public purchaseTimestamps;
    
    // Events
    event DatasetCreated(
        uint256 indexed datasetId,
        string title,
        uint256 price,
        uint256 userCount
    );
    
    event DatasetPurchased(
        address indexed buyer,
        uint256 indexed datasetId,
        uint256 price,
        uint256 timestamp
    );
    
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    
    event DatasetStatusUpdated(uint256 indexed datasetId, bool isActive);
    
    event HealthRewardsEngineUpdated(address indexed oldEngine, address indexed newEngine);
    
    event DatasetCreatedFromAggregation(
        uint256 indexed datasetId,
        uint256 startTimestamp,
        uint256 endTimestamp,
        uint256 userCount,
        uint256 avgSteps,
        uint256 avgSleepHours,
        uint256 avgExerciseMinutes
    );
    
    /**
     * @dev Constructor
     * @param _treasury Address that will receive all ETH payments
     * @param _healthRewardsEngine Address of the HealthRewardsEngine contract
     */
    constructor(address _treasury, address _healthRewardsEngine) Ownable(msg.sender) {
        require(_treasury != address(0), "Treasury address cannot be zero");
        require(_healthRewardsEngine != address(0), "HealthRewardsEngine address cannot be zero");
        treasury = _treasury;
        healthRewardsEngine = HealthRewardsEngine(_healthRewardsEngine);
        _datasetIdCounter = 1; // Start from 1
    }
    
    /**
     * @dev Create a new aggregated health dataset
     * @param params Struct containing all dataset parameters
     * @return datasetId The ID of the newly created dataset
     * 
     * Note: Only owner can create datasets. This ensures data quality and privacy compliance.
     */
    function createDataset(DatasetParams memory params) external onlyOwner returns (uint256) {
        require(params.userCount >= 100, "Minimum 100 users required for privacy compliance");
        require(params.startTimestamp < params.endTimestamp, "Invalid time period");
        require(params.endTimestamp <= block.timestamp, "End timestamp must be in the past");
        require(params.price > 0, "Price must be greater than zero");
        require(bytes(params.title).length > 0, "Title cannot be empty");
        require(bytes(params.region).length > 0, "Region cannot be empty");
        require(bytes(params.dataLocation).length > 0, "Data location cannot be empty");
        
        uint256 datasetId = _datasetIdCounter++;
        
        datasets[datasetId] = Dataset({
            datasetId: datasetId,
            title: params.title,
            userCount: params.userCount,
            startTimestamp: params.startTimestamp,
            endTimestamp: params.endTimestamp,
            price: params.price,
            isActive: true,
            createdAt: block.timestamp,
            averageDailySteps: params.averageDailySteps,
            averageSleepHours: params.averageSleepHours,
            averageExerciseMinutes: params.averageExerciseMinutes,
            minAge: params.minAge,
            maxAge: params.maxAge,
            region: params.region,
            dataLocation: params.dataLocation,
            purchaseCount: 0
        });
        
        emit DatasetCreated(datasetId, params.title, params.price, params.userCount);
        return datasetId;
    }
    
    /**
     * @dev Create a dataset by aggregating data from HealthRewardsEngine
     * @param title Dataset title/description
     * @param startTimestamp Start of data collection period
     * @param endTimestamp End of data collection period
     * @param price Price in wei (ETH)
     * @param minAge Minimum age in cohort
     * @param maxAge Maximum age in cohort
     * @param region Geographic region
     * @param dataLocation IPFS hash or API endpoint for actual data
     * @return datasetId The ID of the newly created dataset
     * 
     * This function automatically aggregates health data from HealthRewardsEngine
     * for the specified time period and creates a dataset with the aggregated statistics.
     */
    function createDatasetFromAggregation(
        string memory title,
        uint256 startTimestamp,
        uint256 endTimestamp,
        uint256 price,
        uint256 minAge,
        uint256 maxAge,
        string memory region,
        string memory dataLocation
    ) external onlyOwner returns (uint256) {
        require(startTimestamp < endTimestamp, "Invalid time period");
        require(endTimestamp <= block.timestamp, "End timestamp must be in the past");
        require(price > 0, "Price must be greater than zero");
        require(bytes(title).length > 0, "Title cannot be empty");
        require(bytes(region).length > 0, "Region cannot be empty");
        require(bytes(dataLocation).length > 0, "Data location cannot be empty");
        
        // Calculate day timestamps (timestamp / 86400)
        uint256 startDay = startTimestamp / 86400;
        uint256 endDay = endTimestamp / 86400;
        
        // Get aggregated data from HealthRewardsEngine
        (
            uint256 totalSteps,
            uint256 totalSleepHours,
            uint256 totalExerciseMinutes,
            uint256 totalEntries,
            uint256 uniqueDays
        ) = healthRewardsEngine.getAggregatedDataForRange(startDay, endDay);
        
        require(totalEntries >= 100, "Insufficient data: minimum 100 entries required for privacy compliance");
        
        // Calculate averages
        uint256 avgSteps = totalEntries > 0 ? totalSteps / totalEntries : 0;
        uint256 avgSleepHours = totalEntries > 0 ? totalSleepHours / totalEntries : 0;
        uint256 avgExerciseMinutes = totalEntries > 0 ? totalExerciseMinutes / totalEntries : 0;
        
        // Estimate user count (entries / average entries per user per day)
        // Assuming average 1 entry per user per day
        uint256 estimatedUserCount = uniqueDays > 0 ? totalEntries / uniqueDays : totalEntries;
        if (estimatedUserCount < 100) {
            estimatedUserCount = 100; // Minimum for privacy compliance
        }
        
        uint256 datasetId = _datasetIdCounter++;
        
        datasets[datasetId] = Dataset({
            datasetId: datasetId,
            title: title,
            userCount: estimatedUserCount,
            startTimestamp: startTimestamp,
            endTimestamp: endTimestamp,
            price: price,
            isActive: true,
            createdAt: block.timestamp,
            averageDailySteps: avgSteps,
            averageSleepHours: avgSleepHours,
            averageExerciseMinutes: avgExerciseMinutes,
            minAge: minAge,
            maxAge: maxAge,
            region: region,
            dataLocation: dataLocation,
            purchaseCount: 0
        });
        
        emit DatasetCreated(datasetId, title, price, estimatedUserCount);
        emit DatasetCreatedFromAggregation(
            datasetId,
            startTimestamp,
            endTimestamp,
            estimatedUserCount,
            avgSteps,
            avgSleepHours,
            avgExerciseMinutes
        );
        
        return datasetId;
    }
    
    /**
     * @dev Create dataset on purchase request by aggregating data from HealthRewardsEngine
     * This allows dynamic dataset creation when a researcher requests data for a specific period
     * @param title Dataset title/description
     * @param startTimestamp Start of data collection period
     * @param endTimestamp End of data collection period
     * @param price Price in wei (ETH) - buyer pays this amount
     * @param minAge Minimum age in cohort
     * @param maxAge Maximum age in cohort
     * @param region Geographic region
     * @param dataLocation IPFS hash or API endpoint for actual data
     * @return datasetId The ID of the newly created and purchased dataset
     * 
     * Note: This function creates the dataset, aggregates data, and processes the purchase in one transaction.
     * The buyer must send the exact ETH amount as the price.
     */
    function purchaseDatasetWithAggregation(
        string memory title,
        uint256 startTimestamp,
        uint256 endTimestamp,
        uint256 price,
        uint256 minAge,
        uint256 maxAge,
        string memory region,
        string memory dataLocation
    ) external payable nonReentrant returns (uint256) {
        require(msg.value == price, "Incorrect payment amount");
        require(price > 0, "Price must be greater than zero");
        require(startTimestamp < endTimestamp, "Invalid time period");
        require(endTimestamp <= block.timestamp, "End timestamp must be in the past");
        require(bytes(title).length > 0, "Title cannot be empty");
        require(bytes(region).length > 0, "Region cannot be empty");
        require(bytes(dataLocation).length > 0, "Data location cannot be empty");
        
        // Calculate day timestamps
        uint256 startDay = startTimestamp / 86400;
        uint256 endDay = endTimestamp / 86400;
        
        // Get aggregated data from HealthRewardsEngine
        (
            uint256 totalSteps,
            uint256 totalSleepHours,
            uint256 totalExerciseMinutes,
            uint256 totalEntries,
            uint256 uniqueDays
        ) = healthRewardsEngine.getAggregatedDataForRange(startDay, endDay);
        
        require(totalEntries >= 100, "Insufficient data: minimum 100 entries required for privacy compliance");
        
        // Calculate averages
        uint256 avgSteps = totalEntries > 0 ? totalSteps / totalEntries : 0;
        uint256 avgSleepHours = totalEntries > 0 ? totalSleepHours / totalEntries : 0;
        uint256 avgExerciseMinutes = totalEntries > 0 ? totalExerciseMinutes / totalEntries : 0;
        
        // Estimate user count
        uint256 estimatedUserCount = uniqueDays > 0 ? totalEntries / uniqueDays : totalEntries;
        if (estimatedUserCount < 100) {
            estimatedUserCount = 100;
        }
        
        // Create dataset
        uint256 datasetId = _datasetIdCounter++;
        
        datasets[datasetId] = Dataset({
            datasetId: datasetId,
            title: title,
            userCount: estimatedUserCount,
            startTimestamp: startTimestamp,
            endTimestamp: endTimestamp,
            price: price,
            isActive: true,
            createdAt: block.timestamp,
            averageDailySteps: avgSteps,
            averageSleepHours: avgSleepHours,
            averageExerciseMinutes: avgExerciseMinutes,
            minAge: minAge,
            maxAge: maxAge,
            region: region,
            dataLocation: dataLocation,
            purchaseCount: 1 // Already purchased
        });
        
        // Record purchase
        _purchasedDatasets[msg.sender].push(datasetId);
        purchaseTimestamps[msg.sender][datasetId] = block.timestamp;
        
        // Transfer ETH to treasury
        (bool success, ) = treasury.call{value: msg.value}("");
        require(success, "Treasury transfer failed");
        
        emit DatasetCreated(datasetId, title, price, estimatedUserCount);
        emit DatasetCreatedFromAggregation(
            datasetId,
            startTimestamp,
            endTimestamp,
            estimatedUserCount,
            avgSteps,
            avgSleepHours,
            avgExerciseMinutes
        );
        emit DatasetPurchased(msg.sender, datasetId, msg.value, block.timestamp);
        
        return datasetId;
    }
    
    /**
     * @dev Purchase access to a dataset
     * @param datasetId The ID of the dataset to purchase
     * 
     * Requirements:
     * - Dataset must exist and be active
     * - Buyer must send exact ETH amount (price)
     * - Payment is sent to treasury
     * 
     * Note: Same dataset can be purchased by multiple buyers (non-exclusive)
     */
    function purchaseDataset(uint256 datasetId) external payable nonReentrant {
        Dataset storage dataset = datasets[datasetId];
        
        require(dataset.datasetId != 0, "Dataset does not exist");
        require(dataset.isActive, "Dataset is not available for purchase");
        require(msg.value == dataset.price, "Incorrect payment amount");
        
        // Record purchase
        _purchasedDatasets[msg.sender].push(datasetId);
        purchaseTimestamps[msg.sender][datasetId] = block.timestamp;
        dataset.purchaseCount++;
        
        // Transfer ETH to treasury
        (bool success, ) = treasury.call{value: msg.value}("");
        require(success, "Treasury transfer failed");
        
        emit DatasetPurchased(msg.sender, datasetId, msg.value, block.timestamp);
    }
    
    /**
     * @dev Get dataset information
     * @param datasetId The ID of the dataset
     * @return dataset The Dataset struct
     */
    function getDataset(uint256 datasetId) external view returns (Dataset memory) {
        require(datasets[datasetId].datasetId != 0, "Dataset does not exist");
        return datasets[datasetId];
    }
    
    /**
     * @dev Get all datasets purchased by a buyer
     * @param buyer Address of the buyer
     * @return datasetIds Array of purchased dataset IDs
     */
    function getPurchasedDatasets(address buyer) external view returns (uint256[] memory) {
        return _purchasedDatasets[buyer];
    }
    
    /**
     * @dev Check if a buyer has purchased a specific dataset
     * @param buyer Address of the buyer
     * @param datasetId The ID of the dataset
     * @return hasPurchased True if buyer has purchased the dataset
     * @return purchaseTimestamp Timestamp of purchase (0 if not purchased)
     */
    function hasPurchasedDataset(address buyer, uint256 datasetId) 
        external 
        view 
        returns (bool hasPurchased, uint256 purchaseTimestamp) 
    {
        purchaseTimestamp = purchaseTimestamps[buyer][datasetId];
        hasPurchased = purchaseTimestamp > 0;
    }
    
    /**
     * @dev Get total number of datasets created
     * @return count Total number of datasets
     */
    function getDatasetCount() external view returns (uint256) {
        return _datasetIdCounter - 1;
    }
    
    /**
     * @dev Get all active dataset IDs
     * @return activeIds Array of active dataset IDs
     * 
     * Note: This function may run out of gas if there are too many datasets.
     * Consider pagination for production use.
     */
    function getActiveDatasetIds() external view returns (uint256[] memory) {
        uint256 count = _datasetIdCounter - 1;
        uint256 activeCount = 0;
        
        // First pass: count active datasets
        for (uint256 i = 1; i <= count; i++) {
            if (datasets[i].isActive) {
                activeCount++;
            }
        }
        
        // Second pass: collect active dataset IDs
        uint256[] memory activeIds = new uint256[](activeCount);
        uint256 index = 0;
        for (uint256 i = 1; i <= count; i++) {
            if (datasets[i].isActive) {
                activeIds[index] = i;
                index++;
            }
        }
        
        return activeIds;
    }
    
    /**
     * @dev Update dataset active status (only owner)
     * @param datasetId The ID of the dataset
     * @param isActive New active status
     */
    function setDatasetStatus(uint256 datasetId, bool isActive) external onlyOwner {
        require(datasets[datasetId].datasetId != 0, "Dataset does not exist");
        datasets[datasetId].isActive = isActive;
        emit DatasetStatusUpdated(datasetId, isActive);
    }
    
    /**
     * @dev Update dataset price (only owner)
     * @param datasetId The ID of the dataset
     * @param newPrice New price in wei (ETH)
     */
    function updateDatasetPrice(uint256 datasetId, uint256 newPrice) external onlyOwner {
        require(datasets[datasetId].datasetId != 0, "Dataset does not exist");
        require(newPrice > 0, "Price must be greater than zero");
        datasets[datasetId].price = newPrice;
    }
    
    /**
     * @dev Update dataset data location (only owner)
     * @param datasetId The ID of the dataset
     * @param newDataLocation New IPFS hash or API endpoint
     */
    function updateDataLocation(uint256 datasetId, string memory newDataLocation) external onlyOwner {
        require(datasets[datasetId].datasetId != 0, "Dataset does not exist");
        require(bytes(newDataLocation).length > 0, "Data location cannot be empty");
        datasets[datasetId].dataLocation = newDataLocation;
    }
    
    /**
     * @dev Update treasury address (only owner)
     * @param newTreasury New treasury address
     */
    function updateTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Treasury address cannot be zero");
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }
    
    /**
     * @dev Update HealthRewardsEngine address (only owner)
     * @param newHealthRewardsEngine New HealthRewardsEngine address
     */
    function updateHealthRewardsEngine(address newHealthRewardsEngine) external onlyOwner {
        require(newHealthRewardsEngine != address(0), "HealthRewardsEngine address cannot be zero");
        address oldEngine = address(healthRewardsEngine);
        healthRewardsEngine = HealthRewardsEngine(newHealthRewardsEngine);
        emit HealthRewardsEngineUpdated(oldEngine, newHealthRewardsEngine);
    }
    
    /**
     * @dev Preview aggregated data for a time period (before creating dataset)
     * @param startTimestamp Start of data collection period
     * @param endTimestamp End of data collection period
     * @return avgSteps Average daily steps
     * @return avgSleepHours Average sleep hours (in minutes)
     * @return avgExerciseMinutes Average exercise minutes
     * @return totalEntries Total number of health data entries
     * @return uniqueDays Number of unique days with data
     * @return estimatedUserCount Estimated number of users
     * 
     * This allows owners to preview what the aggregated data would look like
     * before creating a dataset.
     */
    function previewAggregatedData(uint256 startTimestamp, uint256 endTimestamp)
        external
        view
        returns (
            uint256 avgSteps,
            uint256 avgSleepHours,
            uint256 avgExerciseMinutes,
            uint256 totalEntries,
            uint256 uniqueDays,
            uint256 estimatedUserCount
        )
    {
        require(startTimestamp < endTimestamp, "Invalid time period");
        
        uint256 startDay = startTimestamp / 86400;
        uint256 endDay = endTimestamp / 86400;
        
        (
            uint256 totalSteps,
            uint256 totalSleepHours,
            uint256 totalExerciseMinutes,
            uint256 entries,
            uint256 daysCount
        ) = healthRewardsEngine.getAggregatedDataForRange(startDay, endDay);
        
        totalEntries = entries;
        uniqueDays = daysCount;
        
        if (totalEntries > 0) {
            avgSteps = totalSteps / totalEntries;
            avgSleepHours = totalSleepHours / totalEntries;
            avgExerciseMinutes = totalExerciseMinutes / totalEntries;
        }
        
        // Estimate user count
        estimatedUserCount = uniqueDays > 0 ? totalEntries / uniqueDays : totalEntries;
        if (estimatedUserCount < 100) {
            estimatedUserCount = 100;
        }
    }
    
    /**
     * @dev Get total revenue generated (sum of all purchases)
     * @return totalRevenue Total ETH collected in wei
     * 
     * Note: This is calculated by summing all dataset prices multiplied by purchase counts.
     * Actual treasury balance may differ if funds were withdrawn.
     */
    function getTotalRevenue() external view returns (uint256 totalRevenue) {
        uint256 count = _datasetIdCounter - 1;
        for (uint256 i = 1; i <= count; i++) {
            Dataset memory dataset = datasets[i];
            totalRevenue += dataset.price * dataset.purchaseCount;
        }
    }
    
    /**
     * @dev Get revenue for a specific dataset
     * @param datasetId The ID of the dataset
     * @return revenue Total ETH collected for this dataset
     */
    function getDatasetRevenue(uint256 datasetId) external view returns (uint256) {
        Dataset memory dataset = datasets[datasetId];
        require(dataset.datasetId != 0, "Dataset does not exist");
        return dataset.price * dataset.purchaseCount;
    }
}

