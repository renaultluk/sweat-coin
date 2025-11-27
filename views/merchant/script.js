import '../../config/load-addresses.js'; // Ensure loadContractAddresses is available

let provider;
let signer;
let contractAddresses;
let merchantGatewayContract;
let sweatCoinContract;
let currentAccount = null;

const MERCHANT_GATEWAY_ABI_PATH = '../../artifacts/contracts/MerchantGateway.sol/MerchantGateway.json';
const SWEAT_COIN_ABI_PATH = '../../artifacts/contracts/SweatCoinToken.sol/SweatCoinToken.json';

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
        showStatus('createStatus', `Error loading contract ABI: ${error.message}`, 'error');
        return null;
    }
}

// --- Web3 Initialization ---

async function initWeb3() {
    if (window.ethereum) {
        provider = new ethers.BrowserProvider(window.ethereum);
        contractAddresses = await window.loadContractAddresses();
        if (!contractAddresses) {
            showStatus('createStatus', 'Error: Contract addresses not loaded. Is the network configured correctly?', 'error');
            return;
        }
        document.getElementById('connectButton').textContent = 'Connect Wallet';
        document.getElementById('connectButton').disabled = false;
    } else {
        showStatus('createStatus', 'MetaMask is not installed. Please install it to use this DApp.', 'error');
        document.getElementById('connectButton').textContent = 'MetaMask Not Found';
        document.getElementById('connectButton').disabled = true;
    }
}

async function connectWallet() {
    try {
        await provider.send("eth_requestAccounts", []);
        signer = await provider.getSigner();
        currentAccount = await signer.getAddress();
        document.getElementById('walletAddress').textContent = formatAddress(currentAccount);
        document.getElementById('connectButton').textContent = 'Connected';
        document.getElementById('connectButton').disabled = true;

        await initContracts();
        await loadMerchantDashboard();

    } catch (error) {
        console.error("User rejected access or other error:", error);
        showStatus('createStatus', `Wallet connection failed: ${error.message}`, 'error');
    }
}

async function initContracts() {
    if (!signer || !contractAddresses) {
        console.error("Web3 not initialized or contract addresses missing.");
        return;
    }

    try {
        const merchantGatewayAbi = await loadAbi(MERCHANT_GATEWAY_ABI_PATH);
        const sweatCoinAbi = await loadAbi(SWEAT_COIN_ABI_PATH);

        if (!merchantGatewayAbi || !sweatCoinAbi) {
            throw new Error("Failed to load one or more contract ABIs.");
        }

        merchantGatewayContract = new ethers.Contract(contractAddresses.MerchantGateway, merchantGatewayAbi, signer);
        sweatCoinContract = new ethers.Contract(contractAddresses.SweatCoinToken, sweatCoinAbi, signer);

        console.log("Contracts initialized:", {
            merchantGateway: merchantGatewayContract.address,
            sweatCoin: sweatCoinContract.address
        });

    } catch (error) {
        console.error("Error initializing contracts:", error);
        showStatus('createStatus', `Contract initialization failed: ${error.message}`, 'error');
    }
}

// --- Dashboard Functions ---

async function loadMerchantDashboard() {
    if (!merchantGatewayContract || !currentAccount) {
        console.warn("MerchantGateway contract not initialized or account not connected.");
        return;
    }
    try {
        const merchantData = await merchantGatewayContract.getMerchant(currentAccount);
        
        // Convert BigNumber values to readable format
        const totalSweatReceived = ethers.formatEther(merchantData.totalSweatReceived);
        const totalEthReceived = ethers.formatEther(merchantData.totalEthReceived);

        let activeCouponsCount = 0;
        let totalRedemptions = 0;
        let monthRedemptions = 0; // This would require querying events or specific contract function

        // Fetch coupons to get active count and total redemptions
        // This requires a function in MerchantGateway to get coupons for a merchant.
        // For now, assuming an admin view can list all coupons and we filter here.
        // Ideally, MerchantGateway should have getCouponsByMerchant(address) function.
        // Since it doesn't, let's just use the merchantData directly for stats that are available.
        // We'll update renderCoupons to fetch/filter more comprehensively.

        // Placeholder for now - actual data will come from contract query
        document.getElementById('activeCoupons').textContent = 'N/A'; 
        document.getElementById('totalRedemptions').textContent = merchantData.totalRedemptions || 'N/A'; // Assuming totalRedemptions is a field
        document.getElementById('monthRedemptions').textContent = 'N/A'; // Requires event parsing or dedicated function
        document.getElementById('totalSubsidies').textContent = `${parseFloat(totalEthReceived).toFixed(2)} ETH`;
        
        // This merchantData from getMerchant does not include active coupons count or total redemptions directly yet.
        // We need to fetch all coupons for the merchant and aggregate.
        await renderCoupons();

    } catch (error) {
        console.error("Error loading merchant dashboard:", error);
        showStatus('createStatus', `Failed to load dashboard: ${error.message}`, 'error');
    }
}

async function renderCoupons() {
    const list = document.getElementById('couponList');
    const noCoupons = document.getElementById('noCoupons');
    list.innerHTML = ''; // Clear existing list

    if (!merchantGatewayContract || !currentAccount) {
        noCoupons.style.display = 'block';
        return;
    }

    try {
        // This is a placeholder. MerchantGateway needs a function to return coupons by merchant.
        // For now, we assume an owner could iterate all, or a specific merchant could query their own.
        // We'll add a mock function call for display.
        // In a real dApp, you'd likely fetch events or have an indexed getter.

        const merchantCoupons = []; // Placeholder for actual fetched coupons

        // For demonstration, manually add a mock coupon if none exist on chain.
        // In reality, this would be `merchantGatewayContract.getCouponsForMerchant(currentAccount)`
        // For now, let's assume getMerchant returns some coupon IDs or there's a global getter.
        // If merchantGatewayContract.getCouponCount is available, we could iterate.
        // For now, this will display nothing until actual contract integration is done carefully.

        // Assuming a mock direct call for display purposes until a proper getter is implemented in contract.
        // Example: const couponIds = await merchantGatewayContract.getCouponsForMerchant(currentAccount);
        // For now, we will add a view function to MerchantGateway to return all coupon IDs for the merchant

        // Placeholder: Assuming `merchantGatewayContract.getAllCouponIdsByMerchant(currentAccount)` exists
        let allCouponIdsForMerchant = await merchantGatewayContract.getCouponIdsByMerchant(currentAccount);

        if (allCouponIdsForMerchant.length === 0) {
            noCoupons.style.display = 'block';
            return;
        }

        noCoupons.style.display = 'none';

        for (const couponId of allCouponIdsForMerchant) {
            const coupon = await merchantGatewayContract.getCoupon(couponId);
            // Convert BigNumber to JS number for price. valueUSD is not BigNumber if stored as uint256.
            const couponValueUSD = coupon.valueUSD;
            const createdAt = new Date(Number(coupon.createdAt) * 1000); // Unix timestamp to JS Date
            
            // Assuming default expiry is 1 year from creation for simplicity if not in contract
            const expiryDate = new Date(createdAt);
            expiryDate.setFullYear(expiryDate.getFullYear() + 1); // Placeholder expiry
            
            const item = document.createElement('div');
            item.className = 'coupon-item';
            
            const statusText = coupon.isActive ? 'Active' : 'Paused';
            const statusClass = coupon.isActive ? 'status-active' : 'status-paused';

            const isExpired = expiryDate < new Date(); // Using placeholder expiry
            const expiryDisplay = isExpired ? 'Expired' : `Expires: ${expiryDate.toLocaleDateString()}`;

            item.innerHTML = `
                <div class="coupon-item-header">
                    <div>
                        <span class="coupon-title">${coupon.description}</span>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="coupon-price">${couponValueUSD} SWEAT</div>
                </div>
                <div style="color: #666; margin-bottom: 10px;">Coupon ID: ${coupon.id}</div>
                <div class="coupon-meta">
                    <div class="meta-item">
                        Created: <span class="meta-value">${createdAt.toLocaleDateString()}</span>
                    </div>
                    <div class="meta-item">
                        ${expiryDisplay}
                    </div>
                    <div class="meta-item">
                        Redemptions: <span class="meta-value">${coupon.redemptionCount}</span>
                    </div>
                    <div class="meta-item">
                        Subsidies: <span class="meta-value">N/A</span> <!-- Need to track this on chain or via events -->
                    </div>
                </div>
                <div class="action-buttons">
                    ${coupon.isActive ? 
                        `<button class="btn-small" onclick="updateCouponStatus(${coupon.id}, false)">Pause</button>` :
                        `<button class="btn-small btn-success" onclick="updateCouponStatus(${coupon.id}, true)">Activate</button>`
                    }
                    <button class="btn-small btn-danger" onclick="deleteCoupon(${coupon.id})">Deactivate</button>
                    <button class="btn-small" onclick="viewDetails(${coupon.id})">View Details</button>
                </div>
            `;
            list.appendChild(item);
        }

    } catch (error) {
        console.error("Error rendering coupons:", error);
        showStatus('createStatus', `Failed to render coupons: ${error.message}`, 'error');
    }
}


// --- Coupon Actions ---

async function createCoupon() {
    if (!merchantGatewayContract || !currentAccount) {
        showStatus('createStatus', 'Please connect your wallet first.', 'error');
        return;
    }

    const description = document.getElementById('couponDescription').value;
    const valueUSD = parseInt(document.getElementById('couponPrice').value);
    // const expiry = new Date(document.getElementById('couponExpiry').value); // Expiry not supported in contract yet
    // const limit = document.getElementById('couponLimit').value ? parseInt(document.getElementById('couponLimit').value) : null; // Limit not supported in contract yet

    if (valueUSD <= 0) {
        showStatus('createStatus', 'Price must be greater than 0', 'error');
        return;
    }
    if (!description) {
        showStatus('createStatus', 'Coupon description cannot be empty.', 'error');
        return;
    }

    try {
        showStatus('createStatus', 'Creating coupon...', 'info');
        const tx = await merchantGatewayContract.createCoupon(description, valueUSD, currentAccount);
        await tx.wait(); // Wait for transaction to be mined

        showStatus('createStatus', `Coupon "${description}" created successfully! Transaction: ${tx.hash}`, 'success');
        
        // Reset form
        document.getElementById('couponTitle').value = ''; // Title not used directly in contract
        document.getElementById('couponDescription').value = '';
        document.getElementById('couponPrice').value = '';
        document.getElementById('couponExpiry').value = '';
        document.getElementById('couponLimit').value = '';

        await loadMerchantDashboard(); // Reload dashboard to show new coupon
    } catch (error) {
        console.error("Error creating coupon:", error);
        showStatus('createStatus', `Failed to create coupon: ${error.message}`, 'error');
    }
}

async function updateCouponStatus(couponId, isActive) {
    if (!merchantGatewayContract || !currentAccount) {
        showStatus('createStatus', 'Please connect your wallet first.', 'error');
        return;
    }

    try {
        showStatus('createStatus', `Updating coupon status...`, 'info');
        const coupon = await merchantGatewayContract.getCoupon(couponId);
        const tx = await merchantGatewayContract.updateCoupon(
            couponId, 
            coupon.description, 
            coupon.valueUSD, 
            isActive
        );
        await tx.wait();
        showStatus('createStatus', `Coupon ID ${couponId} status updated to ${isActive ? 'active' : 'paused'}!`, 'success');
        await loadMerchantDashboard();
    } catch (error) {
        console.error("Error updating coupon status:", error);
        showStatus('createStatus', `Failed to update coupon status: ${error.message}`, 'error');
    }
}

async function deleteCoupon(couponId) { // This will deactivate, not truly delete
    if (!merchantGatewayContract || !currentAccount) {
        showStatus('createStatus', 'Please connect your wallet first.', 'error');
        return;
    }

    if (!confirm('Are you sure you want to deactivate this coupon? This will make it unusable.')) {
        return;
    }

    try {
        showStatus('createStatus', `Deactivating coupon...`, 'info');
        const coupon = await merchantGatewayContract.getCoupon(couponId);
        const tx = await merchantGatewayContract.updateCoupon(
            couponId, 
            coupon.description, 
            coupon.valueUSD, 
            false // Set isActive to false
        );
        await tx.wait();
        showStatus('createStatus', `Coupon ID ${couponId} deactivated!`, 'success');
        await loadMerchantDashboard();
    } catch (error) {
        console.error("Error deactivating coupon:", error);
        showStatus('createStatus', `Failed to deactivate coupon: ${error.message}`, 'error');
    }
}

async function viewDetails(couponId) {
    if (!merchantGatewayContract) {
        alert('Contracts not initialized. Connect wallet first.');
        return;
    }
    try {
        const coupon = await merchantGatewayContract.getCoupon(couponId);
        
        const createdAt = new Date(Number(coupon.createdAt) * 1000); // Unix timestamp to JS Date
        // Placeholder expiry for display
        const expiryDate = new Date(createdAt);
        expiryDate.setFullYear(expiryDate.getFullYear() + 1); 
        const expiryDisplay = (expiryDate < new Date()) ? 'Expired' : expiryDate.toLocaleDateString();

        const details = `
Coupon Details:
- ID: ${coupon.id}
- Description: ${coupon.description}
- Value (USD): $${coupon.valueUSD}
- Merchant: ${formatAddress(coupon.merchantAddress)}
- Status: ${coupon.isActive ? 'Active' : 'Paused'}
- Created: ${createdAt.toLocaleString()}
- Expires: ${expiryDisplay}
- Redemptions: ${coupon.redemptionCount}
        `;
        alert(details);
    } catch (error) {
        console.error("Error viewing coupon details:", error);
        alert(`Failed to load coupon details: ${error.message}`);
    }
}

// --- Main Initialization ---
window.addEventListener('load', initWeb3);


