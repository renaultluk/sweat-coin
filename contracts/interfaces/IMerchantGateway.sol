// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ISweatCoin.sol";
import "./ITreasury.sol";

interface IMerchantGateway {
    // --- Data Structures ---
    struct Merchant {
        string name;
        address walletAddress;
        bool isActive;
        uint256 defaultCouponValueUSD;
        uint256 totalSweatReceived;
        uint256 totalEthReceived;
    }

    struct Coupon {
        uint256 id;
        string description;
        uint256 valueUSD;
        address merchantAddress;
        bool isActive;
        uint256 createdAt;
        uint256 redemptionCount;
    }

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

    // --- View Functions ---
    function merchants(address) external view returns (string memory name, address walletAddress, bool isActive, uint256 defaultCouponValueUSD, uint256 totalSweatReceived, uint256 totalEthReceived);
    function coupons(uint256) external view returns (uint256 id, string memory description, uint256 valueUSD, address merchantAddress, bool isActive, uint256 createdAt, uint256 redemptionCount);
    function getMerchant(address _merchantAddress) external view returns (Merchant memory);
    function getCoupon(uint256 _couponId) external view returns (Coupon memory);
    function maxRedemptionsPerUserPerPeriod() external view returns (uint256);
    function redemptionPeriodDuration() external view returns (uint256);
    function redemptionCooldown() external view returns (uint256);
    function lastRedemptionTime(address, uint256) external view returns (uint256);
    function redemptionCountPerPeriod(address, uint256) external view returns (uint256);

    // --- External Functions ---
    function registerMerchant(address _merchantAddress, string calldata _name, uint256 _defaultCouponValueUSD) external;
    function updateMerchant(address _merchantAddress, string calldata _name, uint256 _defaultCouponValueUSD, bool _isActive) external;
    function createCoupon(string calldata _description, uint256 _valueUSD, address _merchantAddress) external returns (uint256);
    function updateCoupon(uint256 _couponId, string calldata _description, uint256 _valueUSD, bool _isActive) external;
    function redeemCoupon(uint256 _couponId) external;
    function setRedemptionLimits(uint256 _maxRedemptionsPerUser, uint256 _periodDuration, uint256 _cooldown) external;
    function updateSweatCoinAddress(address _newSweatCoinAddress) external;
    function updateTreasuryAddress(address _newTreasuryAddress) external;
}
