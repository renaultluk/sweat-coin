// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IPriceOracle.sol";

contract MockPriceOracle is IPriceOracle {
    uint256 public SWEATPriceUSD;

    constructor() {
        SWEATPriceUSD = 1 * 10**18; // Default to $1
    }

    function getSWEATPriceUSD() external view override returns (uint256 price) {
        return SWEATPriceUSD;
    }

    function setSWEATPriceUSD(uint256 _price) external {
        SWEATPriceUSD = _price;
    }
}
