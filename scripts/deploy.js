const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting FitDAO Deployment...\n");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deploying contracts with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // ============================================
  // 1. Deploy SweatCoin Token
  // ============================================
  console.log("📝 Deploying SweatCoin Token...");
  const SweatCoinToken = await hre.ethers.getContractFactory("SweatCoinToken");
  const sweatCoin = await SweatCoinToken.deploy();
  await sweatCoin.waitForDeployment();
  
  const sweatCoinAddress = await sweatCoin.getAddress();
  console.log("✅ SweatCoin deployed to:", sweatCoinAddress);
  console.log("   Token Name:", await sweatCoin.name());
  console.log("   Token Symbol:", await sweatCoin.symbol());
  console.log("");

  // ============================================
  // 2. Deploy Health Rewards Engine
  // ============================================
  console.log("📝 Deploying Health Rewards Engine...");
  
  // For now, use deployer as oracle (replace with actual oracle later)
  const oracleAddress = deployer.address; // HealthRewardsEngine expects an oracle address

  const HealthRewardsEngine = await hre.ethers.getContractFactory("HealthRewardsEngine");
  const healthRewards = await HealthRewardsEngine.deploy(
    sweatCoinAddress,
    oracleAddress
  );
  await healthRewards.waitForDeployment();
  
  const healthRewardsAddress = await healthRewards.getAddress();
  console.log("✅ Health Rewards Engine deployed to:", healthRewardsAddress);
  console.log("   Oracle Address for HealthRewardsEngine:", oracleAddress);
  console.log("");

  // ============================================
  // 3. Deploy Mock Price Oracle
  // ============================================
  console.log("📝 Deploying MockPriceOracle...");
  const MockPriceOracle = await hre.ethers.getContractFactory("MockPriceOracle");
  const mockPriceOracle = await MockPriceOracle.deploy();
  await mockPriceOracle.waitForDeployment();
  const mockPriceOracleAddress = await mockPriceOracle.getAddress();
  console.log("✅ MockPriceOracle deployed to:", mockPriceOracleAddress);
  console.log("");

  // ============================================
  // 4. Deploy Mock UniswapV2 Router02
  // ============================================
  console.log("📝 Deploying MockUniswapV2Router02...");
  const MockUniswapV2Router02 = await hre.ethers.getContractFactory("MockUniswapV2Router02");
  const mockUniswapRouter = await MockUniswapV2Router02.deploy();
  await mockUniswapRouter.waitForDeployment();
  const mockUniswapRouterAddress = await mockUniswapRouter.getAddress();
  console.log("✅ MockUniswapV2Router02 deployed to:", mockUniswapRouterAddress);
  console.log("");

  // ============================================
  // 5. Deploy Treasury
  // ============================================
  console.log("📝 Deploying Treasury...");
  const Treasury = await hre.ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(mockPriceOracleAddress, mockUniswapRouterAddress);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress(); // This is the real treasury address now
  console.log("✅ Treasury deployed to:", treasuryAddress);
  console.log("   Price Oracle (for Treasury):", mockPriceOracleAddress);
  console.log("   Uniswap Router (for Treasury):", mockUniswapRouterAddress);
  console.log("");

  // ============================================
  // 6. Deploy MerchantGateway
  // ============================================
  console.log("📝 Deploying MerchantGateway...");
  const MerchantGateway = await hre.ethers.getContractFactory("MerchantGateway");
  const merchantGateway = await MerchantGateway.deploy(sweatCoinAddress, treasuryAddress);
  await merchantGateway.waitForDeployment();
  const merchantGatewayAddress = await merchantGateway.getAddress();
  console.log("✅ MerchantGateway deployed to:", merchantGatewayAddress);
  console.log("   SweatCoin Token:", sweatCoinAddress);
  console.log("   Treasury:", treasuryAddress);
  console.log("");

  // ============================================
  // 7. Deploy Data Marketplace
  // ============================================
  console.log("📝 Deploying Data Marketplace...");
  // Now pass the actual Treasury address
  const DataMarketplace = await hre.ethers.getContractFactory("DataMarketplace");
  const dataMarketplace = await DataMarketplace.deploy(
    treasuryAddress, // Use the real Treasury address
    healthRewardsAddress
  );
  await dataMarketplace.waitForDeployment();
  
  const dataMarketplaceAddress = await dataMarketplace.getAddress();
  console.log("✅ Data Marketplace deployed to:", dataMarketplaceAddress);
  console.log("   Treasury Address:", treasuryAddress);
  console.log("");

  // ============================================
  // 8. Grant Minter Role to Health Rewards Engine
  // ============================================
  console.log("🔐 Setting up permissions (Health Rewards Engine MINTER_ROLE)...");
  
  const minterRole = await sweatCoin.MINTER_ROLE();
  let grantTx = await sweatCoin.grantMinterRole(healthRewardsAddress);
  await grantTx.wait();
  
  // Verify the role was granted
  let hasRole = await sweatCoin.hasRole(minterRole, healthRewardsAddress);
  console.log("   ✅ MINTER_ROLE granted to Health Rewards Engine:", hasRole);
  console.log("");

  // ============================================
  // 9. Grant Burner Role to MerchantGateway
  // ============================================
  console.log("🔐 Setting up permissions (MerchantGateway BURNER_ROLE)...");
  
  const burnerRole = await sweatCoin.BURNER_ROLE();
  grantTx = await sweatCoin.grantBurnerRole(merchantGatewayAddress);
  await grantTx.wait();
  
  // Verify the role was granted
  hasRole = await sweatCoin.hasRole(burnerRole, merchantGatewayAddress);
  console.log("   ✅ BURNER_ROLE granted to MerchantGateway:", hasRole);
  console.log("");

  // ============================================
  // 10. Link Treasury to SweatCoin and MerchantGateway
  // ============================================
  console.log("🔗 Setting up Treasury integrations...");
  console.log("   Setting SweatCoin address in Treasury...");
  let setAddressTx = await treasury.setSweatCoinAddress(sweatCoinAddress);
  await setAddressTx.wait();
  console.log("   ✅ SweatCoin address set in Treasury");

  console.log("   Setting MerchantGateway address in Treasury...");
  setAddressTx = await treasury.setMerchantGatewayAddress(merchantGatewayAddress);
  await setAddressTx.wait();
  console.log("   ✅ MerchantGateway address set in Treasury");
  console.log("");

  // ============================================
  // 11. Set up HealthRewardsEngine Integration with DataMarketplace
  // ============================================
  console.log("🔗 Setting up HealthRewardsEngine integration with DataMarketplace...");
  
  const setMarketplaceTx = await healthRewards.setDataMarketplace(dataMarketplaceAddress);
  await setMarketplaceTx.wait();
  
  console.log("   ✅ HealthRewardsEngine integration complete");
  console.log("");
  
  // ============================================
  // 12. Set up DataMarketplace Integration with Treasury (already handled in deployment)
  // ============================================
  // No explicit call needed as treasuryAddress is passed in DataMarketplace deployment

  // ============================================
  // 13. Display Summary
  // ============================================
  console.log("📊 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SweatCoin Token:         ", sweatCoinAddress);
  console.log("Health Rewards Engine:   ", healthRewardsAddress);
  console.log("MockPriceOracle:         ", mockPriceOracleAddress);
  console.log("MockUniswapRouter:       ", mockUniswapRouterAddress);
  console.log("Treasury:                ", treasuryAddress);
  console.log("MerchantGateway:         ", merchantGatewayAddress);
  console.log("Data Marketplace:        ", dataMarketplaceAddress);
  console.log("Deployer Address:        ", deployer.address);
  console.log("Network:                 ", hre.network.name);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  // ============================================
  // 14. Save Deployment Info
  // ============================================
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      SweatCoinToken: {
        address: sweatCoinAddress,
        name: await sweatCoin.name(),
        symbol: await sweatCoin.symbol(),
      },
      HealthRewardsEngine: {
        address: healthRewardsAddress,
        oracle: oracleAddress,
      },
      MockPriceOracle: {
        address: mockPriceOracleAddress,
      },
      MockUniswapV2Router02: {
        address: mockUniswapRouterAddress,
      },
      Treasury: {
        address: treasuryAddress,
        priceOracle: mockPriceOracleAddress,
        uniswapRouter: mockUniswapRouterAddress,
      },
      MerchantGateway: {
        address: merchantGatewayAddress,
        sweatCoin: sweatCoinAddress,
        treasury: treasuryAddress,
      },
      DataMarketplace: {
        address: dataMarketplaceAddress,
        treasury: treasuryAddress, // Now pointing to the deployed Treasury contract
        healthRewardsEngine: healthRewardsAddress,
      },
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const filename = `deployment-${hre.network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("💾 Deployment info saved to:", filename);
  console.log("");

  // ============================================
  // 15. Write Frontend Address Config (latest per network)
  // ============================================
  try {
    const frontendConfigDir = path.join(__dirname, "..", "views", "config");
    if (!fs.existsSync(frontendConfigDir)) {
      fs.mkdirSync(frontendConfigDir, { recursive: true });
    }

    const frontendAddresses = {
      network: hre.network.name,
      SweatCoinToken: deploymentInfo.contracts.SweatCoinToken.address,
      HealthRewardsEngine: deploymentInfo.contracts.HealthRewardsEngine.address,
      DataMarketplace: deploymentInfo.contracts.DataMarketplace.address,
      MockPriceOracle: deploymentInfo.contracts.MockPriceOracle.address, // Add new contract addresses
      MockUniswapV2Router02: deploymentInfo.contracts.MockUniswapV2Router02.address,
      Treasury: deploymentInfo.contracts.Treasury.address,
      MerchantGateway: deploymentInfo.contracts.MerchantGateway.address,
    };

    const frontendFile = path.join(
      frontendConfigDir,
      `addresses-${hre.network.name}.json`
    );
    fs.writeFileSync(frontendFile, JSON.stringify(frontendAddresses, null, 2));

    console.log("🌐 Frontend addresses written to:", path.relative(process.cwd(), frontendFile));
    console.log("");
  } catch (err) {
    console.error("⚠️ Failed to write frontend address config:", err);
  }

  // ============================================
  // 16. Verification Instructions
  // ============================================
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("🔍 To verify contracts on block explorer, run:");
    console.log("");
    console.log(`npx hardhat verify --network ${hre.network.name} ${sweatCoinAddress}`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${healthRewardsAddress} ${sweatCoinAddress} ${oracleAddress}`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${mockPriceOracleAddress}`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${mockUniswapRouterAddress}`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${treasuryAddress} ${mockPriceOracleAddress} ${mockUniswapRouterAddress}`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${merchantGatewayAddress} ${sweatCoinAddress} ${treasuryAddress}`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${dataMarketplaceAddress} ${treasuryAddress} ${healthRewardsAddress}`);
    console.log("");
  }

  // ============================================
  // 17. Next Steps
  // ============================================
  console.log("📋 Next Steps:");
  console.log("1. Update .env file with deployed contract addresses (if needed)");
  console.log("2. Open 'views/merchant/index.html' in your browser and connect your wallet.");
  console.log("3. Test the full functionality from the merchant dashboard.");
  console.log("4. Consider implementing unit tests for Treasury and MerchantGateway if not already done.");
  console.log("5. For production, replace MockPriceOracle and MockUniswapV2Router02 with real counterparts.");
  console.log("");
  console.log("✨ Deployment complete!");
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
