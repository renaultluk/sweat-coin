# FitDAO - Sweat to Earn

**Decentralized Health Tracking Rewards Scheme**

FitDAO is a blockchain-based platform that rewards users with SWEAT tokens for maintaining healthy lifestyles. Users can earn tokens by tracking their health data, redeem them for merchant coupons, and researchers can purchase aggregated health datasets.

---

## 📋 Table of Contents

- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Development](#development)
- [Smart Contracts](#smart-contracts)
- [Web Interface](#web-interface)
- [Testing](#testing)
- [Deployment](#deployment)
- [File Purposes](#file-purposes)
- [Development Workflow](#development-workflow)
- [Important Notes](#important-notes)

---

## 📁 Project Structure

```
sweat-coin/
│
├── 📋 Configuration Files
│   ├── package.json                  # Dependencies and npm scripts
│   ├── hardhat.config.js             # Hardhat configuration (networks, etc.)
│   ├── .env.example                  # Environment variables template
│   ├── .env                          # Your actual secrets (CREATE THIS!)
│   └── .gitignore                    # Git ignore rules
│
├── 💼 Smart Contracts
│   └── contracts/
│       ├── interfaces/
│       │   └── ISweatCoin.sol        # Token interface (contract ↔ contract)
│       ├── SweatCoinToken.sol        # ERC-20 token implementation
│       ├── HealthRewardsEngine.sol   # Rewards validation & minting
│       └── DataMarketplace.sol      # Data marketplace for researchers
│
├── 🚀 Deployment Scripts
│   └── scripts/
│       └── deploy.js                 # Automated deployment script
│
├── 🧪 Tests
│   └── test/
│       └── FitDAO.test.js           # Comprehensive test suite
│
├── 🌐 Web Interface
│   ├── index.html                    # Original frontend UI
│   ├── web-interface.js              # Web3 integration with Ethers.js
│   └── views/                        # Modern multi-view interface
│       ├── index.html                # Navigation page
│       ├── user/                     # User dashboard
│       │   ├── index.html
│       │   ├── styles.css
│       │   └── script.js
│       ├── data-consumer/            # Data marketplace view
│       │   ├── index.html
│       │   ├── styles.css
│       │   └── script.js
│       └── merchant/                 # Merchant dashboard
│           ├── index.html
│           ├── styles.css
│           └── script.js
│
├── 📚 Documentation & Context
│   ├── README.md                     # This file
│   ├── PROJECT_STRUCTURE.txt         # Legacy structure doc
│   └── context/
│       └── economic_model.md         # Economic model documentation
│
├── 🛠️ Utilities
│   └── quickstart.sh                 # Automated setup script
│
└── 📁 Auto-Generated (after running commands)
    ├── node_modules/                 # Dependencies (npm install)
    ├── artifacts/                    # Compiled contracts (npm run compile)
    ├── cache/                        # Hardhat cache
    └── deployments/                  # Deployment records (npm run deploy)
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MetaMask browser extension
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd sweat-coin
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your private key and RPC URLs
   ```

4. **Compile contracts**
   ```bash
   npm run compile
   ```

5. **Run tests**
   ```bash
   npm test
   ```

---

## 💻 Development

### Available Scripts

```bash
# Compile contracts
npm run compile

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Clean build files
npm run clean

# Start local Hardhat node
npm run node

# Deploy to local network
npm run deploy:local

# Deploy to Sepolia testnet
npm run deploy:sepolia

# Deploy to Polygon mainnet
npm run deploy:polygon
```

### Local Development

1. **Start local blockchain** (Terminal 1)
   ```bash
   npm run node
   ```

2. **Deploy contracts** (Terminal 2)
   ```bash
   npm run deploy:local
   ```

3. **Open web interface**
   - Open `views/index.html` in your browser
   - Or use `index.html` for the original interface
   - Connect MetaMask to localhost:8545
   - Test functionality

---

## 💼 Smart Contracts

### Core Contracts

#### 1. **SweatCoinToken.sol**
- ERC-20 token implementation
- Role-based minting and burning
- Implements `ISweatCoin` interface
- Roles: `MINTER_ROLE`, `BURNER_ROLE`

#### 2. **HealthRewardsEngine.sol**
- Validates health data from trusted oracle
- Calculates and distributes SWEAT rewards
- Reward rates:
  - Steps: 1 SWEAT per 1000 steps
  - Sleep: 5 SWEAT per good sleep night
  - Exercise: 10 SWEAT per 30 minutes
- Cooldown mechanism to prevent spam

#### 3. **DataMarketplace.sol**
- Marketplace for aggregated health datasets
- Accepts ETH payments from researchers
- Privacy-compliant (minimum 100 users per dataset)
- Non-exclusive sales (same dataset can be sold multiple times)
- All revenue goes to treasury

#### 4. **ISweatCoin.sol**
- Interface for token contract interactions
- Allows contracts to interact without importing full implementation

---

## 🌐 Web Interface

### Views

The project includes three main views accessible from `views/index.html`:

#### 1. **User Dashboard** (`views/user/`)
- Submit health data (steps, sleep, exercise, heart rate)
- View SWEAT balance and earnings
- Browse and redeem merchant coupons
- Track activity history
- Real-time reward calculation

#### 2. **Data Marketplace** (`views/data-consumer/`)
- Browse available aggregated health datasets
- Filter by region, price, user count
- Purchase datasets with ETH
- Access purchased datasets
- View dataset statistics

#### 3. **Merchant Dashboard** (`views/merchant/`)
- Create and manage coupons
- Track redemptions and ROI
- View business analytics
- Monitor subsidies received
- Manage coupon status (active/paused)

### Features

- **Modern UI**: Gradient backgrounds, card layouts, smooth animations
- **Responsive Design**: Works on desktop and mobile devices
- **Mock Functionality**: Fully interactive with simulated backend
- **Wallet Integration**: MetaMask connection support
- **Modular Structure**: Separated CSS and JavaScript files

---

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run with gas reporting
REPORT_GAS=true npm test

# Run with coverage
npm run test:coverage
```

### Test Coverage

The test suite (`test/FitDAO.test.js`) includes:
- Token minting and burning
- Health data validation
- Reward calculations
- Access control
- Edge cases and error handling

---

## 🚀 Deployment

### Local Network

```bash
# Terminal 1: Start local node
npm run node

# Terminal 2: Deploy contracts
npm run deploy:local
```

### Testnet Deployment (Sepolia)

1. Get test ETH from a faucet
2. Update `.env` with your private key and Sepolia RPC URL
3. Deploy:
   ```bash
   npm run deploy:sepolia
   ```

### Mainnet Deployment (Polygon)

⚠️ **Only deploy after security audit!**

```bash
npm run deploy:polygon
```

---

## 📝 File Purposes

### Configuration
- **package.json** → Dependencies and npm scripts
- **hardhat.config.js** → Network configuration, compiler settings
- **.env** → Private keys and API keys (NEVER commit!)
- **.gitignore** → Prevents committing secrets

### Smart Contracts
- **ISweatCoin.sol** → Interface for contract-to-contract communication
- **SweatCoinToken.sol** → ERC-20 token with role-based access
- **HealthRewardsEngine.sol** → Validates health data and mints rewards
- **DataMarketplace.sol** → Marketplace for health datasets

### Scripts
- **deploy.js** → Automated contract deployment

### Tests
- **FitDAO.test.js** → Comprehensive test suite

### Web Interface
- **index.html** → Original single-page interface
- **web-interface.js** → Blockchain integration
- **views/** → Modern multi-view interface with separated CSS/JS

### Documentation
- **README.md** → This file
- **context/economic_model.md** → Economic model and business logic

---

## 🔄 Development Workflow

### 1. Initial Setup (Once)
```bash
npm install
cp .env.example .env
# Edit .env with your private key
```

### 2. Development Cycle (Repeat)
```bash
# Write/modify contracts
npm run compile
npm test
# Fix any issues
# Repeat
```

### 3. Local Testing
```bash
# Terminal 1
npm run node

# Terminal 2
npm run deploy:local

# Browser
# Open views/index.html
# Connect MetaMask
# Test functionality
```

### 4. Testnet Deployment
```bash
# Get test ETH from faucets
npm run deploy:sepolia
# Test with real blockchain
```

### 5. Production (After Audit!)
```bash
# Security audit
npm run deploy:polygon
# Launch!
```

---

## ⚠️ Important Notes

### Security
- **NEVER commit `.env` to Git**
- Use a **TEST wallet** for development
- Keep **private keys secure**
- Always test locally before deploying

### Tips
- Test everything locally first
- Read error messages carefully
- Commit code frequently
- Document as you go
- Use the views interface for better UX

### Getting Help
- Check inline comments in code
- Review `context/economic_model.md` for business logic
- Search error messages online
- Ask team members

---

## 📚 Additional Resources

- **Economic Model**: See `context/economic_model.md` for detailed economic design
- **Contract Documentation**: Inline comments in Solidity files
- **Web Interface**: Check `views/` folder for modern UI components

---

## 👥 Authors

**FitDAO Team**
- Luk Wang Lok
- Lee JunHyuk
- Lin Huang Isidora Suyu

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🎯 Next Steps

### Right Now
1. Read this README
2. Run `npm install`
3. Create `.env` file
4. Run `npm test`

### Today
1. Deploy to local network
2. Open `views/index.html`
3. Test all features
4. Read smart contracts

### This Week
1. Integrate views with smart contracts
2. Add more tests
3. Deploy to testnet
4. Gather user feedback

---

**Happy coding! 💪**

For questions or issues, please open an issue on the repository.

