// ============================================
// Configuration (addresses loaded from latest deployment JSON)
// ============================================
let SWEAT_COIN_ADDRESS;
let HEALTH_REWARDS_ENGINE_ADDRESS;
let EXPECTED_NETWORK; // e.g. "sepolia", "localhost"

// Minimal ABIs
const SWEAT_COIN_ABI = [
    "function balanceOf(address account) view returns (uint256)"
];

const HEALTH_REWARDS_ENGINE_ABI = [
    "function submitSelfReportedData(uint256 steps, bool goodSleep, uint256 exerciseMinutes)",
    "function lastRewardTime(address user) view returns (uint256)",
    "function rewardCooldown() view returns (uint256)",
    "function getUserBalance(address user) view returns (uint256)",
    "event RewardIssued(address indexed user, uint256 amount, string reason)"
];

// ============================================
// Global State
// ============================================
let provider;
let signer;
let userAddress;
let sweatCoinContract;
let healthRewardsContract;
let isConnected = false;
let isSubmitting = false;
let onChainBalance = 0;
let onChainLastReward = 0;

// Mock data fallbacks
let mockBalance = 125.5;
let mockTotalEarned = 450.0;
let mockRedeemed = 324.5;
let activityLog = [];

const mockCoupons = [
    { id: 1, merchant: "FitMart", title: "$40 Fitness Equipment", price: 40, description: "Get $40 off on any fitness equipment", image: "🏋️" },
    { id: 2, merchant: "HealthFood Co", title: "$25 Organic Groceries", price: 25, description: "Save $25 on organic food items", image: "🥗" },
    { id: 3, merchant: "GymPro", title: "$50 Gym Membership", price: 50, description: "One month free gym membership", image: "💪" },
    { id: 4, merchant: "Wellness Spa", title: "$30 Spa Treatment", price: 30, description: "Relaxing spa day package", image: "🧘" },
    { id: 5, merchant: "Sports Store", title: "$35 Running Shoes", price: 35, description: "Premium running shoes discount", image: "👟" },
    { id: 6, merchant: "Nutrition Plus", title: "$20 Supplements", price: 20, description: "Health supplements bundle", image: "💊" }
];

// ============================================
// Initialization
// ============================================
async function init() {
    // Try to load addresses from views/config/addresses-<network>.json
    try {
        if (typeof window.loadContractAddresses === 'function') {
            const cfg = await window.loadContractAddresses();
            if (cfg && cfg.SweatCoinToken && cfg.HealthRewardsEngine) {
                SWEAT_COIN_ADDRESS = cfg.SweatCoinToken;
                HEALTH_REWARDS_ENGINE_ADDRESS = cfg.HealthRewardsEngine;
                EXPECTED_NETWORK = cfg.network || EXPECTED_NETWORK;
                console.log('[FitDAO] Loaded contract addresses from config:', cfg);
            } else {
                console.warn('[FitDAO] Contract config missing or incomplete. Using existing hardcoded addresses if any.');
            }
        } else {
            console.warn('[FitDAO] loadContractAddresses helper not found. Using existing hardcoded addresses if any.');
        }
    } catch (e) {
        console.error('[FitDAO] Failed to load contract addresses:', e);
    }

    updateBalanceUI();
    renderCoupons();
    setupHealthDataInputs();
}

function updateBalanceUI() {
    if (isConnected) {
        document.getElementById('tokenBalance').textContent = `${onChainBalance.toFixed(4)} SWEAT`;
        document.getElementById('totalEarned').textContent = `${onChainBalance.toFixed(4)} SWEAT`;
    } else {
        document.getElementById('tokenBalance').textContent = mockBalance.toFixed(2) + ' SWEAT';
        document.getElementById('totalEarned').textContent = mockTotalEarned.toFixed(2) + ' SWEAT';
    }
    document.getElementById('redeemedThisMonth').textContent = mockRedeemed.toFixed(2) + ' SWEAT';
}

function setupHealthDataInputs() {
    const inputs = ['steps', 'sleep', 'exercise', 'heartRate'];
    inputs.forEach(id => {
        document.getElementById(id).addEventListener('input', calculateReward);
    });
}

function calculateReward() {
    const steps = parseInt(document.getElementById('steps').value) || 0;
    const sleep = parseFloat(document.getElementById('sleep').value) || 0;
    const exercise = parseInt(document.getElementById('exercise').value) || 0;

    let reward = 0;
    if (steps >= 1000) reward += (steps / 1000) * 1; // 1 SWEAT per 1000 steps
    if (sleep >= 7) reward += 5; // 5 SWEAT for good sleep
    if (exercise >= 30) reward += (exercise / 30) * 10; // 10 SWEAT per 30 min exercise

    const preview = document.getElementById('rewardPreview');
    if (reward > 0) {
        preview.style.display = 'block';
        document.getElementById('estimatedReward').textContent = reward.toFixed(2) + ' SWEAT';
    } else {
        preview.style.display = 'none';
    }
}

async function submitHealthData() {
    const steps = parseInt(document.getElementById('steps').value) || 0;
    const sleep = parseFloat(document.getElementById('sleep').value) || 0;
    const exercise = parseInt(document.getElementById('exercise').value) || 0;
    const heartRate = parseInt(document.getElementById('heartRate').value) || 0;

    if (steps === 0 && sleep === 0 && exercise === 0) {
        showStatus('submitStatus', 'Please enter at least one health metric', 'error');
        return;
    }

    if (!isConnected || !healthRewardsContract) {
        showStatus('submitStatus', 'Connect your wallet to submit data on-chain.', 'error');
        return;
    }

    if (isSubmitting) {
        return;
    }

    const goodSleep = sleep >= 7;
    isSubmitting = true;
    showStatus('submitStatus', 'Submitting data on-chain...', 'info');

    try {
        const tx = await healthRewardsContract.submitSelfReportedData(
            BigInt(steps),
            goodSleep,
            BigInt(exercise)
        );

        addActivity(`Submitted health data. Waiting for confirmation...`, 'info');
        const receipt = await tx.wait();

        let rewardEarned = null;
        for (const log of receipt.logs) {
            try {
                const parsed = healthRewardsContract.interface.parseLog(log);
                if (parsed && parsed.name === 'RewardIssued') {
                    rewardEarned = Number(ethers.formatEther(parsed.args.amount));
                    break;
                }
            } catch (err) {
                // ignore logs that do not belong to this contract
            }
        }

        const rewardMessage = rewardEarned !== null
            ? ` You earned ${rewardEarned.toFixed(4)} SWEAT! 🎉`
            : '';

        if (rewardEarned !== null) {
            onChainBalance += rewardEarned;
            updateBalanceUI();
            renderCoupons();
        } else {
            await refreshOnChainState();
        }

        showStatus('submitStatus', `Transaction confirmed.${rewardMessage}`, 'success');
        addActivity(`On-chain health data submission confirmed.${rewardMessage}`, 'success');

        document.getElementById('steps').value = '';
        document.getElementById('sleep').value = '';
        document.getElementById('exercise').value = '';
        document.getElementById('heartRate').value = '';
        document.getElementById('rewardPreview').style.display = 'none';
    } catch (error) {
        console.error('Error submitting health data:', error);
        const reason = parseRpcError(error);
        showStatus('submitStatus', reason, 'error');
        addActivity(`Submission failed: ${reason}`, 'error');
    } finally {
        isSubmitting = false;
    }
}

function renderCoupons() {
    const grid = document.getElementById('couponGrid');
    grid.innerHTML = '';

    const availableBalance = isConnected ? onChainBalance : mockBalance;

    mockCoupons.forEach(coupon => {
        const card = document.createElement('div');
        card.className = 'coupon-card';
        card.innerHTML = `
            <div style="font-size: 2em; margin-bottom: 10px;">${coupon.image}</div>
            <h3>${coupon.title}</h3>
            <div class="price">${coupon.price} SWEAT</div>
            <div class="description">${coupon.description}</div>
            <div style="font-size: 0.85em; opacity: 0.8; margin-bottom: 10px;">by ${coupon.merchant}</div>
            <button onclick="redeemCoupon(${coupon.id})" 
                    style="width: 100%; background: rgba(255,255,255,0.3); border: 2px solid white;"
                    ${availableBalance < coupon.price ? 'disabled' : ''}>
                ${availableBalance < coupon.price ? 'Insufficient Balance' : 'Redeem Now'}
            </button>
        `;
        grid.appendChild(card);
    });
}

function redeemCoupon(couponId) {
    const coupon = mockCoupons.find(c => c.id === couponId);
    if (!coupon) return;

    if (isConnected) {
        if (onChainBalance < coupon.price) {
            showStatus('submitStatus', 'On-chain SWEAT balance is insufficient for this coupon.', 'error');
            return;
        }
        mockRedeemed += coupon.price;
        addActivity(`Redeemed (demo) ${coupon.price} SWEAT for: ${coupon.title}. Please complete on-chain transfer via merchant portal.`, 'info');
        showStatus('submitStatus', `Mock redemption recorded. Tokens are not deducted on-chain.`, 'success');
        document.getElementById('redeemedThisMonth').textContent = `${mockRedeemed.toFixed(2)} SWEAT`;
    } else {
        if (mockBalance < coupon.price) {
            showStatus('submitStatus', 'Insufficient SWEAT balance', 'error');
            return;
        }
        mockBalance -= coupon.price;
        mockRedeemed += coupon.price;
        addActivity(`Redeemed ${coupon.price} SWEAT for: ${coupon.title}`, 'info');
        updateBalanceUI();
        showStatus('submitStatus', `Successfully redeemed ${coupon.title}! Check your email for the coupon code.`, 'success');
    }
    renderCoupons();
}

function addActivity(message, type) {
    const log = document.getElementById('activityLog');
    const item = document.createElement('div');
    item.className = 'activity-item';
    let badge = '<span class="badge badge-info">INFO</span>';
    if (type === 'success') {
        badge = '<span class="badge badge-success">EARNED</span>';
    } else if (type === 'error') {
        badge = '<span class="badge badge-error">ALERT</span>';
    }
    item.innerHTML = `
        <div>${message} ${badge}</div>
        <div class="activity-time">${new Date().toLocaleString()}</div>
    `;
    log.insertBefore(item, log.firstChild);

    // Keep only last 10 items
    while (log.children.length > 10) {
        log.removeChild(log.lastChild);
    }
}

function showStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `status-message ${type}`;
    element.style.display = 'block';

    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

// ============================================
// Wallet / Contract Integration
// ============================================
async function connectWallet() {
    try {
        if (typeof window.ethereum === 'undefined') {
            showStatus('submitStatus', 'MetaMask is required to connect your wallet.', 'error');
            return;
        }

        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAddress = accounts[0];

        provider = new ethers.BrowserProvider(window.ethereum);

        // Enforce expected network (from addresses config) to avoid mainnet by accident
        if (EXPECTED_NETWORK) {
            const net = await provider.getNetwork();
            const currentName = net.name || net.chainId?.toString();
            if (currentName && currentName.toLowerCase() !== EXPECTED_NETWORK.toLowerCase()) {
                showStatus(
                    'submitStatus',
                    `Wrong network: connected to ${currentName}, but this dApp is configured for ${EXPECTED_NETWORK}. Please switch network in MetaMask.`,
                    'error'
                );
                return;
            }
        }

        signer = await provider.getSigner();
        userAddress = await signer.getAddress();

        sweatCoinContract = new ethers.Contract(SWEAT_COIN_ADDRESS, SWEAT_COIN_ABI, signer);
        healthRewardsContract = new ethers.Contract(HEALTH_REWARDS_ENGINE_ADDRESS, HEALTH_REWARDS_ENGINE_ABI, signer);

        isConnected = true;
        document.getElementById('walletAddress').textContent =
            userAddress.substring(0, 6) + '...' + userAddress.substring(userAddress.length - 4);
        document.getElementById('connectButton').textContent = 'Connected';
        document.getElementById('connectButton').disabled = true;

        await refreshOnChainState();
        addActivity('Wallet connected. Ready to submit data on-chain.', 'info');
        setupContractEventListeners();

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', () => window.location.reload());
    } catch (error) {
        console.error('Wallet connection failed:', error);
        const reason = parseRpcError(error);
        showStatus('submitStatus', reason, 'error');
    }
}

async function refreshOnChainState() {
    if (!sweatCoinContract || !healthRewardsContract) return;

    try {
        const [balance, lastReward] = await Promise.all([
            sweatCoinContract.balanceOf(userAddress),
            healthRewardsContract.lastRewardTime(userAddress)
        ]);

        onChainBalance = Number(ethers.formatEther(balance));
        onChainLastReward = Number(lastReward);
        updateBalanceUI();
        renderCoupons();
    } catch (error) {
        console.error('Failed to refresh on-chain state:', error);
    }
}

function setupContractEventListeners() {
    if (!healthRewardsContract) return;
    healthRewardsContract.removeAllListeners("RewardIssued");

    healthRewardsContract.on("RewardIssued", (user, amount, reason) => {
        if (!userAddress || user.toLowerCase() !== userAddress.toLowerCase()) return;
        const formatted = Number(ethers.formatEther(amount));
        addActivity(`On-chain reward: +${formatted.toFixed(4)} SWEAT (${reason})`, 'success');
        refreshOnChainState();
    });
}

function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        isConnected = false;
        userAddress = null;
        document.getElementById('walletAddress').textContent = 'Not Connected';
        document.getElementById('connectButton').textContent = 'Connect Wallet';
        document.getElementById('connectButton').disabled = false;
        addActivity('Wallet disconnected.', 'info');
        updateBalanceUI();
    } else if (accounts[0].toLowerCase() !== userAddress?.toLowerCase()) {
        window.location.reload();
    }
}

function parseRpcError(error) {
    if (!error) return 'Transaction failed.';
    if (error.error && error.error.message) return error.error.message;
    if (error.reason) return error.reason;
    if (error.message) {
        if (error.message.includes('Reward cooldown not met')) {
            const waitSeconds = Math.max(0, (onChainLastReward + 3600) - Math.floor(Date.now() / 1000));
            const minutes = Math.ceil(waitSeconds / 60);
            return `Reward cooldown not met. Please try again in ~${minutes} minute(s).`;
        }
        return error.message;
    }
    return 'Transaction failed.';
}

// Initialize on load
window.addEventListener('load', init);

