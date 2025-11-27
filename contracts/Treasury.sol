// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ISweatCoin.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/IUniswapV2Router02.sol"; // For DEX interaction to stabilize price

/**
 * @title Treasury
 * @dev Manages ETH and SWEAT reserves, handles merchant subsidies, and implements price stability.
 */
contract Treasury is Ownable {
    // --- External Contracts ---
    ISweatCoin public sweatCoin;
    IERC20 public sweatCoinERC20; // For balanceOf and approve
    
    // --- External Contracts for interaction ---
    address public merchantGateway; // Address of the MerchantGateway contract
    
    // --- Price Stability Mechanism ---
    IPriceOracle public priceOracle;
    uint256 public constant TARGET_PRICE_USD = 1 ether; // Represents $1.00 in 18 decimals
    uint256 public constant LOWER_BOUND_USD = 0.8 ether; // Represents $0.80
    uint256 public constant UPPER_BOUND_USD = 1.2 ether; // Represents $1.20
    uint256 public interventionAmountETH = 10 ether; // Default 10 ETH per intervention
    IUniswapV2Router02 public uniswapRouter; // Address of the Uniswap Router for buying SWEAT

    // --- Merchant & Fee Configuration ---
    uint256 public defaultMerchantSubsidyETH = 20 ether; // Default $20 ETH subsidy (in wei)
    uint256 public treasurySweatFeePercentage = 5; // 5% fee to treasury
    uint256 public burnRatePercentage = 80; // 80% of SWEAT burned
    uint256 public merchantSweatPercentage = 15; // 15% of SWEAT to merchant

    // --- Events ---
    event EthDeposited(address indexed depositor, uint256 amount);
    event EthWithdrawn(address indexed recipient, uint256 amount);
    event PriceOracleUpdated(address indexed oldOracle, address indexed newOracle);
    event UniswapRouterUpdated(address indexed oldRouter, address indexed newRouter);
    event DefaultMerchantSubsidyEthUpdated(uint256 oldSubsidy, uint256 newSubsidy);
    event PriceStabilizationExecuted(uint256 ethSpent, uint256 sweatBoughtAndBurned, uint256 currentPriceUSD);
    event MerchantSubsidyPaid(address indexed merchant, uint256 amountETH);
    event SweatCoinAddressUpdated(address indexed oldAddress, address indexed newAddress);
    event TreasurySweatFeePercentageUpdated(uint256 oldPercentage, uint256 newPercentage);
    event BurnRatePercentageUpdated(uint256 oldPercentage, uint256 newPercentage);
    event MerchantSweatPercentageUpdated(uint256 oldPercentage, uint256 newPercentage);
    event MerchantGatewayAddressUpdated(address indexed oldAddress, address indexed newAddress);

    /**
     * @dev Constructor
     * @param _priceOracle Address of the price oracle contract
     * @param _uniswapRouter Address of the Uniswap Router (e.g., UniswapV2Router02)
     */
    constructor(address _priceOracle, address _uniswapRouter) Ownable(msg.sender) {
        require(_priceOracle != address(0), "Price oracle address cannot be zero");
        require(_uniswapRouter != address(0), "Uniswap router address cannot be zero");
        priceOracle = IPriceOracle(_priceOracle);
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
    }

    // Fallback function to accept ETH
    receive() external payable {
        emit EthDeposited(msg.sender, msg.value);
    }

    /**
     * @dev Sets the SweatCoinToken address. Can only be called once by the owner.
     * This is separate from the constructor as SweatCoin might be deployed after Treasury.
     * @param _sweatCoinAddress Address of the SweatCoin token contract.
     */
    function setSweatCoinAddress(address _sweatCoinAddress) external onlyOwner {
        require(address(sweatCoin) == address(0), "SweatCoin address already set");
        require(_sweatCoinAddress != address(0), "SweatCoin address cannot be zero");
        address oldAddress = address(sweatCoin);
        sweatCoin = ISweatCoin(_sweatCoinAddress);
        sweatCoinERC20 = IERC20(_sweatCoinAddress); // Also set the IERC20 interface for approval/balanceOf
        emit SweatCoinAddressUpdated(oldAddress, _sweatCoinAddress);
    }

    /**
     * @dev Sets the MerchantGateway address. Can only be called once by the owner.
     * @param _merchantGatewayAddress Address of the MerchantGateway contract.
     */
    function setMerchantGatewayAddress(address _merchantGatewayAddress) external onlyOwner {
        require(merchantGateway == address(0), "MerchantGateway address already set");
        require(_merchantGatewayAddress != address(0), "MerchantGateway address cannot be zero");
        address oldAddress = merchantGateway;
        merchantGateway = _merchantGatewayAddress;
        emit MerchantGatewayAddressUpdated(oldAddress, _merchantGatewayAddress);
    }

    /**
     * @dev Withdraws ETH from the treasury.
     * @param to Address to send the ETH to.
     * @param amount Amount of ETH to withdraw (in wei).
     */
    function withdrawEth(address to, uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient ETH balance in treasury");
        (bool success, ) = to.call{value: amount}("");
        require(success, "ETH transfer failed");
        emit EthWithdrawn(to, amount);
    }

    /**
     * @dev Updates the price oracle address.
     * @param newOracle Address of the new price oracle contract.
     */
    function updatePriceOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "New oracle address cannot be zero");
        address oldOracle = address(priceOracle);
        priceOracle = IPriceOracle(newOracle);
        emit PriceOracleUpdated(oldOracle, newOracle);
    }

    /**
     * @dev Updates the Uniswap Router address.
     * @param newRouter Address of the new Uniswap Router.
     */
    function updateUniswapRouter(address newRouter) external onlyOwner {
        require(newRouter != address(0), "New router address cannot be zero");
        address oldRouter = address(uniswapRouter);
        uniswapRouter = IUniswapV2Router02(newRouter);
        emit UniswapRouterUpdated(oldRouter, newRouter);
    }

    /**
     * @dev Updates the default ETH subsidy amount for merchants.
     * @param newSubsidy The new default ETH subsidy amount (in wei).
     */
    function updateDefaultMerchantSubsidyEth(uint256 newSubsidy) external onlyOwner {
        uint256 oldSubsidy = defaultMerchantSubsidyETH;
        defaultMerchantSubsidyETH = newSubsidy;
        emit DefaultMerchantSubsidyEthUpdated(oldSubsidy, newSubsidy);
    }

    /**
     * @dev Updates the percentage of SWEAT fee sent to the treasury.
     * @param newPercentage The new treasury SWEAT fee percentage (e.g., 5 for 5%).
     */
    function updateTreasurySweatFeePercentage(uint256 newPercentage) external onlyOwner {
        require(newPercentage <= 100, "Percentage cannot exceed 100");
        uint256 oldPercentage = treasurySweatFeePercentage;
        treasurySweatFeePercentage = newPercentage;
        emit TreasurySweatFeePercentageUpdated(oldPercentage, newPercentage);
    }

    /**
     * @dev Updates the percentage of SWEAT to be burned.
     * @param newPercentage The new burn rate percentage (e.g., 80 for 80%).
     */
    function updateBurnRatePercentage(uint256 newPercentage) external onlyOwner {
        require(newPercentage <= 100, "Percentage cannot exceed 100");
        uint256 oldPercentage = burnRatePercentage;
        burnRatePercentage = newPercentage;
        emit BurnRatePercentageUpdated(oldPercentage, newPercentage);
    }

    /**
     * @dev Updates the percentage of SWEAT sent to the merchant.
     * @param newPercentage The new merchant SWEAT percentage (e.g., 15 for 15%).
     */
    function updateMerchantSweatPercentage(uint256 newPercentage) external onlyOwner {
        require(newPercentage <= 100, "Percentage cannot exceed 100");
        uint256 oldPercentage = merchantSweatPercentage;
        merchantSweatPercentage = newPercentage;
        emit MerchantSweatPercentageUpdated(oldPercentage, newPercentage);
    }

    /**
     * @dev Retrieves the current SWEAT price in USD from the oracle.
     * @return currentPrice The SWEAT price in USD (fixed point, 18 decimals).
     */
    function getSweatPriceUsd() public view returns (uint256) {
        return priceOracle.getSWEATPriceUSD();
    }

    /**
     * @dev Checks if the SWEAT price is below the lower bound, indicating a need for intervention.
     * @return needsIntervention True if an intervention is needed.
     */
    function checkPriceStability() public view returns (bool needsIntervention) {
        uint256 currentPrice = getSweatPriceUsd();
        return currentPrice < LOWER_BOUND_USD;
    }

    /**
     * @dev Executes the price stabilization mechanism.
     * Buys SWEAT from Uniswap with ETH and burns the purchased SWEAT.
     * Requires the Treasury contract to have allowance to spend SWEAT on Uniswap.
     */
    function stabilizePrice() external onlyOwner {
        require(checkPriceStability(), "Price is stable, no intervention needed");
        require(address(sweatCoin) != address(0), "SweatCoin token address not set");
        require(address(this).balance >= interventionAmountETH, "Insufficient ETH for intervention");
        
        // This is a simplified interaction. In a real scenario, you'd need to consider:
        // 1. Path for the swap (e.g., ETH -> WETH -> SWEAT)
        // 2. Slippage control
        // 3. Deadline for the transaction
        // 4. Handling potential failures of the swap
        
        // Approve Uniswap Router to spend WETH (if direct ETH to SWEAT is not possible)
        // This would require WETH token address and converting ETH to WETH first.
        // For simplicity, let's assume a direct ETH to SWEAT swap path is available
        // or that the router handles WETH wrapping internally for ETH input.

        // Get the path for swapping ETH to SWEAT. Assumes SWEAT is directly tradable against WETH.
        address[] memory path = new address[](2);
        path[0] = uniswapRouter.WETH(); // WETH address on the network
        path[1] = address(sweatCoin);

        // Perform the swap
        // The router will transfer ETH from this contract, wrap it to WETH, swap WETH for SWEAT,
        // and send SWEAT to this contract.
        // It's crucial that the Uniswap router is trusted and correctly configured.
        uint256[] memory amounts;
        try uniswapRouter.swapExactETHForTokens{value: interventionAmountETH}(
            0, // Min amount of tokens out, allow 0 for simplicity in this example
            path,
            address(this), // Send bought SWEAT to Treasury
            block.timestamp // Deadline
        ) returns (uint256[] memory _amounts) {
            amounts = _amounts;
        } catch Error(string memory reason) {
            revert(string(abi.encodePacked("Uniswap swap failed: ", reason)));
        } catch {
            revert("Uniswap swap failed");
        }

        uint256 sweatBought = amounts[amounts.length - 1]; // Last element is the amount of SWEAT received
        require(sweatBought > 0, "No SWEAT bought during intervention");

        // Burn all purchased SWEAT
        sweatCoin.burn(address(this), sweatBought); // Treasury must have BURNER_ROLE
        
        emit PriceStabilizationExecuted(interventionAmountETH, sweatBought, getSweatPriceUsd());
    }
    
    /**
     * @dev Pays the default ETH subsidy to a merchant.
     * Callable by authorized contracts like MerchantGateway.
     * @param merchantAddress The address of the merchant to pay.
     */
    function payMerchantSubsidy(address merchantAddress, uint256 /*couponValue*/) external {
        require(msg.sender == merchantGateway, "Only MerchantGateway can call this");
        require(address(this).balance >= defaultMerchantSubsidyETH, "Insufficient ETH for subsidy");
        require(merchantAddress != address(0), "Merchant address cannot be zero");

        (bool success, ) = merchantAddress.call{value: defaultMerchantSubsidyETH}("");
        require(success, "Merchant ETH subsidy transfer failed");

        emit MerchantSubsidyPaid(merchantAddress, defaultMerchantSubsidyETH);
    }
}
