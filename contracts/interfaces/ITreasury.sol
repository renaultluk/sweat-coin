// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITreasury {
    function burnRatePercentage() external view returns (uint256);
    function merchantSweatPercentage() external view returns (uint256);
    function treasurySweatFeePercentage() external view returns (uint256);
    function defaultMerchantSubsidyETH() external view returns (uint256); // Consistent casing
    function payMerchantSubsidy(address merchantAddress, uint256 couponValue) external;
}
