// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPriceOracle {
    /**
     * @dev Returns the current SWEAT price in USD.
     * @return price The SWEAT price in USD, scaled by 10^18 (e.g., 1 ether for $1).
     */
    function getSWEATPriceUSD() external view returns (uint256 price);
}
