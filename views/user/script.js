// ============================================
// Configuration (addresses loaded from latest deployment JSON)
// ============================================
let SWEAT_COIN_ADDRESS;
let HEALTH_REWARDS_ENGINE_ADDRESS;
let MERCHANT_GATEWAY_ADDRESS; // New: MerchantGateway Address
let EXPECTED_NETWORK; // e.g. "sepolia", "localhost"

// Minimal ABIs
const SWEAT_COIN_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

const HEALTH_REWARDS_ENGINE_ABI = [
    "function submitSelfReportedData(uint256 steps, bool goodSleep, uint256 exerciseMinutes)",
    "function lastRewardTime(address user) view returns (uint256)",
    "function rewardCooldown() view returns (uint256)",
    "function getUserBalance(address user) view returns (uint256)",
    "event RewardIssued(address indexed user, uint256 amount, string reason)",
    "event HealthDataAggregated(uint256 indexed day, uint256 steps, uint256 sleepHours, uint256 exerciseMinutes, uint256 entryCount)"
];

const MERCHANT_GATEWAY_ABI = [
    "function getAllActiveCouponIds() view returns (uint256[] memory)",
    "function getCoupon(uint256 _couponId) view returns (tuple(uint256 id, string description, uint256 valueUSD, address merchantAddress, bool isActive, uint256 createdAt, uint256 redemptionCount) memory)",
    "function redeemCoupon(uint256 _couponId)",
    "function merchants(address) view returns (string name, address walletAddress, bool isActive, uint256 defaultCouponValueUSD, uint256 totalSweatReceived, uint256 totalEthReceived)",
    "event CouponRedeemed(address indexed user, uint256 indexed couponId, address indexed merchantAddress, uint256 sweatAmount, uint256 burnedSweat, uint256 merchantSweat, uint256 treasurySweatFee, uint256 ethSubsidyRequested)"
];

// ============================================
// Global State
// ============================================
let provider;
let signer;
let userAddress;
let sweatCoinContract;
let healthRewardsContract;
let merchantGatewayContract; // New: MerchantGateway Contract
let isConnected = false;
let isSubmitting = false;
let onChainBalance = 0n; // Changed to BigInt
let onChainLastReward = 0;

// Mock data fallbacks - These will be removed once real data is fetched
let mockBalance = 125.5;
let mockTotalEarned = 450.0;
let mockRedeemed = 324.5;
let activityLog = [];

// This mockCoupons will be replaced with on-chain data
let mockCoupons = []; // Initialize as empty, as real coupons will be fetched


// ============================================
// Initialization
// ============================================
async function init() {
    // Try to load addresses from views/config/addresses-<network>.json
    try {
        if (typeof window.loadContractAddresses === 'function') {
            const cfg = await window.loadContractAddresses();
            if (cfg && cfg.SweatCoinToken && cfg.HealthRewardsEngine && cfg.MerchantGateway) { // Add MerchantGateway to check
                SWEAT_COIN_ADDRESS = cfg.SweatCoinToken;
                HEALTH_REWARDS_ENGINE_ADDRESS = cfg.HealthRewardsEngine;
                MERCHANT_GATEWAY_ADDRESS = cfg.MerchantGateway; // Load MerchantGateway address
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
        // Format BigInt for display
        document.getElementById('tokenBalance').textContent = `${Number(ethers.formatEther(onChainBalance)).toFixed(4)} SWEAT`;
        document.getElementById('totalEarned').textContent = `${Number(ethers.formatEther(onChainBalance)).toFixed(4)} SWEAT`;
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

async function renderCoupons() {
    const grid = document.getElementById('couponGrid');
    grid.innerHTML = ''; // Clear existing coupons

    let couponsToRender = [];

    if (isConnected && merchantGatewayContract) {
        try {
            const activeCouponIds = await merchantGatewayContract.getAllActiveCouponIds();
            
            for (const id of activeCouponIds) {
                const coupon = await merchantGatewayContract.getCoupon(id);
                // Fetch merchant name for display
                const merchant = await merchantGatewayContract.merchants(coupon.merchantAddress);
                
                // Ensure only active coupons are displayed, though getAllActiveCouponIds should handle this
                if (coupon.isActive) {
                    couponsToRender.push({
                        id: Number(coupon.id),
                        merchant: merchant.name,
                        title: coupon.description, // Use description as title
                        price: Number(ethers.formatEther(coupon.valueUSD * (10n**18n))), // Convert USD value to SWEAT (1:1 peg, but needs 18 decimals)
                        description: coupon.description, // Can be extended if a separate long description exists
                        image: "🎁" // Generic image for now, could be dynamic later
                    });
                }
            }
        } catch (error) {
            console.error('Failed to fetch on-chain coupons:', error);
            showStatus('submitStatus', 'Failed to load coupons from blockchain.', 'error');
            // Fallback to mock data if on-chain fails or not connected, for development/demo
            couponsToRender = mockCoupons; 
        }
    } else {
        // Fallback to mock data if not connected
        couponsToRender = mockCoupons;
    }

    const availableBalance = isConnected ? onChainBalance : mockBalance;

    couponsToRender.forEach(coupon => {
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

async function redeemCoupon(couponId) {
    if (!isConnected || !merchantGatewayContract || !sweatCoinContract) {
        showStatus('submitStatus', 'Connect your wallet to redeem coupons on-chain.', 'error');
        return;
    }

    let couponDetails;
    try {
        couponDetails = await merchantGatewayContract.getCoupon(couponId);
    } catch (error) {
        console.error('Error fetching coupon details:', error);
        showStatus('submitStatus', 'Failed to fetch coupon details.', 'error');
        return;
    }

    if (!couponDetails || !couponDetails.isActive) {
        showStatus('submitStatus', 'Coupon not found or not active.', 'error');
        return;
    }

    const sweatAmountToRedeem = couponDetails.valueUSD * (10n**18n); // SWEAT amount (with 18 decimals)

    // onChainBalance is now a BigInt directly from the contract, so direct comparison is correct
    if (onChainBalance < sweatAmountToRedeem) { 
        showStatus('submitStatus', 'On-chain SWEAT balance is insufficient for this coupon.', 'error');
        return;
    }

    // Check allowance
    const allowance = await sweatCoinContract.allowance(userAddress, MERCHANT_GATEWAY_ADDRESS);

    if (allowance < sweatAmountToRedeem) {
        showStatus('submitStatus', 'Approving Merchant Gateway to spend SWEAT...', 'info');
        try {
            const approveTx = await sweatCoinContract.approve(MERCHANT_GATEWAY_ADDRESS, ethers.MaxUint256); // Approve max for convenience
            await approveTx.wait();
            showStatus('submitStatus', 'Approval successful. Attempting to redeem coupon...', 'success');
        } catch (error) {
            console.error('Error approving SWEAT:', error);
            const reason = parseRpcError(error);
            showStatus('submitStatus', `SWEAT approval failed: ${reason}`, 'error');
            return;
        }
    }

    showStatus('submitStatus', `Redeeming coupon ${couponDetails.description}...`, 'info');
    try {
        const redeemTx = await merchantGatewayContract.redeemCoupon(couponId);
        addActivity(`Redeeming coupon: ${couponDetails.description}. Waiting for confirmation...`, 'info');
        await redeemTx.wait();
        showStatus('submitStatus', `Successfully redeemed ${couponDetails.description}!`, 'success');
        addActivity(`On-chain redemption confirmed for: ${couponDetails.description}!`, 'success');
        await refreshOnChainState(); // Refresh balances and coupons
    } catch (error) {
        console.error('Error redeeming coupon:', error);
        const reason = parseRpcError(error);
        showStatus('submitStatus', `Coupon redemption failed: ${reason}`, 'error');
        addActivity(`Redemption failed for ${couponDetails.description}: ${reason}`, 'error');
    }
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
        merchantGatewayContract = new ethers.Contract(MERCHANT_GATEWAY_ADDRESS, MERCHANT_GATEWAY_ABI, signer); // Initialize MerchantGateway

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
    if (!sweatCoinContract || !healthRewardsContract || !merchantGatewayContract) return;

    try {
        const [balance, lastReward] = await Promise.all([
            sweatCoinContract.balanceOf(userAddress),
            healthRewardsContract.lastRewardTime(userAddress)
        ]);

        onChainBalance = balance; // Store raw BigInt balance
        onChainLastReward = Number(lastReward);
        updateBalanceUI();
        await renderCoupons(); // Make sure renderCoupons is awaited
    } catch (error) {
        console.error('Failed to refresh on-chain state:', error);
    }
}

function setupContractEventListeners() {
    if (!healthRewardsContract) return;
    healthRewardsContract.removeAllListeners("RewardIssued");
    healthRewardsContract.removeAllListeners("HealthDataAggregated");

    healthRewardsContract.on("RewardIssued", (user, amount, reason) => {
        if (!userAddress || user.toLowerCase() !== userAddress.toLowerCase()) return;
        const formatted = Number(ethers.formatEther(amount));
        addActivity(`On-chain reward: +${formatted.toFixed(4)} SWEAT (${reason})`, 'success');
        refreshOnChainState();
    });

    // Log dailyAggregates to the browser console for inspection
    healthRewardsContract.on(
        "HealthDataAggregated",
        (day, steps, sleepMinutes, exerciseMinutes, entryCount) => {
            const dayNum = Number(day);
            const dateStr = new Date(dayNum * 86400 * 1000).toISOString().slice(0, 10);
            const stepsNum = Number(steps);
            const sleepMins = Number(sleepMinutes);
            const exerciseMins = Number(exerciseMinutes);
            const entries = Number(entryCount);

            console.log("[FitDAO] HealthDataAggregated", {
                day: dayNum,
                date: dateStr,
                steps: stepsNum,
                sleepMinutes: sleepMins,
                exerciseMinutes: exerciseMins,
                entryCount: entries,
            });

            const sleepHours = (sleepMins / 60).toFixed(1);
            const exerciseHours = (exerciseMins / 60).toFixed(1);
            addActivity(
                `Daily aggregate updated for ${dateStr}: ${stepsNum.toLocaleString()} steps, ${sleepHours}h sleep, ${exerciseHours}h exercise across ${entries} entr${entries === 1 ? 'y' : 'ies'}.`,
                'info'
            );
        }
    );
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

