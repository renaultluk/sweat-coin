// Mock data
let mockBalance = 125.5;
let mockTotalEarned = 450.0;
let mockRedeemed = 324.5;
let activityLog = [];

// Mock coupons
const mockCoupons = [
    { id: 1, merchant: "FitMart", title: "$40 Fitness Equipment", price: 40, description: "Get $40 off on any fitness equipment", image: "🏋️" },
    { id: 2, merchant: "HealthFood Co", title: "$25 Organic Groceries", price: 25, description: "Save $25 on organic food items", image: "🥗" },
    { id: 3, merchant: "GymPro", title: "$50 Gym Membership", price: 50, description: "One month free gym membership", image: "💪" },
    { id: 4, merchant: "Wellness Spa", title: "$30 Spa Treatment", price: 30, description: "Relaxing spa day package", image: "🧘" },
    { id: 5, merchant: "Sports Store", title: "$35 Running Shoes", price: 35, description: "Premium running shoes discount", image: "👟" },
    { id: 6, merchant: "Nutrition Plus", title: "$20 Supplements", price: 20, description: "Health supplements bundle", image: "💊" }
];

// Initialize
function init() {
    updateBalance();
    renderCoupons();
    setupHealthDataInputs();
}

function updateBalance() {
    document.getElementById('tokenBalance').textContent = mockBalance.toFixed(2) + ' SWEAT';
    document.getElementById('totalEarned').textContent = mockTotalEarned.toFixed(2) + ' SWEAT';
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

function submitHealthData() {
    const steps = parseInt(document.getElementById('steps').value) || 0;
    const sleep = parseFloat(document.getElementById('sleep').value) || 0;
    const exercise = parseInt(document.getElementById('exercise').value) || 0;
    const heartRate = parseInt(document.getElementById('heartRate').value) || 0;

    if (steps === 0 && sleep === 0 && exercise === 0) {
        showStatus('submitStatus', 'Please enter at least one health metric', 'error');
        return;
    }

    // Calculate reward
    let reward = 0;
    if (steps >= 1000) reward += (steps / 1000) * 1;
    if (sleep >= 7) reward += 5;
    if (exercise >= 30) reward += (exercise / 30) * 10;

    if (reward === 0) {
        showStatus('submitStatus', 'No rewards earned. Try to reach minimum thresholds!', 'error');
        return;
    }

    // Mock submission
    mockBalance += reward;
    mockTotalEarned += reward;

    // Add to activity log
    addActivity(`Earned ${reward.toFixed(2)} SWEAT for health data submission`, 'success');

    // Update UI
    updateBalance();
    showStatus('submitStatus', `Success! You earned ${reward.toFixed(2)} SWEAT tokens! 🎉`, 'success');

    // Clear form
    document.getElementById('steps').value = '';
    document.getElementById('sleep').value = '';
    document.getElementById('exercise').value = '';
    document.getElementById('heartRate').value = '';
    document.getElementById('rewardPreview').style.display = 'none';
}

function renderCoupons() {
    const grid = document.getElementById('couponGrid');
    grid.innerHTML = '';

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
                    ${mockBalance < coupon.price ? 'disabled' : ''}>
                ${mockBalance < coupon.price ? 'Insufficient Balance' : 'Redeem Now'}
            </button>
        `;
        grid.appendChild(card);
    });
}

function redeemCoupon(couponId) {
    const coupon = mockCoupons.find(c => c.id === couponId);
    if (!coupon) return;

    if (mockBalance < coupon.price) {
        showStatus('submitStatus', 'Insufficient SWEAT balance', 'error');
        return;
    }

    // Mock redemption
    mockBalance -= coupon.price;
    mockRedeemed += coupon.price;

    // Add to activity log
    addActivity(`Redeemed ${coupon.price} SWEAT for: ${coupon.title}`, 'info');

    // Update UI
    updateBalance();
    renderCoupons();
    showStatus('submitStatus', `Successfully redeemed ${coupon.title}! Check your email for the coupon code.`, 'success');
}

function addActivity(message, type) {
    const log = document.getElementById('activityLog');
    const item = document.createElement('div');
    item.className = 'activity-item';
    const badge = type === 'success' ? '<span class="badge badge-success">EARNED</span>' : '<span class="badge badge-info">REDEEMED</span>';
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

// Wallet connection (mock)
function connectWallet() {
    const address = '0x' + Math.random().toString(16).substr(2, 40);
    document.getElementById('walletAddress').textContent = address.substring(0, 6) + '...' + address.substring(38);
    document.getElementById('connectButton').textContent = 'Connected';
    document.getElementById('connectButton').disabled = true;
    addActivity('Wallet connected successfully', 'info');
}

// Initialize on load
window.addEventListener('load', init);

