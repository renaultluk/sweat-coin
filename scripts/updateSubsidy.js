const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const treasuryAddress = "0xF0bE270139EE5c7745a4a8eDa729f84143F6b611"; // Treasury address
  const treasury = await hre.ethers.getContractAt("Treasury", treasuryAddress);

  const newSubsidyETH = 5; // 5 ETH
  const newSubsidyWei = hre.ethers.parseEther(newSubsidyETH.toString());

  console.log(`Updating default merchant subsidy to ${newSubsidyETH} ETH...`);
  const tx = await treasury.connect(deployer).updateDefaultMerchantSubsidyEth(newSubsidyWei);
  await tx.wait();
  console.log(`Default merchant subsidy updated to ${newSubsidyETH} ETH successfully!`);

  const currentSubsidy = await treasury.defaultMerchantSubsidyETH();
  console.log("Current default merchant subsidy:", hre.ethers.formatEther(currentSubsidy), "ETH");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
