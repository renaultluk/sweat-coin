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
  const oracleAddress = deployer.address;
  
  const HealthRewardsEngine = await hre.ethers.getContractFactory("HealthRewardsEngine");
  const healthRewards = await HealthRewardsEngine.deploy(
    sweatCoinAddress,
    oracleAddress
  );
  await healthRewards.waitForDeployment();
  
  const healthRewardsAddress = await healthRewards.getAddress();
  console.log("✅ Health Rewards Engine deployed to:", healthRewardsAddress);
  console.log("   Oracle Address:", oracleAddress);
  console.log("");

  // ============================================
  // 3. Grant Minter Role to Health Rewards Engine
  // ============================================
  console.log("🔐 Setting up permissions...");
  console.log("   Granting MINTER_ROLE to Health Rewards Engine...");
  
  const minterRole = await sweatCoin.MINTER_ROLE();
  const grantTx = await sweatCoin.grantMinterRole(healthRewardsAddress);
  await grantTx.wait();
  
  // Verify the role was granted
  const hasRole = await sweatCoin.hasRole(minterRole, healthRewardsAddress);
  console.log("   ✅ MINTER_ROLE granted:", hasRole);
  console.log("");

  // ============================================
  // 4. Deploy Data Marketplace
  // ============================================
  console.log("📝 Deploying Data Marketplace...");
  
  // Use deployer as treasury (replace with actual treasury address later)
  const treasuryAddress = deployer.address;
  
  const DataMarketplace = await hre.ethers.getContractFactory("DataMarketplace");
  const dataMarketplace = await DataMarketplace.deploy(
    treasuryAddress,
    healthRewardsAddress
  );
  await dataMarketplace.waitForDeployment();
  
  const dataMarketplaceAddress = await dataMarketplace.getAddress();
  console.log("✅ Data Marketplace deployed to:", dataMarketplaceAddress);
  console.log("   Treasury Address:", treasuryAddress);
  console.log("");

  // ============================================
  // 5. Set up Integration
  // ============================================
  console.log("🔗 Setting up contract integration...");
  console.log("   Linking DataMarketplace to HealthRewardsEngine...");
  
  const setMarketplaceTx = await healthRewards.setDataMarketplace(dataMarketplaceAddress);
  await setMarketplaceTx.wait();
  
  console.log("   ✅ Integration complete");
  console.log("");

  // ============================================
  // 6. Display Summary
  // ============================================
  console.log("📊 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SweatCoin Token:         ", sweatCoinAddress);
  console.log("Health Rewards Engine:   ", healthRewardsAddress);
  console.log("Data Marketplace:        ", dataMarketplaceAddress);
  console.log("Oracle Address:          ", oracleAddress);
  console.log("Treasury Address:        ", treasuryAddress);
  console.log("Deployer Address:        ", deployer.address);
  console.log("Network:                 ", hre.network.name);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  // ============================================
  // 7. Save Deployment Info
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
      DataMarketplace: {
        address: dataMarketplaceAddress,
        treasury: treasuryAddress,
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
  // 8. Write Frontend Address Config (latest per network)
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
  // 9. Verification Instructions
  // ============================================
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("🔍 To verify contracts on block explorer, run:");
    console.log("");
    console.log(`npx hardhat verify --network ${hre.network.name} ${sweatCoinAddress}`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${healthRewardsAddress} ${sweatCoinAddress} ${oracleAddress}`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${dataMarketplaceAddress} ${treasuryAddress} ${healthRewardsAddress}`);
    console.log("");
  }

  // ============================================
  // 10. Next Steps
  // ============================================
  console.log("📋 Next Steps:");
  console.log("1. Update .env file with deployed contract addresses");
  console.log("2. Update web-interface.js with contract addresses");
  console.log("3. Test the contracts with: npx hardhat test");
  console.log("4. Submit health data to HealthRewardsEngine to generate aggregates");
  console.log("5. Create datasets using createDatasetFromAggregation()");
  console.log("6. Researchers can purchase datasets or use purchaseDatasetWithAggregation()");
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
