// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/ISweatCoin.sol";

/**
 * @title SweatCoinToken
 * @dev Implementation of the SweatCoin token with role-based minting/burning
 * Implements the ISweatCoin interface
 */
contract SweatCoinToken is ERC20, AccessControl, ISweatCoin {
    // Define roles for access control
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    
    constructor() ERC20("SweatCoin", "SWEAT") {
        // Grant the contract deployer the default admin role
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // Admin can grant minter and burner roles to other contracts
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
    }
    
    /**
     * @dev Mint new tokens (only callable by contracts with MINTER_ROLE)
     * @param to Address to receive the tokens
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external override onlyRole(MINTER_ROLE) {
        _mint(to, amount);
        emit TokensMinted(to, amount, "Health rewards");
    }
    
    /**
     * @dev Burn tokens (only callable by contracts with BURNER_ROLE)
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burn(address from, uint256 amount) external override onlyRole(BURNER_ROLE) {
        _burn(from, amount);
        emit TokensBurned(from, amount, "Coupon redemption");
    }
    
    /**
     * @dev Grant minter role to a contract (e.g., HealthRewardsEngine)
     * @param account Address to grant the role to
     */
    function grantMinterRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(MINTER_ROLE, account);
    }
    
    /**
     * @dev Grant burner role to a contract (e.g., MerchantGateway)
     * @param account Address to grant the role to
     */
    function grantBurnerRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(BURNER_ROLE, account);
    }
}
