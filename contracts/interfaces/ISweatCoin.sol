// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ISweatCoin
 * @dev Interface for the SweatCoin ERC-20 token
 * This allows other contracts to interact with SweatCoin without importing the full implementation
 * 
 * NOTE: This interface only declares CUSTOM functions (mint, burn).
 * Standard ERC20 functions (transfer, balanceOf, etc.) are inherited from OpenZeppelin's ERC20.
 */
interface ISweatCoin {
    // Custom functions specific to SweatCoin
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    
    // Events (interfaces can declare events that implementations must emit)
    event TokensMinted(address indexed to, uint256 amount, string reason);
    event TokensBurned(address indexed from, uint256 amount, string reason);
}