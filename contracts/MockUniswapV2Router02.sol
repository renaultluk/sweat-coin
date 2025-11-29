// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockUniswapV2Router02 is IUniswapV2Router02 {
    address public WETH_ADDRESS;
    mapping(address => uint256) public amountsOut;

    constructor() {
        WETH_ADDRESS = address(1); 
    }

    function WETH() external view override returns (address) {
        return WETH_ADDRESS;
    }

    function swapExactETHForTokens(
        uint256 /*amountOutMin*/,
        address[] calldata path,
        address to,
        uint256 /*deadline*/
    ) external payable override returns (uint256[] memory) {
        require(path.length == 2, "MockUniswapV2Router02: Invalid path length");
        require(path[0] == WETH_ADDRESS, "MockUniswapV2Router02: Expected WETH as first token in path");

        uint256 tokenOutAmount = amountsOut[path[1]];

        uint256[] memory returnedAmounts = new uint256[](2);
        returnedAmounts[0] = msg.value;
        returnedAmounts[1] = tokenOutAmount;
        return returnedAmounts;
    }

    function getAmountsOut(uint256 /*amountIn*/, address[] calldata path) external view override returns (uint256[] memory) {
        require(path.length == 2, "MockUniswapV2Router02: Invalid path length");
        require(path[0] == WETH_ADDRESS, "MockUniswapV2Router02: Expected WETH as first token in path");

        uint256 tokenOutAmount = amountsOut[path[1]];
        uint256[] memory returnedAmounts = new uint256[](2);
        returnedAmounts[0] = 0; // Placeholder for amountIn
        returnedAmounts[1] = tokenOutAmount;
        return returnedAmounts;
    }

    function setAmountsOut(uint256[] memory _amountsOut) external {
        amountsOut[WETH_ADDRESS] = _amountsOut[0];
        amountsOut[address(2)] = _amountsOut[1];
    }
}
