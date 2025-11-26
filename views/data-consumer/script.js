// ============================================
// Configuration (addresses loaded from latest deployment JSON)
// ============================================
let DATA_MARKETPLACE_ADDRESS;

// Contract ABI (simplified - key functions only)
const DATA_MARKETPLACE_ABI = [
    "function getDatasetCount() view returns (uint256)",
    "function getActiveDatasetIds() view returns (uint256[])",
    "function getDataset(uint256 datasetId) view returns (tuple(uint256 datasetId, string title, uint256 userCount, uint256 startTimestamp, uint256 endTimestamp, uint256 price, bool isActive, uint256 createdAt, uint256 averageDailySteps, uint256 averageSleepHours, uint256 averageExerciseMinutes, uint256 minAge, uint256 maxAge, string region, string dataLocation, uint256 purchaseCount))",
    "function getPurchasedDatasets(address buyer) view returns (uint256[])",
    "function hasPurchasedDataset(address buyer, uint256 datasetId) view returns (bool hasPurchased, uint256 purchaseTimestamp)",
    "function purchaseDataset(uint256 datasetId) payable",
    "function purchaseDatasetWithAggregation(string memory title, uint256 startTimestamp, uint256 endTimestamp, uint256 price, uint256 minAge, uint256 maxAge, string memory region, string memory dataLocation) payable returns (uint256)",
    "function previewAggregatedData(uint256 startTimestamp, uint256 endTimestamp) view returns (uint256 avgSteps, uint256 avgSleepHours, uint256 avgExerciseMinutes, uint256 totalEntries, uint256 uniqueDays, uint256 estimatedUserCount)",
    "event DatasetPurchased(address indexed buyer, uint256 indexed datasetId, uint256 price, uint256 timestamp)",
    "event DatasetCreated(uint256 indexed datasetId, string title, uint256 price, uint256 userCount)"
];

// ============================================
// Global State
// ============================================
let provider;
let signer;
let userAddress;
let dataMarketplaceContract;
let allDatasets = [];
let purchasedDatasetIds = [];
let filteredDatasets = [];
let isConnected = false;

// ============================================
// Wallet Connection
// ============================================
async function connectWallet() {
    try {
        if (typeof window.ethereum === 'undefined') {
            alert('Please install MetaMask to use this application!');
            return;
        }

        if (!DATA_MARKETPLACE_ADDRESS || DATA_MARKETPLACE_ADDRESS === "0x0000000000000000000000000000000000000000") {
            alert('DataMarketplace contract address is not configured. Please redeploy or update the config.');
            return;
        }

        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAddress = accounts[0];

        // Create provider and signer
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        userAddress = await signer.getAddress();

        // Initialize contract
        dataMarketplaceContract = new ethers.Contract(
            DATA_MARKETPLACE_ADDRESS,
            DATA_MARKETPLACE_ABI,
            signer
        );

        // Update UI
        document.getElementById('walletAddress').textContent = 
            userAddress.substring(0, 6) + '...' + userAddress.substring(38);
        document.getElementById('connectButton').textContent = 'Connected';
        document.getElementById('connectButton').disabled = true;
        isConnected = true;

        // Load data
        await loadDatasets();
        await loadPurchasedDatasets();

        // Listen for account changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', () => window.location.reload());

        showNotification('Wallet connected successfully!', 'success');
    } catch (error) {
        console.error('Error connecting wallet:', error);
        showNotification('Failed to connect wallet: ' + error.message, 'error');
    }
}

function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // User disconnected
        isConnected = false;
        document.getElementById('walletAddress').textContent = 'Not Connected';
        document.getElementById('connectButton').textContent = 'Connect Wallet';
        document.getElementById('connectButton').disabled = false;
    } else if (accounts[0] !== userAddress) {
        // User switched accounts
        userAddress = accounts[0];
        window.location.reload();
    }
}

// ============================================
// Load Datasets from Contract
// ============================================
async function loadDatasets() {
    if (!isConnected || !dataMarketplaceContract) {
        console.log('Not connected to contract');
        return;
    }

    try {
        showNotification('Loading datasets...', 'info');
        
        // Get active dataset IDs
        const activeIds = await dataMarketplaceContract.getActiveDatasetIds();
        
        // Load each dataset
        allDatasets = [];
        for (let i = 0; i < activeIds.length; i++) {
            try {
                const dataset = await dataMarketplaceContract.getDataset(activeIds[i]);
                allDatasets.push({
                    id: Number(dataset.datasetId),
                    title: dataset.title,
                    userCount: Number(dataset.userCount),
                    startTimestamp: Number(dataset.startTimestamp),
                    endTimestamp: Number(dataset.endTimestamp),
                    price: parseFloat(ethers.formatEther(dataset.price)),
                    averageDailySteps: Number(dataset.averageDailySteps),
                    averageSleepHours: Number(dataset.averageSleepHours),
                    averageExerciseMinutes: Number(dataset.averageExerciseMinutes),
                    minAge: Number(dataset.minAge),
                    maxAge: Number(dataset.maxAge),
                    region: dataset.region,
                    dataLocation: dataset.dataLocation,
                    purchaseCount: Number(dataset.purchaseCount),
                    isActive: dataset.isActive,
                    description: `${dataset.title} - ${dataset.region} dataset with ${dataset.userCount.toLocaleString()} users`
                });
            } catch (error) {
                console.error(`Error loading dataset ${activeIds[i]}:`, error);
            }
        }

        filteredDatasets = [...allDatasets];
        renderDatasets();
        showNotification(`Loaded ${allDatasets.length} datasets`, 'success');
    } catch (error) {
        console.error('Error loading datasets:', error);
        showNotification('Failed to load datasets: ' + error.message, 'error');
        
        // Fallback to mock data if contract not deployed
        if (error.message.includes('contract') || DATA_MARKETPLACE_ADDRESS === "0x0000000000000000000000000000000000000000") {
            loadMockData();
        }
    }
}

// ============================================
// Load Purchased Datasets
// ============================================
async function loadPurchasedDatasets() {
    if (!isConnected || !dataMarketplaceContract || !userAddress) {
        return;
    }

    try {
        const purchasedIds = await dataMarketplaceContract.getPurchasedDatasets(userAddress);
        purchasedDatasetIds = purchasedIds.map(id => Number(id));
        renderPurchasedDatasets();
    } catch (error) {
        console.error('Error loading purchased datasets:', error);
    }
}

// ============================================
// Purchase Dataset
// ============================================
async function purchaseDataset(datasetId) {
    if (!isConnected || !dataMarketplaceContract) {
        alert('Please connect your wallet first!');
        return;
    }

    const dataset = allDatasets.find(d => d.id === datasetId);
    if (!dataset) {
        alert('Dataset not found!');
        return;
    }

    // Check if already purchased
    if (purchasedDatasetIds.includes(datasetId)) {
        alert('You have already purchased this dataset!');
        return;
    }

    const priceInWei = ethers.parseEther(dataset.price.toString());
    const confirmMsg = `Purchase "${dataset.title}" for ${dataset.price} ETH?`;
    
    if (!confirm(confirmMsg)) {
        return;
    }

    try {
        showNotification('Processing purchase...', 'info');
        
        const tx = await dataMarketplaceContract.purchaseDataset(datasetId, {
            value: priceInWei
        });
        
        showNotification('Transaction submitted. Waiting for confirmation...', 'info');
        
        await tx.wait();
        
        // Update purchased list
        purchasedDatasetIds.push(datasetId);
        
        // Reload datasets to get updated purchase count
        await loadDatasets();
        await loadPurchasedDatasets();
        
        showNotification(`Successfully purchased "${dataset.title}"!`, 'success');
    } catch (error) {
        console.error('Error purchasing dataset:', error);
        let errorMsg = 'Purchase failed: ';
        
        if (error.reason) {
            errorMsg += error.reason;
        } else if (error.message) {
            errorMsg += error.message;
        } else {
            errorMsg += 'Unknown error';
        }
        
        showNotification(errorMsg, 'error');
    }
}

// ============================================
// Preview Aggregated Data
// ============================================
async function previewAggregatedData() {
    if (!isConnected || !dataMarketplaceContract) {
        alert('Please connect your wallet first!');
        return;
    }

    const startDate = document.getElementById('previewStartDate').value;
    const endDate = document.getElementById('previewEndDate').value;

    if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
    }

    const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);

    if (startTimestamp >= endTimestamp) {
        alert('End date must be after start date');
        return;
    }

    try {
        showNotification('Loading aggregated data preview...', 'info');
        
        const preview = await dataMarketplaceContract.previewAggregatedData(
            startTimestamp,
            endTimestamp
        );

        const sleepHours = (Number(preview.avgSleepHours) / 60).toFixed(1);
        const exerciseHours = (Number(preview.avgExerciseMinutes) / 60).toFixed(1);

        const previewResult = `
Aggregated Data Preview:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Average Daily Steps: ${Number(preview.avgSteps).toLocaleString()}
Average Sleep: ${sleepHours} hours
Average Exercise: ${exerciseHours} hours/week
Total Entries: ${Number(preview.totalEntries).toLocaleString()}
Unique Days: ${Number(preview.uniqueDays)}
Estimated Users: ${Number(preview.estimatedUserCount).toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `;

        alert(previewResult);
    } catch (error) {
        console.error('Error previewing data:', error);
        showNotification('Failed to preview data: ' + error.message, 'error');
    }
}

// ============================================
// Purchase with Aggregation
// ============================================
async function purchaseWithAggregation() {
    if (!isConnected || !dataMarketplaceContract) {
        alert('Please connect your wallet first!');
        return;
    }

    const title = document.getElementById('customTitle').value;
    const startDate = document.getElementById('customStartDate').value;
    const endDate = document.getElementById('customEndDate').value;
    const price = parseFloat(document.getElementById('customPrice').value);
    const minAge = parseInt(document.getElementById('customMinAge').value);
    const maxAge = parseInt(document.getElementById('customMaxAge').value);
    const region = document.getElementById('customRegion').value;
    const dataLocation = document.getElementById('customDataLocation').value;

    if (!title || !startDate || !endDate || !price || !region || !dataLocation) {
        alert('Please fill in all fields');
        return;
    }

    const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);

    if (startTimestamp >= endTimestamp) {
        alert('End date must be after start date');
        return;
    }

    const priceInWei = ethers.parseEther(price.toString());
    const confirmMsg = `Purchase custom dataset "${title}" for ${price} ETH?\n\nThis will aggregate data from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`;
    
    if (!confirm(confirmMsg)) {
        return;
    }

    try {
        showNotification('Creating dataset and processing purchase...', 'info');
        
        const tx = await dataMarketplaceContract.purchaseDatasetWithAggregation(
            title,
            startTimestamp,
            endTimestamp,
            priceInWei,
            minAge,
            maxAge,
            region,
            dataLocation,
            { value: priceInWei }
        );
        
        showNotification('Transaction submitted. Waiting for confirmation...', 'info');
        
        const receipt = await tx.wait();
        
        // Find the dataset ID from events
        const event = receipt.logs.find(log => {
            try {
                const parsed = dataMarketplaceContract.interface.parseLog(log);
                return parsed && parsed.name === 'DatasetCreated';
            } catch {
                return false;
            }
        });

        if (event) {
            const parsed = dataMarketplaceContract.interface.parseLog(event);
            const datasetId = Number(parsed.args.datasetId);
            purchasedDatasetIds.push(datasetId);
        }

        // Reload datasets
        await loadDatasets();
        await loadPurchasedDatasets();
        
        showNotification(`Successfully created and purchased custom dataset!`, 'success');
        
        // Reset form
        document.getElementById('customDatasetForm').reset();
    } catch (error) {
        console.error('Error purchasing with aggregation:', error);
        let errorMsg = 'Purchase failed: ';
        
        if (error.reason) {
            errorMsg += error.reason;
        } else if (error.message) {
            errorMsg += error.message;
        } else {
            errorMsg += 'Unknown error';
        }
        
        showNotification(errorMsg, 'error');
    }
}

// ============================================
// Render Functions
// ============================================
function renderDatasets() {
    const grid = document.getElementById('datasetGrid');
    grid.innerHTML = '';

    if (filteredDatasets.length === 0) {
        grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><h3>No datasets found</h3><p>Try adjusting your filters</p></div>';
        return;
    }

    filteredDatasets.forEach(dataset => {
        const isPurchased = purchasedDatasetIds.includes(dataset.id);
        const card = document.createElement('div');
        card.className = `dataset-card ${isPurchased ? 'purchased' : ''}`;
        
        const period = formatPeriod(dataset.startTimestamp, dataset.endTimestamp);
        const sleepHours = (dataset.averageSleepHours / 60).toFixed(1);
        
        card.innerHTML = `
            ${isPurchased ? '<div class="purchased-badge">✓ Purchased</div>' : ''}
            <div class="dataset-header">
                <div class="dataset-title">${dataset.title}</div>
                <div class="dataset-price">${dataset.price} ETH</div>
            </div>
            <div class="dataset-description">${dataset.description}</div>
            <div class="dataset-meta">
                <div class="meta-item">
                    <div class="meta-label">👥 Users</div>
                    <div class="meta-value">${dataset.userCount.toLocaleString()}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">🌍 Region</div>
                    <div class="meta-value">${dataset.region}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">📅 Period</div>
                    <div class="meta-value">${period}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">👤 Age Range</div>
                    <div class="meta-value">${dataset.minAge}-${dataset.maxAge}</div>
                </div>
            </div>
            <div class="dataset-stats">
                <div class="stat-row">
                    <span class="stat-label">Avg Daily Steps:</span>
                    <span class="stat-value">${dataset.averageDailySteps.toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Avg Sleep:</span>
                    <span class="stat-value">${sleepHours} hours</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Avg Exercise:</span>
                    <span class="stat-value">${(dataset.averageExerciseMinutes / 60).toFixed(1)} hrs/week</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Times Sold:</span>
                    <span class="stat-value">${dataset.purchaseCount}</span>
                </div>
            </div>
            <button class="purchase-btn" onclick="purchaseDataset(${dataset.id})" ${isPurchased ? 'disabled' : ''}>
                ${isPurchased ? 'Already Purchased' : `Purchase for ${dataset.price} ETH`}
            </button>
        `;
        grid.appendChild(card);
    });
}

function renderPurchasedDatasets() {
    const grid = document.getElementById('purchasedGrid');
    const noPurchases = document.getElementById('noPurchases');
    
    if (purchasedDatasetIds.length === 0) {
        grid.innerHTML = '';
        noPurchases.style.display = 'block';
        return;
    }

    noPurchases.style.display = 'none';
    grid.innerHTML = '';

    purchasedDatasetIds.forEach(datasetId => {
        const dataset = allDatasets.find(d => d.id === datasetId);
        if (!dataset) {
            // Try to load it if not in cache
            loadDatasetById(datasetId).then(d => {
                if (d) renderPurchasedDatasets();
            });
            return;
        }

        const card = document.createElement('div');
        card.className = 'dataset-card purchased';
        const period = formatPeriod(dataset.startTimestamp, dataset.endTimestamp);
        
        card.innerHTML = `
            <div class="purchased-badge">✓ Purchased</div>
            <div class="dataset-header">
                <div class="dataset-title">${dataset.title}</div>
            </div>
            <div class="dataset-description">${dataset.description}</div>
            <div class="dataset-meta">
                <div class="meta-item">
                    <div class="meta-label">👥 Users</div>
                    <div class="meta-value">${dataset.userCount.toLocaleString()}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">📅 Period</div>
                    <div class="meta-value">${period}</div>
                </div>
            </div>
            <div style="margin-top: 15px; padding: 15px; background: #e3f2fd; border-radius: 8px;">
                <strong>📥 Data Access:</strong>
                <div style="margin-top: 10px; font-family: monospace; font-size: 0.9em; word-break: break-all;">
                    ${dataset.dataLocation}
                </div>
                <button onclick="downloadDataset(${dataset.id})" style="width: 100%; margin-top: 10px; background: #2196f3; color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer;">
                    Download Dataset
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

async function loadDatasetById(datasetId) {
    if (!dataMarketplaceContract) return null;
    try {
        const dataset = await dataMarketplaceContract.getDataset(datasetId);
        const formatted = {
            id: Number(dataset.datasetId),
            title: dataset.title,
            userCount: Number(dataset.userCount),
            startTimestamp: Number(dataset.startTimestamp),
            endTimestamp: Number(dataset.endTimestamp),
            price: parseFloat(ethers.formatEther(dataset.price)),
            averageDailySteps: Number(dataset.averageDailySteps),
            averageSleepHours: Number(dataset.averageSleepHours),
            averageExerciseMinutes: Number(dataset.averageExerciseMinutes),
            minAge: Number(dataset.minAge),
            maxAge: Number(dataset.maxAge),
            region: dataset.region,
            dataLocation: dataset.dataLocation,
            purchaseCount: Number(dataset.purchaseCount),
            isActive: dataset.isActive,
            description: `${dataset.title} - ${dataset.region} dataset`
        };
        allDatasets.push(formatted);
        return formatted;
    } catch (error) {
        console.error('Error loading dataset:', error);
        return null;
    }
}

// ============================================
// Filter Functions
// ============================================
function filterDatasets() {
    const searchTitle = document.getElementById('searchTitle').value.toLowerCase();
    const filterRegion = document.getElementById('filterRegion').value;
    const filterPrice = parseFloat(document.getElementById('filterPrice').value) || Infinity;
    const filterUsers = parseInt(document.getElementById('filterUsers').value) || 0;

    filteredDatasets = allDatasets.filter(dataset => {
        const matchesTitle = dataset.title.toLowerCase().includes(searchTitle);
        const matchesRegion = !filterRegion || dataset.region === filterRegion;
        const matchesPrice = dataset.price <= filterPrice;
        const matchesUsers = dataset.userCount >= filterUsers;

        return matchesTitle && matchesRegion && matchesPrice && matchesUsers;
    });

    renderDatasets();
}

// ============================================
// Utility Functions
// ============================================
function formatPeriod(start, end) {
    const startDate = new Date(start * 1000);
    const endDate = new Date(end * 1000);
    return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
}

function downloadDataset(datasetId) {
    const dataset = allDatasets.find(d => d.id === datasetId);
    if (!dataset) return;

    alert(`Downloading dataset: ${dataset.title}\n\nData Location: ${dataset.dataLocation}\n\nIn production, this would download the data from the specified location.`);
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
        color: white;
        border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        max-width: 400px;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================
// Mock Data (Fallback)
// ============================================
function loadMockData() {
    console.log('Loading mock data as fallback');
    allDatasets = [
        {
            id: 1,
            title: "Hong Kong Young Adults Activity Patterns",
            userCount: 10000,
            startTimestamp: Math.floor(new Date('2024-01-01').getTime() / 1000),
            endTimestamp: Math.floor(new Date('2024-06-30').getTime() / 1000),
            price: 2.0,
            averageDailySteps: 7500,
            averageSleepHours: 420,
            averageExerciseMinutes: 192,
            minAge: 20,
            maxAge: 60,
            region: "Hong Kong",
            dataLocation: "ipfs://QmXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx",
            purchaseCount: 8,
            description: "Comprehensive 6-month dataset of physical activity patterns for young adults in Hong Kong."
        }
    ];
    filteredDatasets = [...allDatasets];
    renderDatasets();
}

// ============================================
// Initialize
// ============================================
async function init() {
    // Try to load addresses from views/config/addresses-<network>.json
    try {
        if (typeof window.loadContractAddresses === 'function') {
            const cfg = await window.loadContractAddresses();
            if (cfg && cfg.DataMarketplace) {
                DATA_MARKETPLACE_ADDRESS = cfg.DataMarketplace;
                console.log('[FitDAO] Loaded DataMarketplace address from config:', DATA_MARKETPLACE_ADDRESS);
            } else {
                console.warn('[FitDAO] DataMarketplace address missing in config. Using fallback (if any).');
            }
        } else {
            console.warn('[FitDAO] loadContractAddresses helper not found. Using fallback (if any).');
        }
    } catch (e) {
        console.error('[FitDAO] Failed to load contract addresses:', e);
    }

    // Check if already connected
    if (typeof window.ethereum !== 'undefined') {
        window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
            if (accounts.length > 0) {
                connectWallet();
            } else {
                renderDatasets();
            }
        });
    } else {
        renderDatasets();
    }
}

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

window.addEventListener('load', init);
