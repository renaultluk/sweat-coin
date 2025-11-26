// Mock data
let coupons = [
    {
        id: 1,
        title: "$40 Fitness Equipment",
        description: "Get $40 off on any fitness equipment in our store",
        price: 40,
        status: "active",
        createdAt: new Date('2024-01-15'),
        expiryDate: new Date('2024-12-31'),
        redemptionLimit: null,
        redemptions: 45,
        totalSubsidies: 900
    },
    {
        id: 2,
        title: "$25 Organic Groceries",
        description: "Save $25 on organic food items",
        price: 25,
        status: "active",
        createdAt: new Date('2024-02-01'),
        expiryDate: new Date('2024-12-31'),
        redemptionLimit: 100,
        redemptions: 32,
        totalSubsidies: 640
    },
    {
        id: 3,
        title: "$50 Gym Membership",
        description: "One month free gym membership",
        price: 50,
        status: "paused",
        createdAt: new Date('2024-01-10'),
        expiryDate: new Date('2024-06-30'),
        redemptionLimit: 50,
        redemptions: 28,
        totalSubsidies: 560
    }
];

let totalRedemptions = 105;
let monthRedemptions = 23;

function init() {
    updateStats();
    renderCoupons();
    // Set default expiry to 3 months from now
    const defaultExpiry = new Date();
    defaultExpiry.setMonth(defaultExpiry.getMonth() + 3);
    document.getElementById('couponExpiry').value = defaultExpiry.toISOString().split('T')[0];
}

function updateStats() {
    const active = coupons.filter(c => c.status === 'active').length;
    document.getElementById('activeCoupons').textContent = active;
    document.getElementById('totalRedemptions').textContent = totalRedemptions;
    document.getElementById('monthRedemptions').textContent = monthRedemptions;
    
    const totalSubsidies = coupons.reduce((sum, c) => sum + c.totalSubsidies, 0);
    document.getElementById('totalSubsidies').textContent = totalSubsidies + ' ETH';
}

function renderCoupons() {
    const list = document.getElementById('couponList');
    const noCoupons = document.getElementById('noCoupons');

    if (coupons.length === 0) {
        list.innerHTML = '';
        noCoupons.style.display = 'block';
        return;
    }

    noCoupons.style.display = 'none';
    list.innerHTML = '';

    coupons.forEach(coupon => {
        const item = document.createElement('div');
        item.className = 'coupon-item';
        
        const statusClass = coupon.status === 'active' ? 'status-active' : 
                           coupon.status === 'paused' ? 'status-paused' : 'status-expired';
        const statusText = coupon.status.charAt(0).toUpperCase() + coupon.status.slice(1);
        
        const isExpired = new Date(coupon.expiryDate) < new Date();
        const expiryText = isExpired ? 'Expired' : `Expires: ${new Date(coupon.expiryDate).toLocaleDateString()}`;
        
        item.innerHTML = `
            <div class="coupon-item-header">
                <div>
                    <span class="coupon-title">${coupon.title}</span>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="coupon-price">${coupon.price} SWEAT</div>
            </div>
            <div style="color: #666; margin-bottom: 10px;">${coupon.description}</div>
            <div class="coupon-meta">
                <div class="meta-item">
                    Created: <span class="meta-value">${new Date(coupon.createdAt).toLocaleDateString()}</span>
                </div>
                <div class="meta-item">
                    ${expiryText}
                </div>
                <div class="meta-item">
                    Redemptions: <span class="meta-value">${coupon.redemptions}${coupon.redemptionLimit ? ` / ${coupon.redemptionLimit}` : ''}</span>
                </div>
                <div class="meta-item">
                    Subsidies: <span class="meta-value">${coupon.totalSubsidies} ETH</span>
                </div>
            </div>
            <div class="action-buttons">
                ${coupon.status === 'active' ? 
                    `<button class="btn-small" onclick="pauseCoupon(${coupon.id})">Pause</button>` :
                    `<button class="btn-small btn-success" onclick="activateCoupon(${coupon.id})">Activate</button>`
                }
                <button class="btn-small btn-danger" onclick="deleteCoupon(${coupon.id})">Delete</button>
                <button class="btn-small" onclick="viewDetails(${coupon.id})">View Details</button>
            </div>
        `;
        list.appendChild(item);
    });
}

function createCoupon() {
    const title = document.getElementById('couponTitle').value;
    const description = document.getElementById('couponDescription').value;
    const price = parseInt(document.getElementById('couponPrice').value);
    const expiry = new Date(document.getElementById('couponExpiry').value);
    const limit = document.getElementById('couponLimit').value ? parseInt(document.getElementById('couponLimit').value) : null;

    if (price <= 0) {
        showStatus('createStatus', 'Price must be greater than 0', 'error');
        return;
    }

    const newCoupon = {
        id: coupons.length > 0 ? Math.max(...coupons.map(c => c.id)) + 1 : 1,
        title: title,
        description: description,
        price: price,
        status: 'active',
        createdAt: new Date(),
        expiryDate: expiry,
        redemptionLimit: limit,
        redemptions: 0,
        totalSubsidies: 0
    };

    coupons.push(newCoupon);
    
    // Reset form
    document.getElementById('couponTitle').value = '';
    document.getElementById('couponDescription').value = '';
    document.getElementById('couponPrice').value = '';
    document.getElementById('couponLimit').value = '';

    showStatus('createStatus', `Successfully created coupon: ${title}`, 'success');
    updateStats();
    renderCoupons();
}

function pauseCoupon(id) {
    const coupon = coupons.find(c => c.id === id);
    if (coupon) {
        coupon.status = 'paused';
        renderCoupons();
    }
}

function activateCoupon(id) {
    const coupon = coupons.find(c => c.id === id);
    if (coupon) {
        if (new Date(coupon.expiryDate) < new Date()) {
            alert('Cannot activate expired coupon. Please create a new one.');
            return;
        }
        coupon.status = 'active';
        renderCoupons();
    }
}

function deleteCoupon(id) {
    if (confirm('Are you sure you want to delete this coupon? This action cannot be undone.')) {
        coupons = coupons.filter(c => c.id !== id);
        renderCoupons();
        updateStats();
    }
}

function viewDetails(id) {
    const coupon = coupons.find(c => c.id === id);
    if (!coupon) return;

    const details = `
Coupon Details:
- Title: ${coupon.title}
- Price: ${coupon.price} SWEAT
- Description: ${coupon.description}
- Status: ${coupon.status}
- Created: ${new Date(coupon.createdAt).toLocaleString()}
- Expires: ${new Date(coupon.expiryDate).toLocaleString()}
- Redemptions: ${coupon.redemptions}${coupon.redemptionLimit ? ` / ${coupon.redemptionLimit}` : ' (unlimited)'}
- Total Subsidies Received: ${coupon.totalSubsidies} ETH
- Avg Subsidy per Redemption: ${coupon.redemptions > 0 ? (coupon.totalSubsidies / coupon.redemptions).toFixed(2) : 0} ETH
    `;
    alert(details);
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
}

// Initialize on load
window.addEventListener('load', init);

