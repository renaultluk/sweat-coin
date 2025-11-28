// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ISweatCoin.sol";
import "./interfaces/ITreasury.sol"; // Using the interface for Treasury

/**
 * @title MerchantGateway
 * @dev Manages merchant registration, coupon creation, and SWEAT redemption for coupons.
 * Handles SWEAT burning, distribution to merchants and treasury, and ETH subsidy requests.
 */
contract MerchantGateway is Ownable {
    // --- External Contracts ---
    ISweatCoin public sweatCoin;
    ITreasury public treasury;

    // --- Data Structures ---
    struct Merchant {
        string name;
        address walletAddress;
        bool isActive;
        uint256 defaultCouponValueUSD; // Default coupon value in USD for this merchant
        uint256 totalSweatReceived;
        uint256 totalEthReceived;
    }

    struct Coupon {
        uint256 id;
        string description;
        uint256 valueUSD; // Value of the coupon in USD (e.g., 40 for $40)
        address merchantAddress;
        bool isActive;
        uint256 createdAt;
        uint256 redemptionCount;
    }

    // --- Mappings and State Variables ---
    mapping(address => Merchant) public merchants; // Merchant wallet address => Merchant details
    mapping(uint256 => Coupon) public coupons; // Coupon ID => Coupon details
    mapping(address => uint256[]) private merchantCouponIds; // Merchant address => List of coupon IDs
    uint256 private _couponIdCounter;

    // Redemption limits (per user)
    mapping(address => mapping(uint256 => uint256)) public lastRedemptionTime; // user => couponId => timestamp
    mapping(address => mapping(uint256 => uint256)) public redemptionCountPerPeriod; // user => periodId => count

    // Global redemption limits - can be overridden per merchant if needed later
    uint256 public maxRedemptionsPerUserPerPeriod = 4; // e.g., 4 redemptions
    uint256 public redemptionPeriodDuration = 30 days; // e.g., 30 days
    uint256 public redemptionCooldown = 7 days; // e.g., 7 days between redemptions of same coupon

    // --- Events ---
    event MerchantRegistered(address indexed merchantAddress, string name, uint256 defaultCouponValueUSD);
    event MerchantUpdated(address indexed merchantAddress, string name, uint256 defaultCouponValueUSD, bool isActive);
    event CouponCreated(uint256 indexed couponId, string description, uint256 valueUSD, address indexed merchantAddress);
    event CouponUpdated(uint256 indexed couponId, string description, uint256 valueUSD, bool isActive);
    event CouponRedeemed(
        address indexed user,
        uint256 indexed couponId,
        address indexed merchantAddress,
        uint256 sweatAmount,
        uint256 burnedSweat,
        uint256 merchantSweat,
        uint256 treasurySweatFee,
        uint256 ethSubsidyRequested
    );
    event RedemptionLimitsUpdated(uint256 newMaxRedemptions, uint256 newPeriodDuration, uint256 newCooldown);
    event SweatCoinAddressUpdated(address indexed oldAddress, address indexed newAddress);
    event TreasuryAddressUpdated(address indexed oldAddress, address indexed newAddress);

    /**
     * @dev Constructor
     * @param _sweatCoinAddress Address of the SweatCoin token contract
     * @param _treasuryAddress Address of the Treasury contract
     */
    constructor(address _sweatCoinAddress, address _treasuryAddress) Ownable(msg.sender) {
        require(_sweatCoinAddress != address(0), "SweatCoin address cannot be zero");
        require(_treasuryAddress != address(0), "Treasury address cannot be zero");
        sweatCoin = ISweatCoin(_sweatCoinAddress);
        treasury = ITreasury(_treasuryAddress);
        _couponIdCounter = 1;
    }

    // --- Merchant Management (Owner Only) ---

    /**
     * @dev Registers a new merchant.
     * @param _merchantAddress The wallet address of the merchant.
     * @param _name The name of the merchant.
     * @param _defaultCouponValueUSD The default USD value for coupons offered by this merchant.
     */
    function registerMerchant(
        address _merchantAddress,
        string calldata _name,
        uint256 _defaultCouponValueUSD
    ) external onlyOwner {
        require(_merchantAddress != address(0), "Merchant address cannot be zero");
        require(merchants[_merchantAddress].walletAddress == address(0), "Merchant already registered");
        require(bytes(_name).length > 0, "Merchant name cannot be empty");
        require(_defaultCouponValueUSD > 0, "Default coupon value must be greater than zero");

        merchants[_merchantAddress] = Merchant({
            name: _name,
            walletAddress: _merchantAddress,
            isActive: true,
            defaultCouponValueUSD: _defaultCouponValueUSD,
            totalSweatReceived: 0,
            totalEthReceived: 0
        });
        emit MerchantRegistered(_merchantAddress, _name, _defaultCouponValueUSD);
    }

    /**
     * @dev Updates an existing merchant's details.
     * @param _merchantAddress The wallet address of the merchant.
     * @param _name The new name of the merchant.
     * @param _defaultCouponValueUSD The new USD value for coupons.
     * @param _isActive The new active status of the merchant.
     */
    function updateMerchant(
        address _merchantAddress,
        string calldata _name,
        uint256 _defaultCouponValueUSD,
        bool _isActive
    ) external onlyOwner {
        require(merchants[_merchantAddress].walletAddress != address(0), "Merchant not registered");
        require(bytes(_name).length > 0, "Merchant name cannot be empty");
        require(_defaultCouponValueUSD > 0, "Default coupon value must be greater than zero");

        merchants[_merchantAddress].name = _name;
        merchants[_merchantAddress].defaultCouponValueUSD = _defaultCouponValueUSD;
        merchants[_merchantAddress].isActive = _isActive;
        emit MerchantUpdated(_merchantAddress, _name, _defaultCouponValueUSD, _isActive);
    }

    /**
     * @dev Get merchant details.
     * @param _merchantAddress The wallet address of the merchant.
     * @return Merchant struct containing details.
     */
    function getMerchant(address _merchantAddress) public view returns (Merchant memory) {
        require(merchants[_merchantAddress].walletAddress != address(0), "Merchant not registered");
        return merchants[_merchantAddress];
    }

    // --- Coupon Management (Owner Only for now, could be merchant-callable later) ---

    /**
     * @dev Creates a new coupon.
     * @param _description Description of the coupon.
     * @param _valueUSD The USD value of the coupon (e.g., 40 for $40).
     * @param _merchantAddress The address of the merchant offering the coupon.
     * @return The ID of the newly created coupon.
     */
    function createCoupon(
        string calldata _description,
        uint256 _valueUSD,
        address _merchantAddress
    ) external onlyOwner returns (uint256) {
        require(merchants[_merchantAddress].walletAddress != address(0), "Merchant not registered");
        require(merchants[_merchantAddress].isActive, "Merchant is not active");
        require(bytes(_description).length > 0, "Coupon description cannot be empty");
        require(_valueUSD > 0, "Coupon value must be greater than zero");

        uint256 newCouponId = _couponIdCounter++;
        coupons[newCouponId] = Coupon({
            id: newCouponId,
            description: _description,
            valueUSD: _valueUSD,
            merchantAddress: _merchantAddress,
            isActive: true,
            createdAt: block.timestamp,
            redemptionCount: 0
        });
        merchantCouponIds[_merchantAddress].push(newCouponId); // Add coupon ID to merchant's list
        emit CouponCreated(newCouponId, _description, _valueUSD, _merchantAddress);
        return newCouponId;
    }

    /**
     * @dev Updates an existing coupon's details.
     * @param _couponId The ID of the coupon to update.
     * @param _description The new description of the coupon.
     * @param _valueUSD The new USD value of the coupon.
     * @param _isActive The new active status of the coupon.
     */
    function updateCoupon(
        uint256 _couponId,
        string calldata _description,
        uint256 _valueUSD,
        bool _isActive
    ) external onlyOwner {
        require(coupons[_couponId].id != 0, "Coupon does not exist");
        require(bytes(_description).length > 0, "Coupon description cannot be empty");
        require(_valueUSD > 0, "Coupon value must be greater than zero");

        coupons[_couponId].description = _description;
        coupons[_couponId].valueUSD = _valueUSD;
        coupons[_couponId].isActive = _isActive;
        emit CouponUpdated(_couponId, _description, _valueUSD, _isActive);
    }

    /**
     * @dev Get coupon details.
     * @param _couponId The ID of the coupon.
     * @return Coupon struct containing details.
     */
    function getCoupon(uint256 _couponId) public view returns (Coupon memory) {
        require(coupons[_couponId].id != 0, "Coupon does not exist");
        return coupons[_couponId];
    }

    // --- Redemption Logic ---

    /**
     * @dev Redeems a coupon using SWEAT tokens.
     * The user must have approved this contract to spend the required SWEAT amount.
     * @param _couponId The ID of the coupon to redeem.
     */
    function redeemCoupon(uint256 _couponId) external {
        Coupon storage coupon = coupons[_couponId];
        require(coupon.id != 0, "Coupon does not exist");
        require(coupon.isActive, "Coupon is not active");
        
        Merchant storage merchant = merchants[coupon.merchantAddress];
        require(merchant.walletAddress != address(0), "Merchant not registered");
        require(merchant.isActive, "Merchant is not active");

        // Check redemption limits
        _checkRedemptionLimits(msg.sender, _couponId);

        // Required SWEAT amount is equal to coupon's USD value (soft pegged 1:1)
        uint256 requiredSweat = coupon.valueUSD * (10**18); // Scale to 18 decimals

        // Transfer SWEAT from user to this contract (user must have approved first)
        sweatCoin.transferFrom(msg.sender, address(this), requiredSweat);

        // Get distribution percentages from Treasury
        uint256 burnRate = treasury.burnRatePercentage();
        uint256 merchantSweatRate = treasury.merchantSweatPercentage();
        uint256 treasurySweatFeeRate = treasury.treasurySweatFeePercentage();

        // Ensure percentages sum up correctly (or handle discrepancy)
        require(burnRate + merchantSweatRate + treasurySweatFeeRate == 100, "Treasury percentage sum error");

        // Calculate amounts
        uint256 burnedSweat = (requiredSweat * burnRate) / 100;
        uint256 merchantSweat = (requiredSweat * merchantSweatRate) / 100;
        uint256 treasurySweatFee = (requiredSweat * treasurySweatFeeRate) / 100;

        // Execute burn
        sweatCoin.burn(address(this), burnedSweat); // MerchantGateway must have BURNER_ROLE on SweatCoinToken

        // Send SWEAT to merchant
        sweatCoin.transfer(merchant.walletAddress, merchantSweat);
        merchant.totalSweatReceived += merchantSweat;

        // Send SWEAT to Treasury
        sweatCoin.transfer(address(treasury), treasurySweatFee); // Treasury must accept SWEAT

        // Request ETH subsidy from Treasury
        // The coupon.valueUSD is passed for informational/logging purposes in Treasury
        treasury.payMerchantSubsidy(merchant.walletAddress, coupon.valueUSD);
        merchant.totalEthReceived += treasury.defaultMerchantSubsidyETH();

        // Update redemption history and count
        lastRedemptionTime[msg.sender][_couponId] = block.timestamp;
        uint256 currentPeriodId = block.timestamp / redemptionPeriodDuration;
        redemptionCountPerPeriod[msg.sender][currentPeriodId]++;
        coupon.redemptionCount++;

        emit CouponRedeemed(
            msg.sender,
            _couponId,
            merchant.walletAddress,
            requiredSweat,
            burnedSweat,
            merchantSweat,
            treasurySweatFee,
            treasury.defaultMerchantSubsidyETH()
        );
    }

    /**
     * @dev Internal function to check if a user is eligible to redeem a coupon.
     * Can be extended with more complex logic.
     * @param _user The address of the user attempting to redeem.
     * @param _couponId The ID of the coupon.
     */
    function _checkRedemptionLimits(address _user, uint256 _couponId) internal view {
        // Cooldown for the same coupon
        require(
            lastRedemptionTime[_user][_couponId] == 0 ||
            block.timestamp >= lastRedemptionTime[_user][_couponId] + redemptionCooldown,
            "Redemption cooldown active for this coupon"
        );

        // Global redemption limit per period
        uint256 currentPeriodId = block.timestamp / redemptionPeriodDuration;
        require(
            redemptionCountPerPeriod[_user][currentPeriodId] < maxRedemptionsPerUserPerPeriod,
            "Redemption limit reached for this period"
        );
    }

    /**
     * @dev Sets global redemption limits. Only owner can call.
     * @param _maxRedemptionsPerUser The maximum number of redemptions per user per period.
     * @param _periodDuration The duration of the redemption period in seconds.
     * @param _cooldown The cooldown period between redemptions of the same coupon in seconds.
     */
    function setRedemptionLimits(
        uint256 _maxRedemptionsPerUser,
        uint256 _periodDuration,
        uint256 _cooldown
    ) external onlyOwner {
        require(_maxRedemptionsPerUser > 0, "Max redemptions must be greater than zero");
        require(_periodDuration > 0, "Period duration must be greater than zero");
        require(_cooldown >= 0, "Cooldown cannot be negative");

        maxRedemptionsPerUserPerPeriod = _maxRedemptionsPerUser;
        redemptionPeriodDuration = _periodDuration;
        redemptionCooldown = _cooldown;
        emit RedemptionLimitsUpdated(_maxRedemptionsPerUser, _periodDuration, _cooldown);
    }

    // --- Admin Functions ---

    /**
     * @dev Updates the SweatCoinToken address.
     * @param _newSweatCoinAddress The new address of the SweatCoin token contract.
     */
    function updateSweatCoinAddress(address _newSweatCoinAddress) external onlyOwner {
        require(_newSweatCoinAddress != address(0), "SweatCoin address cannot be zero");
        address oldAddress = address(sweatCoin);
        sweatCoin = ISweatCoin(_newSweatCoinAddress);
        emit SweatCoinAddressUpdated(oldAddress, _newSweatCoinAddress);
    }

    /**
     * @dev Updates the Treasury contract address.
     * @param _newTreasuryAddress The new address of the Treasury contract.
     */
    function updateTreasuryAddress(address _newTreasuryAddress) external onlyOwner {
        require(_newTreasuryAddress != address(0), "Treasury address cannot be zero");
        address oldAddress = address(treasury);
        treasury = ITreasury(_newTreasuryAddress);
        emit TreasuryAddressUpdated(oldAddress, _newTreasuryAddress);
    }

    /**
     * @dev Get all coupon IDs created by a specific merchant.
     * @param _merchantAddress The address of the merchant.
     * @return An array of coupon IDs.
     */
    function getCouponIdsByMerchant(address _merchantAddress) external view returns (uint256[] memory) {
        return merchantCouponIds[_merchantAddress];
    }

    /**
     * @dev Returns the total number of coupons created.
     */
    function getTotalCouponsCreated() external view returns (uint256) {
        return _couponIdCounter - 1; // Subtract 1 because _couponIdCounter is incremented after use
    }

    /**
     * @dev Returns an array of all active coupon IDs.
     * This function is designed to be called by off-chain clients to fetch all available coupons.
     * It iterates through all created coupon IDs and checks their active status.
     */
    function getAllActiveCouponIds() external view returns (uint256[] memory) {
        uint256 totalCoupons = _couponIdCounter - 1;
        uint256[] memory activeCouponIds = new uint256[](totalCoupons);
        uint256 activeCount = 0;

        for (uint256 i = 1; i <= totalCoupons; i++) {
            if (coupons[i].isActive) {
                activeCouponIds[activeCount] = i;
                activeCount++;
            }
        }

        // Resize array to actual number of active coupons
        uint256[] memory result = new uint256[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            result[i] = activeCouponIds[i];
        }
        return result;
    }
}
