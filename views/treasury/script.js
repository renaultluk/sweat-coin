import '/views/config/load-addresses.js'; // Ensure loadContractAddresses is available

let provider;
let signer;
let contractAddresses;
let treasuryContract;
let sweatCoinContract;
let mockPriceOracleContract;
let mockUniswapRouterContract; // For displaying address, not direct interaction
let merchantGatewayContract; // For displaying address, not direct interaction
let currentAccount = null;

const TREASURY_ABI_PATH = '../../artifacts/contracts/Treasury.sol/Treasury.json';
const SWEAT_COIN_ABI_PATH = '../../artifacts/contracts/SweatCoinToken.sol/SweatCoinToken.json';
const MOCK_PRICE_ORACLE_ABI_PATH = '../../artifacts/contracts/MockPriceOracle.sol/MockPriceOracle.json';
// No specific ABI needed for Uniswap Router or MerchantGateway if only displaying address

// --- Utility Functions ---
function showStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `status-message ${type}`;
    element.style.display = 'block';

    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

function formatAddress(address) {
    if (!address) return "N/A";
    return `${address.substring(0, 6)}...${address.substring(38)}`;
}

async function loadAbi(abiPath) {
    try {
        const response = await fetch(abiPath);
        if (!response.ok) {
            throw new Error(`Failed to load ABI from ${abiPath}: ${response.statusText}`);
        }
        const json = await response.json();
        return json.abi;
    } catch (error) {
        console.error(`Error loading ABI from ${abiPath}:`, error);
        showStatus('stabilizeStatus', `Error loading contract ABI: ${error.message}`, 'error'); // Use a generic status
        return null;
    }
}

// --- Web3 Initialization ---

async function initWeb3() {
    if (window.ethereum) {
        provider = new ethers.BrowserProvider(window.ethereum);
        // contractAddresses is now loaded in connectWallet()
        document.getElementById('connectButton').textContent = 'Connect Wallet';
        document.getElementById('connectButton').disabled = false;
    } else {
        showStatus('stabilizeStatus', 'MetaMask is not installed. Please install it to use this DApp.', 'error');
        document.getElementById('connectButton').textContent = 'MetaMask Not Found';
        document.getElementById('connectButton').disabled = true;
    }
}

// --- Web3 Initialization ---
// Make connectWallet globally accessible for onclick
window.connectWallet = async function () {
    try {
        if (!provider) { // Ensure provider is initialized if not already
            await initWeb3();
        }
        if (!contractAddresses) { // Load contract addresses if not already loaded
            contractAddresses = await window.loadContractAddresses();
            if (!contractAddresses) {
                showStatus('stabilizeStatus', 'Error: Contract addresses not loaded. Is the network configured correctly?', 'error');
                return;
            }
        }

        await provider.send("eth_requestAccounts", []);
        signer = await provider.getSigner();
        currentAccount = await signer.getAddress();
        document.getElementById('walletAddress').textContent = formatAddress(currentAccount);
        document.getElementById('connectButton').textContent = 'Connected';
        document.getElementById('connectButton').disabled = true;

        await initContracts();
        await loadTreasuryDashboard();

    } catch (error) {
        console.error("User rejected access or other error:", error);
        showStatus('stabilizeStatus', `Wallet connection failed: ${error.message}`, 'error');
    }
}
// Make admin action functions globally accessible for onclick
window.withdrawEth = withdrawEth;
window.stabilizePrice = stabilizePrice;
window.updateDefaultMerchantSubsidyEth = updateDefaultMerchantSubsidyEth;
window.updateTreasurySweatFeePercentage = updateTreasurySweatFeePercentage;
window.updateBurnRatePercentage = updateBurnRatePercentage;
window.updateMerchantSweatPercentage = updateMerchantSweatPercentage;
window.updatePriceOracle = updatePriceOracle;
window.updateUniswapRouter = updateUniswapRouter;
window.setSweatCoinAddress = setSweatCoinAddress;
window.setMerchantGatewayAddress = setMerchantGatewayAddress;

async function initContracts() {
    if (!signer || !contractAddresses) {
        console.error("Web3 not initialized or contract addresses missing.");
        return;
    }

    try {
        const treasuryAbi = await loadAbi(TREASURY_ABI_PATH);
        const sweatCoinAbi = await loadAbi(SWEAT_COIN_ABI_PATH);
        const mockPriceOracleAbi = await loadAbi(MOCK_PRICE_ORACLE_ABI_PATH);

        if (!treasuryAbi || !sweatCoinAbi || !mockPriceOracleAbi) {
            throw new Error("Failed to load one or more contract ABIs.");
        }

        console.log("Contract Addresses for instantiation:", {
            Treasury: contractAddresses.Treasury,
            SweatCoinToken: contractAddresses.SweatCoinToken,
            MockPriceOracle: contractAddresses.MockPriceOracle
        });

        console.log("Attempting to instantiate treasuryContract with address:", contractAddresses.Treasury);
        treasuryContract = new ethers.Contract(contractAddresses.Treasury, treasuryAbi, signer);
        console.log("treasuryContract instantiated. Object:", treasuryContract);

        console.log("Attempting to instantiate sweatCoinContract with address:", contractAddresses.SweatCoinToken);
        sweatCoinContract = new ethers.Contract(contractAddresses.SweatCoinToken, sweatCoinAbi, signer);
        console.log("sweatCoinContract instantiated. Object:", sweatCoinContract);

        console.log("Attempting to instantiate mockPriceOracleContract with address:", contractAddresses.MockPriceOracle);
        mockPriceOracleContract = new ethers.Contract(contractAddresses.MockPriceOracle, mockPriceOracleAbi, signer);
        console.log("mockPriceOracleContract instantiated. Object:", mockPriceOracleContract);
        
        // No need for full contracts for these if only addresses are displayed
        // mockUniswapRouterContract = new ethers.Contract(contractAddresses.MockUniswapV2Router02, [], signer); 
        // merchantGatewayContract = new ethers.Contract(contractAddresses.MerchantGateway, [], signer);

        console.log("Final check of instantiated contracts before reporting:");
        console.log("  - treasuryContract:", treasuryContract);
        console.log("  - sweatCoinContract:", sweatCoinContract);
        console.log("  - mockPriceOracleContract:", mockPriceOracleContract);


        console.log("Contracts initialized:", {
            treasury: treasuryContract,
            sweatCoin: sweatCoinContract,
            mockPriceOracle: mockPriceOracleContract
        });


    } catch (error) {
        console.error("Error initializing contracts:", error);
        showStatus('stabilizeStatus', `Contract initialization failed: ${error.message}`, 'error');
    }
}

// --- Dashboard Functions ---

async function loadTreasuryDashboard() {
    if (!treasuryContract || !currentAccount) {
        console.warn("Treasury contract not initialized or account not connected.");
        return;
    }

    try {
        // Ensure the provider's network is fully resolved before making calls
        console.log("DEBUG: Awaiting provider.getNetwork() to ensure network is resolved.");
        const network = await signer.provider.getNetwork();
        console.log("DEBUG: Provider network resolved:", network);
        
        // --- Balances ---
        console.log("DEBUG: Provider object state:", provider);
        console.log("DEBUG: Signer object state:", signer);
        console.log("DEBUG: Attempting to get ETH balance for address:", contractAddresses.Treasury);
        const resolvedTreasuryAddress = ethers.getAddress(contractAddresses.Treasury); // Explicitly resolve
        console.log("DEBUG: Resolved Treasury Address for getBalance:", resolvedTreasuryAddress);
        
        const ethBalance = await signer.provider.getBalance(resolvedTreasuryAddress); // Use signer's provider
        document.getElementById('ethBalance').textContent = `${ethers.formatEther(ethBalance)} ETH`;

        const sweatBalance = await sweatCoinContract.balanceOf(treasuryContract.address);
        document.getElementById('sweatBalance').textContent = `${ethers.formatEther(sweatBalance)} SWEAT`;

        // --- Price & Stability ---
        const sweatPriceUSD = await treasuryContract.getSweatPriceUsd();
        document.getElementById('sweatPriceUSD').textContent = `$${ethers.formatEther(sweatPriceUSD)}`;
        const needsStability = await treasuryContract.checkPriceStability();
        document.getElementById('stabilityNeeded').textContent = needsStability ? 'YES' : 'NO';
        document.getElementById('stabilityNeeded').style.color = needsStability ? 'red' : 'green';


        try {
            const treasurySweatCoinAddress = await treasuryContract.sweatCoin();
            console.log("DEBUG: treasuryContract.sweatCoin() returned:", treasurySweatCoinAddress);
            document.getElementById('sweatCoinAddress').textContent = formatAddress(treasurySweatCoinAddress);
        } catch (e) {
            console.error("ERROR fetching treasuryContract.sweatCoin():", e);
            document.getElementById('sweatCoinAddress').textContent = `Error: ${e.message}`;
        }

        try {
            const treasuryMerchantGatewayAddress = await treasuryContract.merchantGateway();
            console.log("DEBUG: treasuryContract.merchantGateway() returned:", treasuryMerchantGatewayAddress);
            document.getElementById('merchantGatewayAddress').textContent = formatAddress(treasuryMerchantGatewayAddress);
        } catch (e) {
            console.error("ERROR fetching treasuryContract.merchantGateway():", e);
            document.getElementById('merchantGatewayAddress').textContent = `Error: ${e.message}`;
        }

        try {
            const treasuryPriceOracleAddress = await treasuryContract.priceOracle();
            console.log("DEBUG: treasuryContract.priceOracle() returned:", treasuryPriceOracleAddress);
            document.getElementById('priceOracleAddress').textContent = formatAddress(treasuryPriceOracleAddress);
        } catch (e) {
            console.error("ERROR fetching treasuryContract.priceOracle():", e);
            document.getElementById('priceOracleAddress').textContent = `Error: ${e.message}`;
        }

        try {
            const treasuryUniswapRouterAddress = await treasuryContract.uniswapRouter();
            console.log("DEBUG: treasuryContract.uniswapRouter() returned:", treasuryUniswapRouterAddress);
            document.getElementById('uniswapRouterAddress').textContent = formatAddress(treasuryUniswapRouterAddress);
        } catch (e) {
            console.error("ERROR fetching treasuryContract.uniswapRouter():", e);
            document.getElementById('uniswapRouterAddress').textContent = `Error: ${e.message}`;
        }
        
        try {
            const defaultSubsidyEth = await treasuryContract.defaultMerchantSubsidyETH();
            console.log("DEBUG: treasuryContract.defaultMerchantSubsidyETH() returned:", defaultSubsidyEth);
            document.getElementById('defaultMerchantSubsidyETH').textContent = `${ethers.formatEther(defaultSubsidyEth)} ETH`;
        } catch (e) {
            console.error("ERROR fetching treasuryContract.defaultMerchantSubsidyETH():", e);
            document.getElementById('defaultMerchantSubsidyETH').textContent = `Error: ${e.message}`;
        }
        
        try {
            const treasurySweatFeePercentage = await treasuryContract.treasurySweatFeePercentage();
            console.log("DEBUG: treasuryContract.treasurySweatFeePercentage() returned:", treasurySweatFeePercentage);
            document.getElementById('treasurySweatFeePercentage').textContent = `${treasurySweatFeePercentage}%`;
        } catch (e) {
            console.error("ERROR fetching treasuryContract.treasurySweatFeePercentage():", e);
            document.getElementById('treasurySweatFeePercentage').textContent = `Error: ${e.message}`;
        }
        
        try {
            const burnRatePercentage = await treasuryContract.burnRatePercentage();
            console.log("DEBUG: treasuryContract.burnRatePercentage() returned:", burnRatePercentage);
            document.getElementById('burnRatePercentage').textContent = `${burnRatePercentage}%`;
        } catch (e) {
            console.error("ERROR fetching treasuryContract.burnRatePercentage():", e);
            document.getElementById('burnRatePercentage').textContent = `Error: ${e.message}`;
        }
        
        try {
            const merchantSweatPercentage = await treasuryContract.merchantSweatPercentage();
            console.log("DEBUG: treasuryContract.merchantSweatPercentage() returned:", merchantSweatPercentage);
            document.getElementById('merchantSweatPercentage').textContent = `${merchantSweatPercentage}%`;
        } catch (e) {
            console.error("ERROR fetching treasuryContract.merchantSweatPercentage():", e);
            document.getElementById('merchantSweatPercentage').textContent = `Error: ${e.message}`;
        }

    } catch (error) {
        console.error("Error loading Treasury dashboard:", error);
        showStatus('stabilizeStatus', `Failed to load dashboard: ${error.message}`, 'error');
    }
}

// --- Admin Actions ---

async function withdrawEth() {
    if (!treasuryContract || !currentAccount) {
        showStatus('withdrawStatus', 'Please connect your wallet first.', 'error');
        return;
    }
    const amountEth = document.getElementById('withdrawEthAmount').value;
    const recipient = document.getElementById('withdrawEthRecipient').value;

    if (!amountEth || !recipient) {
        showStatus('withdrawStatus', 'Please enter amount and recipient.', 'error');
        return;
    }

    try {
        showStatus('withdrawStatus', 'Withdrawing ETH...', 'info');
        const amountWei = ethers.parseEther(amountEth);
        const tx = await treasuryContract.withdrawEth(recipient, amountWei);
        await tx.wait();
        showStatus('withdrawStatus', `Successfully withdrew ${amountEth} ETH to ${formatAddress(recipient)}!`, 'success');
        await loadTreasuryDashboard();
    } catch (error) {
        console.error("Error withdrawing ETH:", error);
        showStatus('withdrawStatus', `Withdrawal failed: ${error.message}`, 'error');
    }
}

async function stabilizePrice() {
    if (!treasuryContract || !currentAccount) {
        showStatus('stabilizeStatus', 'Please connect your wallet first.', 'error');
        return;
    }

    try {
        showStatus('stabilizeStatus', 'Attempting to stabilize price...', 'info');
        const tx = await treasuryContract.stabilizePrice();
        await tx.wait();
        showStatus('stabilizeStatus', 'Price stabilization executed!', 'success');
        await loadTreasuryDashboard();
    } catch (error) {
        console.error("Error stabilizing price:", error);
        showStatus('stabilizeStatus', `Price stabilization failed: ${error.message}`, 'error');
    }
}

async function updateDefaultMerchantSubsidyEth() {
    if (!treasuryContract || !currentAccount) {
        showStatus('updateSubsidyStatus', 'Please connect your wallet first.', 'error');
        return;
    }
    const newSubsidy = document.getElementById('newDefaultMerchantSubsidyEth').value;
    if (!newSubsidy) {
        showStatus('updateSubsidyStatus', 'Please enter a new subsidy amount.', 'error');
        return;
    }
    try {
        showStatus('updateSubsidyStatus', 'Updating default merchant subsidy...', 'info');
        const newSubsidyWei = ethers.parseEther(newSubsidy);
        const tx = await treasuryContract.updateDefaultMerchantSubsidyEth(newSubsidyWei);
        await tx.wait();
        showStatus('updateSubsidyStatus', `Default subsidy updated to ${newSubsidy} ETH.`, 'success');
        await loadTreasuryDashboard();
    } catch (error) {
        console.error("Error updating subsidy:", error);
        showStatus('updateSubsidyStatus', `Update failed: ${error.message}`, 'error');
    }
}

async function updateTreasurySweatFeePercentage() {
    if (!treasuryContract || !currentAccount) {
        showStatus('updateTreasuryFeeStatus', 'Please connect your wallet first.', 'error');
        return;
    }
    const newPercentage = document.getElementById('newTreasurySweatFeePercentage').value;
    if (!newPercentage) {
        showStatus('updateTreasuryFeeStatus', 'Please enter a new percentage.', 'error');
        return;
    }
    try {
        showStatus('updateTreasuryFeeStatus', 'Updating treasury SWEAT fee percentage...', 'info');
        const tx = await treasuryContract.updateTreasurySweatFeePercentage(newPercentage);
        await tx.wait();
        showStatus('updateTreasuryFeeStatus', `Treasury SWEAT fee updated to ${newPercentage}%.`, 'success');
        await loadTreasuryDashboard();
    } catch (error) {
        console.error("Error updating treasury fee:", error);
        showStatus('updateTreasuryFeeStatus', `Update failed: ${error.message}`, 'error');
    }
}

async function updateBurnRatePercentage() {
    if (!treasuryContract || !currentAccount) {
        showStatus('updateBurnRateStatus', 'Please connect your wallet first.', 'error');
        return;
    }
    const newPercentage = document.getElementById('newBurnRatePercentage').value;
    if (!newPercentage) {
        showStatus('updateBurnRateStatus', 'Please enter a new percentage.', 'error');
        return;
    }
    try {
        showStatus('updateBurnRateStatus', 'Updating burn rate percentage...', 'info');
        const tx = await treasuryContract.updateBurnRatePercentage(newPercentage);
        await tx.wait();
        showStatus('updateBurnRateStatus', `Burn rate updated to ${newPercentage}%.`, 'success');
        await loadTreasuryDashboard();
    } catch (error) {
        console.error("Error updating burn rate:", error);
        showStatus('updateBurnRateStatus', `Update failed: ${error.message}`, 'error');
    }
}

async function updateMerchantSweatPercentage() {
    if (!treasuryContract || !currentAccount) {
        showStatus('updateMerchantShareStatus', 'Please connect your wallet first.', 'error');
        return;
    }
    const newPercentage = document.getElementById('newMerchantSweatPercentage').value;
    if (!newPercentage) {
        showStatus('updateMerchantShareStatus', 'Please enter a new percentage.', 'error');
        return;
    }
    try {
        showStatus('updateMerchantShareStatus', 'Updating merchant SWEAT share percentage...', 'info');
        const tx = await treasuryContract.updateMerchantSweatPercentage(newPercentage);
        await tx.wait();
        showStatus('updateMerchantShareStatus', `Merchant SWEAT share updated to ${newPercentage}%.`, 'success');
        await loadTreasuryDashboard();
    } catch (error) {
        console.error("Error updating merchant share:", error);
        showStatus('updateMerchantShareStatus', `Update failed: ${error.message}`, 'error');
    }
}

async function updatePriceOracle() {
    if (!treasuryContract || !currentAccount) {
        showStatus('updateOracleStatus', 'Please connect your wallet first.', 'error');
        return;
    }
    const newAddress = document.getElementById('newPriceOracleAddress').value;
    if (!newAddress || !ethers.isAddress(newAddress)) {
        showStatus('updateOracleStatus', 'Please enter a valid address.', 'error');
        return;
    }
    try {
        showStatus('updateOracleStatus', 'Updating price oracle address...', 'info');
        const tx = await treasuryContract.updatePriceOracle(newAddress);
        await tx.wait();
        showStatus('updateOracleStatus', `Price oracle address updated to ${formatAddress(newAddress)}.`, 'success');
        await loadTreasuryDashboard();
    } catch (error) {
        console.error("Error updating price oracle:", error);
        showStatus('updateOracleStatus', `Update failed: ${error.message}`, 'error');
    }
}

async function updateUniswapRouter() {
    if (!treasuryContract || !currentAccount) {
        showStatus('updateRouterStatus', 'Please connect your wallet first.', 'error');
        return;
    }
    const newAddress = document.getElementById('newUniswapRouterAddress').value;
    if (!newAddress || !ethers.isAddress(newAddress)) {
        showStatus('updateRouterStatus', 'Please enter a valid address.', 'error');
        return;
    }
    try {
        showStatus('updateRouterStatus', 'Updating Uniswap router address...', 'info');
        const tx = await treasuryContract.updateUniswapRouter(newAddress);
        await tx.wait();
        showStatus('updateRouterStatus', `Uniswap router address updated to ${formatAddress(newAddress)}.`, 'success');
        await loadTreasuryDashboard();
    } catch (error) {
        console.error("Error updating router:", error);
        showStatus('updateRouterStatus', `Update failed: ${error.message}`, 'error');
    }
}

async function setSweatCoinAddress() {
    if (!treasuryContract || !currentAccount) {
        showStatus('setSweatCoinStatus', 'Please connect your wallet first.', 'error');
        return;
    }
    const newAddress = document.getElementById('setSweatCoinAddress').value;
    if (!newAddress || !ethers.isAddress(newAddress)) {
        showStatus('setSweatCoinStatus', 'Please enter a valid address.', 'error');
        return;
    }
    try {
        showStatus('setSweatCoinStatus', 'Setting SweatCoin token address...', 'info');
        const tx = await treasuryContract.setSweatCoinAddress(newAddress);
        await tx.wait();
        showStatus('setSweatCoinStatus', `SweatCoin token address set to ${formatAddress(newAddress)}.`, 'success');
        await loadTreasuryDashboard();
    } catch (error) {
        console.error("Error setting SweatCoin address:", error);
        showStatus('setSweatCoinStatus', `Setting address failed: ${error.message}`, 'error');
    }
}

async function setMerchantGatewayAddress() {
    if (!treasuryContract || !currentAccount) {
        showStatus('setMerchantGatewayStatus', 'Please connect your wallet first.', 'error');
        return;
    }
    const newAddress = document.getElementById('setMerchantGatewayAddress').value;
    if (!newAddress || !ethers.isAddress(newAddress)) {
        showStatus('setMerchantGatewayStatus', 'Please enter a valid address.', 'error');
        return;
    }
    try {
        showStatus('setMerchantGatewayStatus', 'Setting MerchantGateway address...', 'info');
        const tx = await treasuryContract.setMerchantGatewayAddress(newAddress);
        await tx.wait();
        showStatus('setMerchantGatewayStatus', `MerchantGateway address set to ${formatAddress(newAddress)}.`, 'success');
        await loadTreasuryDashboard();
    } catch (error) {
        console.error("Error setting MerchantGateway address:", error);
        showStatus('setMerchantGatewayStatus', `Setting address failed: ${error.message}`, 'error');
    }
}


// --- Main Initialization ---
window.addEventListener('load', initWeb3);
