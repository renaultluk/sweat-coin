// Mock datasets
const mockDatasets = [
    {
        id: 1,
        title: "Hong Kong Young Adults Activity Patterns",
        userCount: 10000,
        startTimestamp: new Date('2024-01-01').getTime() / 1000,
        endTimestamp: new Date('2024-06-30').getTime() / 1000,
        price: 2.0,
        averageDailySteps: 7500,
        averageSleepHours: 420,
        averageExerciseMinutes: 192,
        minAge: 20,
        maxAge: 60,
        region: "Hong Kong",
        dataLocation: "ipfs://QmXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx",
        purchaseCount: 8,
        description: "Comprehensive 6-month dataset of physical activity patterns for young adults in Hong Kong. Includes step counts, sleep patterns, and exercise frequency."
    },
    {
        id: 2,
        title: "Singapore Sleep Quality Study",
        userCount: 5000,
        startTimestamp: new Date('2024-03-01').getTime() / 1000,
        endTimestamp: new Date('2024-08-31').getTime() / 1000,
        price: 1.5,
        averageDailySteps: 8200,
        averageSleepHours: 450,
        averageExerciseMinutes: 180,
        minAge: 25,
        maxAge: 55,
        region: "Singapore",
        dataLocation: "ipfs://QmYyYyYyYyYyYyYyYyYyYyYyYyYyYyYyYyYyYyYy",
        purchaseCount: 12,
        description: "6-month study focusing on sleep quality and its correlation with daily activity levels in Singapore."
    },
    {
        id: 3,
        title: "Global Fitness Trends 2024",
        userCount: 50000,
        startTimestamp: new Date('2024-01-01').getTime() / 1000,
        endTimestamp: new Date('2024-12-31').getTime() / 1000,
        price: 5.0,
        averageDailySteps: 6800,
        averageSleepHours: 420,
        averageExerciseMinutes: 150,
        minAge: 18,
        maxAge: 70,
        region: "Global",
        dataLocation: "ipfs://QmZzZzZzZzZzZzZzZzZzZzZzZzZzZzZzZzZzZzZz",
        purchaseCount: 25,
        description: "Year-long global dataset covering fitness trends across multiple regions. Ideal for large-scale research projects."
    },
    {
        id: 4,
        title: "Hong Kong Heart Rate Analysis",
        userCount: 8000,
        startTimestamp: new Date('2024-02-01').getTime() / 1000,
        endTimestamp: new Date('2024-07-31').getTime() / 1000,
        price: 3.0,
        averageDailySteps: 7800,
        averageSleepHours: 435,
        averageExerciseMinutes: 210,
        minAge: 30,
        maxAge: 65,
        region: "Hong Kong",
        dataLocation: "ipfs://QmAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa",
        purchaseCount: 5,
        description: "Specialized dataset focusing on heart rate patterns and cardiovascular health metrics."
    },
    {
        id: 5,
        title: "Exercise Frequency Study",
        userCount: 15000,
        startTimestamp: new Date('2024-04-01').getTime() / 1000,
        endTimestamp: new Date('2024-09-30').getTime() / 1000,
        price: 2.5,
        averageDailySteps: 9000,
        averageSleepHours: 440,
        averageExerciseMinutes: 240,
        minAge: 22,
        maxAge: 50,
        region: "Global",
        dataLocation: "ipfs://QmBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb",
        purchaseCount: 15,
        description: "Focused study on exercise frequency and intensity patterns across different age groups."
    }
];

let purchasedDatasets = [];
let filteredDatasets = [...mockDatasets];

function init() {
    renderDatasets();
    renderPurchasedDatasets();
}

function renderDatasets() {
    const grid = document.getElementById('datasetGrid');
    grid.innerHTML = '';

    if (filteredDatasets.length === 0) {
        grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><h3>No datasets found</h3><p>Try adjusting your filters</p></div>';
        return;
    }

    filteredDatasets.forEach(dataset => {
        const isPurchased = purchasedDatasets.includes(dataset.id);
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
    
    if (purchasedDatasets.length === 0) {
        grid.innerHTML = '';
        noPurchases.style.display = 'block';
        return;
    }

    noPurchases.style.display = 'none';
    grid.innerHTML = '';

    purchasedDatasets.forEach(datasetId => {
        const dataset = mockDatasets.find(d => d.id === datasetId);
        if (!dataset) return;

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
                <button onclick="downloadDataset(${dataset.id})" style="width: 100%; margin-top: 10px; background: #2196f3;">
                    Download Dataset
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function filterDatasets() {
    const searchTitle = document.getElementById('searchTitle').value.toLowerCase();
    const filterRegion = document.getElementById('filterRegion').value;
    const filterPrice = parseFloat(document.getElementById('filterPrice').value) || Infinity;
    const filterUsers = parseInt(document.getElementById('filterUsers').value) || 0;

    filteredDatasets = mockDatasets.filter(dataset => {
        const matchesTitle = dataset.title.toLowerCase().includes(searchTitle);
        const matchesRegion = !filterRegion || dataset.region === filterRegion;
        const matchesPrice = dataset.price <= filterPrice;
        const matchesUsers = dataset.userCount >= filterUsers;

        return matchesTitle && matchesRegion && matchesPrice && matchesUsers;
    });

    renderDatasets();
}

function purchaseDataset(datasetId) {
    const dataset = mockDatasets.find(d => d.id === datasetId);
    if (!dataset) return;

    if (confirm(`Purchase "${dataset.title}" for ${dataset.price} ETH?`)) {
        // Mock purchase
        purchasedDatasets.push(datasetId);
        dataset.purchaseCount++;

        // Show success message
        alert(`Successfully purchased dataset!\n\nYou can now access the data at:\n${dataset.dataLocation}`);

        // Update UI
        renderDatasets();
        renderPurchasedDatasets();
    }
}

function downloadDataset(datasetId) {
    const dataset = mockDatasets.find(d => d.id === datasetId);
    if (!dataset) return;

    alert(`Downloading dataset: ${dataset.title}\n\nIn production, this would download the data from:\n${dataset.dataLocation}\n\nFor now, this is a mock download.`);
}

function formatPeriod(start, end) {
    const startDate = new Date(start * 1000);
    const endDate = new Date(end * 1000);
    return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
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

