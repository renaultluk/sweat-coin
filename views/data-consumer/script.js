// ============================================
// Configuration (addresses loaded from latest deployment JSON)
// Version: 2025-01-27 - Removed 100 minimum entries requirement
// ============================================
let DATA_MARKETPLACE_ADDRESS;
let HEALTH_REWARDS_ENGINE_ADDRESS;

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
    "function calculatePriceForPeriod(uint256 startTimestamp, uint256 endTimestamp) view returns (uint256 price, uint256 totalEntries)",
    "function calculatePrice(uint256 totalEntries) view returns (uint256 price)",
    "function basePrice() view returns (uint256)",
    "function pricePer1000Entries() view returns (uint256)",
    "event DatasetPurchased(address indexed buyer, uint256 indexed datasetId, uint256 price, uint256 timestamp)",
    "event DatasetCreated(uint256 indexed datasetId, string title, uint256 price, uint256 userCount)"
];

const HEALTH_REWARDS_ENGINE_ABI = [
    "function getAggregatedDataForRange(uint256 startDay, uint256 endDay) view returns (uint256 totalSteps, uint256 totalSleepHours, uint256 totalExerciseMinutes, uint256 totalEntries, uint256 uniqueDays)",
    "function getAverageMetricsForRange(uint256 startDay, uint256 endDay) view returns (uint256 avgSteps, uint256 avgSleepHours, uint256 avgExerciseMinutes, uint256 entryCount)",
    "function getDailyAggregate(uint256 day) view returns (tuple(uint256 date, uint256 totalSteps, uint256 totalSleepHours, uint256 totalExerciseMinutes, uint256 entryCount, bool exists))"
];

// ============================================
// Global State
// ============================================
let provider;
let signer;
let userAddress;
let dataMarketplaceContract;
let healthRewardsEngineContract;
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

        // Log contract addresses for debugging
        console.log('📋 Contract Addresses:');
        console.log('  DataMarketplace:', DATA_MARKETPLACE_ADDRESS);
        console.log('  HealthRewardsEngine:', HEALTH_REWARDS_ENGINE_ADDRESS);
        
        // Verify contract has code
        const marketplaceCode = await provider.getCode(DATA_MARKETPLACE_ADDRESS);
        if (marketplaceCode === '0x') {
            console.error('❌ No contract code found at DataMarketplace address:', DATA_MARKETPLACE_ADDRESS);
            alert('No contract found at the configured address. Please verify the deployment and address configuration.');
            return;
        } else {
            console.log('✅ Contract code found at DataMarketplace address');
        }
        
        // Initialize contracts
        dataMarketplaceContract = new ethers.Contract(
            DATA_MARKETPLACE_ADDRESS,
            DATA_MARKETPLACE_ABI,
            signer
        );
        
        if (HEALTH_REWARDS_ENGINE_ADDRESS) {
            healthRewardsEngineContract = new ethers.Contract(
                HEALTH_REWARDS_ENGINE_ADDRESS,
                HEALTH_REWARDS_ENGINE_ABI,
                signer
            );
        }

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
// Test Contract Connectivity
// ============================================
async function testContractConnectivity() {
    if (!dataMarketplaceContract) {
        console.error('Contract not initialized');
        return false;
    }

    try {
        // Test with a simple function first
        console.log('Testing contract connectivity...');
        console.log('Contract address:', DATA_MARKETPLACE_ADDRESS);
        
        // Try getDatasetCount first (simpler function)
        try {
            const count = await dataMarketplaceContract.getDatasetCount();
            console.log('✅ getDatasetCount works. Count:', count.toString());
        } catch (err) {
            console.error('❌ getDatasetCount failed:', err);
            if (err.code === 'BAD_DATA' || err.message?.includes('could not decode')) {
                console.error('Contract may not be deployed or ABI mismatch. Error details:', {
                    code: err.code,
                    message: err.message,
                    info: err.info
                });
            }
            return false;
        }
        
        // Now try getActiveDatasetIds
        try {
            const activeIds = await dataMarketplaceContract.getActiveDatasetIds();
            console.log('✅ getActiveDatasetIds works. Active IDs:', activeIds);
            return true;
        } catch (err) {
            console.error('❌ getActiveDatasetIds failed:', err);
            if (err.code === 'BAD_DATA' || err.message?.includes('could not decode')) {
                console.error('getActiveDatasetIds error details:', {
                    code: err.code,
                    message: err.message,
                    info: err.info
                });
                // Check if contract has code
                const code = await provider.getCode(DATA_MARKETPLACE_ADDRESS);
                if (code === '0x') {
                    console.error('❌ No contract code at address:', DATA_MARKETPLACE_ADDRESS);
                } else {
                    console.log('✅ Contract has code at address');
                }
            }
            return false;
        }
    } catch (error) {
        console.error('Contract connectivity test failed:', error);
        return false;
    }
}

// Load Datasets from Contract
// ============================================
async function loadDatasets() {
    if (!isConnected || !dataMarketplaceContract) {
        console.log('Not connected to contract');
        return;
    }

    try {
        showNotification('Loading datasets...', 'info');
        
        // First, test contract connectivity
        const isConnected = await testContractConnectivity();
        if (!isConnected) {
            showNotification('Contract connectivity issue detected. Check console for details.', 'error');
            return;
        }
        
        // Get active dataset IDs
        // Handle case where contract might not have this function or reverts
        let activeIds = [];
        try {
            activeIds = await dataMarketplaceContract.getActiveDatasetIds();
        } catch (err) {
            // If function doesn't exist or reverts, return empty array
            if (err.code === 'BAD_DATA' || err.message?.includes('could not decode')) {
                console.warn('getActiveDatasetIds: Contract function not available. Please redeploy DataMarketplace contract with latest code.');
                showNotification('Contract function not available. Please redeploy DataMarketplace contract with latest code.', 'warning');
            } else {
                console.warn('getActiveDatasetIds failed:', err);
            }
            activeIds = [];
            // Return early since we can't load datasets without this function
            return;
        }
        
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
        // Note: renderDatasets() removed since we no longer display available datasets
        // Datasets are still loaded for purchased datasets display
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
        
        // Check if it's a contract function availability issue
        if (error.code === 'BAD_DATA' || error.message?.includes('could not decode')) {
            console.warn('getPurchasedDatasets: Contract function not available. Please redeploy DataMarketplace contract with latest code.');
            // Don't show notification here as it's not critical - user just won't see purchased datasets
        }
        
        purchasedDatasetIds = [];
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
// Calculate Dataset Price
// ============================================
async function calculateDatasetPrice() {
    if (!isConnected || !dataMarketplaceContract) {
        alert('Please connect your wallet first!');
        return;
    }

    const startDate = document.getElementById('customStartDate').value;
    const endDate = document.getElementById('customEndDate').value;

    if (!startDate || !endDate) {
        document.getElementById('calculatedPrice').textContent = 'Please select both start and end dates';
        document.getElementById('calculatedPrice').style.color = '#f44336';
        return;
    }

    const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);

    if (startTimestamp >= endTimestamp) {
        document.getElementById('calculatedPrice').textContent = 'End date must be after start date';
        document.getElementById('calculatedPrice').style.color = '#f44336';
        return;
    }

    // Check if end date is in the future
    const now = Math.floor(Date.now() / 1000);
    if (endTimestamp > now) {
        document.getElementById('calculatedPrice').textContent = 'End date must be in the past';
        document.getElementById('calculatedPrice').style.color = '#f44336';
        return;
    }

    try {
        // Call contract to calculate price (single source of truth)
        // Check if contract has this function (may fail if contract is outdated)
        let result;
        try {
            result = await dataMarketplaceContract.calculatePriceForPeriod(
                startTimestamp,
                endTimestamp
            );
        } catch (contractError) {
            // Contract might not have this function yet - check if it's a revert
            if (contractError.code === 'BAD_DATA' || contractError.message?.includes('could not decode')) {
                throw new Error('Contract function not available. Please redeploy DataMarketplace contract with latest code.');
            }
            throw contractError;
        }

        const priceInWei = result.price;
        const totalEntries = Number(result.totalEntries);
        const priceInEth = parseFloat(ethers.formatEther(priceInWei));
        
        // Debug: Log what the contract actually returned
        console.log('Contract returned:', { priceInWei: priceInWei.toString(), totalEntries, priceInEth });
        
        const priceDisplay = document.getElementById('calculatedPrice');
        // Only display price and entries - no additional messages
        priceDisplay.textContent = `${priceInEth} ETH (${totalEntries.toLocaleString()} entries)`;
        priceDisplay.style.color = '#2196f3';
    } catch (error) {
        console.error('Error calculating price:', error);
        let errorMsg = 'Error calculating price';
        
        // Try to extract a more helpful error message
        if (error.reason) {
            errorMsg = error.reason;
        } else if (error.message) {
            // Check for common error patterns
            if (error.message.includes('Invalid time period') || error.message.includes('Invalid date range')) {
                errorMsg = 'Invalid date range selected';
            } else if (error.message.includes('reverted')) {
                errorMsg = 'Contract call failed - check date range is valid';
            } else {
                errorMsg = error.message;
            }
        }
        
        document.getElementById('calculatedPrice').textContent = errorMsg;
        document.getElementById('calculatedPrice').style.color = '#f44336';
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

    // Check if end date is in the past
    const now = Math.floor(Date.now() / 1000);
    if (endTimestamp > now) {
        alert('End date must be in the past for preview');
        return;
    }

    try {
        showNotification('Loading aggregated data preview...', 'info');
        
        let preview;
        try {
            preview = await dataMarketplaceContract.previewAggregatedData(
                startTimestamp,
                endTimestamp
            );
        } catch (contractError) {
            // Contract might not have this function yet - check if it's a revert
            if (contractError.code === 'BAD_DATA' || contractError.message?.includes('could not decode')) {
                throw new Error('Contract function not available. Please redeploy DataMarketplace contract with latest code.');
            }
            throw contractError;
        }

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
        let errorMsg = 'Failed to preview data';
        
        if (error.reason) {
            errorMsg = error.reason;
        } else if (error.message) {
            if (error.message.includes('Contract function not available')) {
                errorMsg = error.message;
            } else if (error.message.includes('Invalid time period') || error.message.includes('Invalid date range')) {
                errorMsg = 'Invalid date range selected';
            } else if (error.message.includes('could not decode')) {
                errorMsg = 'Contract function not available. Please redeploy DataMarketplace contract with latest code.';
            } else {
                errorMsg = error.message;
            }
        }
        
        showNotification(errorMsg, 'error');
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
    const minAge = parseInt(document.getElementById('customMinAge').value);
    const maxAge = parseInt(document.getElementById('customMaxAge').value);
    const region = document.getElementById('customRegion').value;

    if (!title || !startDate || !endDate || !region) {
        alert('Please fill in all fields');
        return;
    }

    const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);

    if (startTimestamp >= endTimestamp) {
        alert('End date must be after start date');
        return;
    }

    // Calculate price based on data entries (from contract - single source of truth)
    let priceInWei;
    let priceInEth;
    let totalEntries;
    try {
        showNotification('Calculating price based on data entries...', 'info');
        
        if (!dataMarketplaceContract) {
            throw new Error('Contract not connected');
        }
        
        // Call contract to calculate price (ensures consistency)
        let priceResult;
        try {
            priceResult = await dataMarketplaceContract.calculatePriceForPeriod(
                startTimestamp,
                endTimestamp
            );
        } catch (contractError) {
            // Contract might not have this function yet - check if it's a revert
            if (contractError.code === 'BAD_DATA' || contractError.message?.includes('could not decode')) {
                throw new Error('Contract function not available. Please redeploy DataMarketplace contract with latest code.');
            }
            throw contractError;
        }
        
        priceInWei = priceResult.price;
        totalEntries = Number(priceResult.totalEntries);
        priceInEth = parseFloat(ethers.formatEther(priceInWei));
        
        const confirmMsg = `Purchase custom dataset "${title}"?\n\n` +
            `Period: ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}\n` +
            `Data Entries: ${totalEntries.toLocaleString()}\n` +
            `Calculated Price: ${priceInEth} ETH\n\n` +
            `Proceed with purchase?`;
    
    if (!confirm(confirmMsg)) {
            return;
        }
    } catch (error) {
        console.error('Error calculating price:', error);
        alert('Failed to calculate price: ' + (error.message || 'Unknown error'));
        return;
    }

    try {
        showNotification('Creating dataset and processing purchase...', 'info');
        
        // Use placeholder for dataLocation since we'll generate CSV directly
        const dataLocation = "CSV_DOWNLOAD";
        
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

        let datasetId = null;
        if (event) {
            const parsed = dataMarketplaceContract.interface.parseLog(event);
            datasetId = Number(parsed.args.datasetId);
            purchasedDatasetIds.push(datasetId);
        }

        // Generate and download CSV from aggregated data
        if (healthRewardsEngineContract) {
            try {
                showNotification('Generating CSV download...', 'info');
                await generateAndDownloadCSV(startTimestamp, endTimestamp, title, region, minAge, maxAge);
            } catch (error) {
                console.error('Error generating CSV:', error);
                showNotification('Dataset purchased but CSV generation failed. You can access data via contract.', 'error');
            }
        }

        // Reload datasets
        await loadDatasets();
        await loadPurchasedDatasets();
        
        showNotification(`Successfully created and purchased custom dataset! CSV downloaded.`, 'success');
        
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
    // Check if element exists (it was removed from HTML)
    if (!grid) {
        return; // Silently return if grid doesn't exist
    }
    
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
// filterDatasets() removed - filter section was removed from UI

// ============================================
// CSV Generation Functions
// ============================================
async function generateAndDownloadCSV(startTimestamp, endTimestamp, title, region, minAge, maxAge) {
    if (!healthRewardsEngineContract) {
        throw new Error('HealthRewardsEngine contract not available');
    }

    // Calculate day timestamps
    const startDay = Math.floor(startTimestamp / 86400);
    const endDay = Math.floor(endTimestamp / 86400);

    // Fetch aggregated data
    const aggregated = await healthRewardsEngineContract.getAggregatedDataForRange(startDay, endDay);
    
    const totalSteps = Number(aggregated.totalSteps);
    const totalSleepHours = Number(aggregated.totalSleepHours);
    const totalExerciseMinutes = Number(aggregated.totalExerciseMinutes);
    const totalEntries = Number(aggregated.totalEntries);
    const uniqueDays = Number(aggregated.uniqueDays);

    // Calculate averages
    const avgSteps = totalEntries > 0 ? Math.round(totalSteps / totalEntries) : 0;
    const avgSleepHours = totalEntries > 0 ? (totalSleepHours / totalEntries / 60).toFixed(2) : 0;
    const avgExerciseMinutes = totalEntries > 0 ? Math.round(totalExerciseMinutes / totalEntries) : 0;

    // Fetch daily aggregates for detailed CSV
    const dailyData = [];
    for (let day = startDay; day <= endDay; day++) {
        try {
            const daily = await healthRewardsEngineContract.getDailyAggregate(day);
            if (daily.exists) {
                const date = new Date(Number(daily.date) * 86400 * 1000);
                dailyData.push({
                    date: date.toISOString().split('T')[0],
                    totalSteps: Number(daily.totalSteps),
                    totalSleepHours: (Number(daily.totalSleepHours) / 60).toFixed(2),
                    totalExerciseMinutes: Number(daily.totalExerciseMinutes),
                    entryCount: Number(daily.entryCount),
                    avgSteps: Number(daily.entryCount) > 0 ? Math.round(Number(daily.totalSteps) / Number(daily.entryCount)) : 0,
                    avgSleepHours: Number(daily.entryCount) > 0 ? (Number(daily.totalSleepHours) / Number(daily.entryCount) / 60).toFixed(2) : 0,
                    avgExerciseMinutes: Number(daily.entryCount) > 0 ? Math.round(Number(daily.totalExerciseMinutes) / Number(daily.entryCount)) : 0
                });
            }
        } catch (error) {
            // Skip days without data
            continue;
        }
    }

    // Generate CSV content
    let csv = `FitDAO Health Dataset - ${title}\n`;
    csv += `Region: ${region}\n`;
    csv += `Age Range: ${minAge}-${maxAge}\n`;
    csv += `Period: ${new Date(startTimestamp * 1000).toISOString().split('T')[0]} to ${new Date(endTimestamp * 1000).toISOString().split('T')[0]}\n`;
    csv += `Total Entries: ${totalEntries.toLocaleString()}\n`;
    csv += `Unique Days: ${uniqueDays}\n`;
    csv += `Estimated Users: ${Math.max(100, Math.round(totalEntries / uniqueDays))}\n`;
    csv += `\n`;
    csv += `Overall Averages:\n`;
    csv += `Average Daily Steps,${avgSteps}\n`;
    csv += `Average Sleep Hours,${avgSleepHours}\n`;
    csv += `Average Exercise Minutes,${avgExerciseMinutes}\n`;
    csv += `\n`;
    csv += `Daily Breakdown:\n`;
    csv += `Date,Total Steps,Total Sleep Hours,Total Exercise Minutes,Entry Count,Avg Steps,Avg Sleep Hours,Avg Exercise Minutes\n`;
    
    dailyData.forEach(row => {
        csv += `${row.date},${row.totalSteps},${row.totalSleepHours},${row.totalExerciseMinutes},${row.entryCount},${row.avgSteps},${row.avgSleepHours},${row.avgExerciseMinutes}\n`;
    });

    // Create download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `fitdao-dataset-${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    // renderDatasets() not needed - dataset grid was removed
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
            if (cfg && cfg.HealthRewardsEngine) {
                HEALTH_REWARDS_ENGINE_ADDRESS = cfg.HealthRewardsEngine;
                console.log('[FitDAO] Loaded HealthRewardsEngine address from config:', HEALTH_REWARDS_ENGINE_ADDRESS);
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
            }
            // renderDatasets() not needed - dataset grid was removed
        });
    }
    // renderDatasets() not needed - dataset grid was removed
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
