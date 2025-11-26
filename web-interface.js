/**
 * FitDAO Web Interface Example
 * This shows how your frontend (HTML/JavaScript) connects to the Solidity smart contracts
 * 
 * Tech Stack:
 * - Ethers.js (for blockchain interaction)
 * - MetaMask (user's wallet)
 * - Your deployed smart contracts
 */

// ============================================
// 1. SETUP & CONFIGURATION
// ============================================

// Contract addresses (from your deployment)
// After (Sepolia addresses):
const SWEAT_COIN_ADDRESS = "0xa0B863DEe8610572b9fbab88CCCC3a12e4D31290";
const HEALTH_REWARDS_ENGINE_ADDRESS = "0x957801F274F3EaADc94efD07371bdb0104740A4E";

// Contract ABIs (auto-generated when you compile your Solidity code)
// In reality, these are MUCH longer - simplified for this example
const SWEAT_COIN_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function totalSupply() view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const HEALTH_REWARDS_ENGINE_ABI = [
  "function getUserBalance(address user) view returns (uint256)",
  "function lastRewardTime(address user) view returns (uint256)",
  "function stepsRewardRate() view returns (uint256)",
  "function sleepRewardRate() view returns (uint256)",
  "function exerciseRewardRate() view returns (uint256)",
  "event RewardIssued(address indexed user, uint256 amount, string reason)"
];

// ============================================
// 2. CONNECT TO WALLET (MetaMask)
// ============================================

let provider;
let signer;
let userAddress;
let sweatCoinContract;
let healthRewardsContract;

async function connectWallet() {
  try {
    // Check if MetaMask is installed
    if (typeof window.ethereum === 'undefined') {
      alert('Please install MetaMask to use this dApp!');
      return;
    }

    // Request account access
    const accounts = await window.ethereum.request({ 
      method: 'eth_requestAccounts' 
    });
    
    userAddress = accounts[0];
    console.log('Connected wallet:', userAddress);

    // Create provider and signer
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();

    // Initialize contract instances using the interfaces
    sweatCoinContract = new ethers.Contract(
      SWEAT_COIN_ADDRESS,
      SWEAT_COIN_ABI,
      signer  // Signer allows us to send transactions
    );

    healthRewardsContract = new ethers.Contract(
      HEALTH_REWARDS_ENGINE_ADDRESS,
      HEALTH_REWARDS_ENGINE_ABI,
      signer
    );

    // Update UI
    document.getElementById('walletAddress').textContent = 
      userAddress.substring(0, 6) + '...' + userAddress.substring(38);
    
    document.getElementById('connectButton').textContent = 'Connected';
    document.getElementById('connectButton').disabled = true;

    // Load user data
    await loadUserData();

  } catch (error) {
    console.error('Error connecting wallet:', error);
    alert('Failed to connect wallet: ' + error.message);
  }
}

// ============================================
// 3. READ DATA FROM BLOCKCHAIN (View Functions)
// ============================================

async function loadUserData() {
  try {
    console.log("Loading user data...");
    console.log("User address:", userAddress);
    console.log("SweatCoin contract:", SWEAT_COIN_ADDRESS);
    console.log("Provider:", provider);
    // Get user's SweatCoin balance
    // This calls the balanceOf() function in SweatCoinToken.sol
    console.log("Fetching balance...");
    const balance = await sweatCoinContract.balanceOf(userAddress);
    console.log("Raw balance:", balance.toString());
    const balanceFormatted = ethers.formatEther(balance); // Convert from Wei
    console.log("Formatted balance:", balanceFormatted);
    document.getElementById('tokenBalance').textContent = 
      `${balanceFormatted} SWEAT`;

    // Get reward rates from HealthRewardsEngine
    const stepsRate = await healthRewardsContract.stepsRewardRate();
    const sleepRate = await healthRewardsContract.sleepRewardRate();
    const exerciseRate = await healthRewardsContract.exerciseRewardRate();

    document.getElementById('stepsRate').textContent = 
      ethers.formatEther(stepsRate) + ' SWEAT per 1000 steps';
    document.getElementById('sleepRate').textContent = 
      ethers.formatEther(sleepRate) + ' SWEAT per good sleep';
    document.getElementById('exerciseRate').textContent = 
      ethers.formatEther(exerciseRate) + ' SWEAT per 30 min workout';

    // Get last reward time
    const lastReward = await healthRewardsContract.lastRewardTime(userAddress);
    const lastRewardDate = new Date(Number(lastReward) * 1000);
    
    document.getElementById('lastReward').textContent = 
      lastReward > 0 ? lastRewardDate.toLocaleString() : 'Never';

    console.log('User data loaded successfully');

  } catch (error) {
    console.error('Error loading user data:', error);
  }
}

// ============================================
// 4. WRITE TO BLOCKCHAIN (Transaction Functions)
// ============================================

async function transferTokens() {
  try {
    const recipientAddress = document.getElementById('recipientAddress').value;
    const amount = document.getElementById('transferAmount').value;

    // Validate inputs
    if (!ethers.isAddress(recipientAddress)) {
      alert('Invalid recipient address');
      return;
    }

    // Convert amount to Wei (18 decimals)
    const amountInWei = ethers.parseEther(amount);

    // Show loading
    document.getElementById('transferStatus').textContent = 'Sending transaction...';

    // Call the transfer function in SweatCoinToken.sol
    const tx = await sweatCoinContract.transfer(recipientAddress, amountInWei);
    
    document.getElementById('transferStatus').textContent = 
      'Transaction sent! Waiting for confirmation...';

    // Wait for transaction to be mined
    const receipt = await tx.wait();

    document.getElementById('transferStatus').textContent = 
      `Success! Transaction hash: ${receipt.hash}`;

    // Reload balance
    await loadUserData();

  } catch (error) {
    console.error('Error transferring tokens:', error);
    document.getElementById('transferStatus').textContent = 
      'Error: ' + error.message;
  }
}

// ============================================
// 5. LISTEN TO EVENTS (Real-time Updates)
// ============================================

function setupEventListeners() {
  // Listen for RewardIssued events from HealthRewardsEngine
  healthRewardsContract.on("RewardIssued", (user, amount, reason, event) => {
    if (user.toLowerCase() === userAddress.toLowerCase()) {
      const amountFormatted = ethers.formatEther(amount);
      
      // Show notification
      showNotification(
        `You earned ${amountFormatted} SWEAT! Reason: ${reason}`
      );

      // Reload balance
      loadUserData();
    }
  });

  // Listen for Transfer events from SweatCoin token
  sweatCoinContract.on("Transfer", (from, to, value, event) => {
    if (from.toLowerCase() === userAddress.toLowerCase() || 
        to.toLowerCase() === userAddress.toLowerCase()) {
      
      const amountFormatted = ethers.formatEther(value);
      const message = from.toLowerCase() === userAddress.toLowerCase()
        ? `Sent ${amountFormatted} SWEAT`
        : `Received ${amountFormatted} SWEAT`;
      
      showNotification(message);
      loadUserData();
    }
  });

  console.log('Event listeners set up');
}

function showNotification(message) {
  const notificationDiv = document.getElementById('notifications');
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  notificationDiv.appendChild(notification);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

// ============================================
// 6. HELPER FUNCTIONS
// ============================================

async function refreshData() {
  document.getElementById('refreshButton').disabled = true;
  document.getElementById('refreshButton').textContent = 'Refreshing...';
  
  await loadUserData();
  
  document.getElementById('refreshButton').disabled = false;
  document.getElementById('refreshButton').textContent = 'Refresh';
}

// ============================================
// 7. INITIALIZATION
// ============================================

// Run when page loads
window.addEventListener('load', () => {
  // Check if already connected
  if (window.ethereum && window.ethereum.selectedAddress) {
    connectWallet();
  }

  // Listen for account changes
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length > 0) {
        window.location.reload();
      }
    });

    window.ethereum.on('chainChanged', () => {
      window.location.reload();
    });
  }
});

// ============================================
// EXPORT FUNCTIONS FOR HTML BUTTONS
// ============================================
window.connectWallet = connectWallet;
window.transferTokens = transferTokens;
window.refreshData = refreshData;
