const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("FitDAO - SweatCoin & Health Rewards", function () {
  // Fixture to deploy contracts before each test
  async function deployFitDAOFixture() {
    // Get signers
    const [owner, oracle, user1, user2, user3] = await ethers.getSigners();

    // Deploy SweatCoin Token
    const SweatCoinToken = await ethers.getContractFactory("SweatCoinToken");
    const sweatCoin = await SweatCoinToken.deploy();
    await sweatCoin.waitForDeployment();

    // Deploy Health Rewards Engine
    const HealthRewardsEngine = await ethers.getContractFactory("HealthRewardsEngine");
    const healthRewards = await HealthRewardsEngine.deploy(
      await sweatCoin.getAddress(),
      oracle.address
    );
    await healthRewards.waitForDeployment();

    // Grant minter role to Health Rewards Engine
    await sweatCoin.grantMinterRole(await healthRewards.getAddress());

    return { sweatCoin, healthRewards, owner, oracle, user1, user2, user3 };
  }

  // ============================================
  // SweatCoin Token Tests
  // ============================================
  describe("SweatCoin Token", function () {
    it("Should deploy with correct name and symbol", async function () {
      const { sweatCoin } = await loadFixture(deployFitDAOFixture);

      expect(await sweatCoin.name()).to.equal("SweatCoin");
      expect(await sweatCoin.symbol()).to.equal("SWEAT");
    });

    it("Should have 18 decimals", async function () {
      const { sweatCoin } = await loadFixture(deployFitDAOFixture);

      expect(await sweatCoin.decimals()).to.equal(18);
    });

    it("Should start with zero total supply", async function () {
      const { sweatCoin } = await loadFixture(deployFitDAOFixture);

      expect(await sweatCoin.totalSupply()).to.equal(0);
    });

    it("Should grant admin role to deployer", async function () {
      const { sweatCoin, owner } = await loadFixture(deployFitDAOFixture);

      const adminRole = await sweatCoin.DEFAULT_ADMIN_ROLE();
      expect(await sweatCoin.hasRole(adminRole, owner.address)).to.be.true;
    });

    it("Should allow admin to grant minter role", async function () {
      const { sweatCoin, owner, user1 } = await loadFixture(deployFitDAOFixture);

      await sweatCoin.connect(owner).grantMinterRole(user1.address);
      
      const minterRole = await sweatCoin.MINTER_ROLE();
      expect(await sweatCoin.hasRole(minterRole, user1.address)).to.be.true;
    });

    it("Should not allow non-admin to grant minter role", async function () {
      const { sweatCoin, user1, user2 } = await loadFixture(deployFitDAOFixture);

      await expect(
        sweatCoin.connect(user1).grantMinterRole(user2.address)
      ).to.be.reverted;
    });

    // Note: Minting is tested through HealthRewardsEngine in later tests
    // Direct minting test removed as contract addresses can't be used as signers

    it("Should not allow non-minter to mint tokens", async function () {
      const { sweatCoin, user1, user2 } = await loadFixture(deployFitDAOFixture);

      const amount = ethers.parseEther("100");

      await expect(
        sweatCoin.connect(user1).mint(user2.address, amount)
      ).to.be.reverted;
    });
  });

  // ============================================
  // Health Rewards Engine Tests
  // ============================================
  describe("Health Rewards Engine", function () {
    it("Should initialize with correct oracle", async function () {
      const { healthRewards, oracle } = await loadFixture(deployFitDAOFixture);

      expect(await healthRewards.trustedOracle()).to.equal(oracle.address);
    });

    it("Should have default reward rates set", async function () {
      const { healthRewards } = await loadFixture(deployFitDAOFixture);

      expect(await healthRewards.stepsRewardRate()).to.equal(ethers.parseEther("1"));
      expect(await healthRewards.sleepRewardRate()).to.equal(ethers.parseEther("5"));
      expect(await healthRewards.exerciseRewardRate()).to.equal(ethers.parseEther("10"));
    });

    it("Should reward user for steps", async function () {
      const { sweatCoin, healthRewards, oracle, user1 } = await loadFixture(deployFitDAOFixture);

      // Submit health data: 5000 steps, no sleep, no exercise
      await healthRewards.connect(oracle).submitHealthData(
        user1.address,
        5000, // steps
        false, // good sleep
        0 // exercise minutes
      );

      // User should receive 5 SWEAT (5000 steps / 1000 * 1 SWEAT)
      const balance = await sweatCoin.balanceOf(user1.address);
      expect(balance).to.equal(ethers.parseEther("5"));
    });

    it("Should reward user for good sleep", async function () {
      const { sweatCoin, healthRewards, oracle, user1 } = await loadFixture(deployFitDAOFixture);

      // Submit health data: 0 steps, good sleep, no exercise
      await healthRewards.connect(oracle).submitHealthData(
        user1.address,
        0, // steps
        true, // good sleep
        0 // exercise minutes
      );

      // User should receive 5 SWEAT for good sleep
      const balance = await sweatCoin.balanceOf(user1.address);
      expect(balance).to.equal(ethers.parseEther("5"));
    });

    it("Should reward user for exercise", async function () {
      const { sweatCoin, healthRewards, oracle, user1 } = await loadFixture(deployFitDAOFixture);

      // Submit health data: 0 steps, no sleep, 60 minutes exercise
      await healthRewards.connect(oracle).submitHealthData(
        user1.address,
        0, // steps
        false, // good sleep
        60 // exercise minutes
      );

      // User should receive 20 SWEAT (60 / 30 * 10 SWEAT)
      const balance = await sweatCoin.balanceOf(user1.address);
      expect(balance).to.equal(ethers.parseEther("20"));
    });

    it("Should reward user for all activities combined", async function () {
      const { sweatCoin, healthRewards, oracle, user1 } = await loadFixture(deployFitDAOFixture);

      // Submit health data: 10000 steps, good sleep, 90 minutes exercise
      await healthRewards.connect(oracle).submitHealthData(
        user1.address,
        10000, // steps -> 10 SWEAT
        true, // good sleep -> 5 SWEAT
        90 // exercise minutes -> 30 SWEAT
      );

      // Total: 10 + 5 + 30 = 45 SWEAT
      const balance = await sweatCoin.balanceOf(user1.address);
      expect(balance).to.equal(ethers.parseEther("45"));
    });

    it("Should not reward if steps < 1000", async function () {
      const { sweatCoin, healthRewards, oracle, user1 } = await loadFixture(deployFitDAOFixture);

      // Submit health data: 500 steps (below threshold)
      await healthRewards.connect(oracle).submitHealthData(
        user1.address,
        500, // steps
        false,
        0
      );

      const balance = await sweatCoin.balanceOf(user1.address);
      expect(balance).to.equal(0);
    });

    it("Should not reward if exercise < 30 minutes", async function () {
      const { sweatCoin, healthRewards, oracle, user1 } = await loadFixture(deployFitDAOFixture);

      // Submit health data: 20 minutes exercise (below threshold)
      await healthRewards.connect(oracle).submitHealthData(
        user1.address,
        0,
        false,
        20 // exercise minutes
      );

      const balance = await sweatCoin.balanceOf(user1.address);
      expect(balance).to.equal(0);
    });

    it("Should enforce cooldown period", async function () {
      const { healthRewards, oracle, user1 } = await loadFixture(deployFitDAOFixture);

      // First submission
      await healthRewards.connect(oracle).submitHealthData(
        user1.address,
        5000,
        true,
        60
      );

      // Try to submit again immediately - should fail
      await expect(
        healthRewards.connect(oracle).submitHealthData(
          user1.address,
          5000,
          true,
          60
        )
      ).to.be.revertedWith("Reward cooldown not met");
    });

    it("Should allow submission after cooldown period", async function () {
      const { sweatCoin, healthRewards, oracle, user1 } = await loadFixture(deployFitDAOFixture);

      // First submission
      await healthRewards.connect(oracle).submitHealthData(
        user1.address,
        5000, // 5 SWEAT
        false,
        0
      );

      // Fast forward time by 1 hour + 1 second
      await time.increase(3601);

      // Second submission should work
      await healthRewards.connect(oracle).submitHealthData(
        user1.address,
        5000, // 5 SWEAT
        false,
        0
      );

      // Total should be 10 SWEAT
      const balance = await sweatCoin.balanceOf(user1.address);
      expect(balance).to.equal(ethers.parseEther("10"));
    });

    it("Should only allow oracle to submit data", async function () {
      const { healthRewards, user1, user2 } = await loadFixture(deployFitDAOFixture);

      await expect(
        healthRewards.connect(user1).submitHealthData(
          user2.address,
          5000,
          true,
          60
        )
      ).to.be.revertedWith("Only oracle can submit data");
    });

    it("Should allow owner to update oracle", async function () {
      const { healthRewards, owner, user1 } = await loadFixture(deployFitDAOFixture);

      await healthRewards.connect(owner).updateOracle(user1.address);

      expect(await healthRewards.trustedOracle()).to.equal(user1.address);
    });

    it("Should allow owner to update reward rates", async function () {
      const { healthRewards, owner } = await loadFixture(deployFitDAOFixture);

      const newStepsRate = ethers.parseEther("2");
      const newSleepRate = ethers.parseEther("10");
      const newExerciseRate = ethers.parseEther("15");

      await healthRewards.connect(owner).updateRewardRates(
        newStepsRate,
        newSleepRate,
        newExerciseRate
      );

      expect(await healthRewards.stepsRewardRate()).to.equal(newStepsRate);
      expect(await healthRewards.sleepRewardRate()).to.equal(newSleepRate);
      expect(await healthRewards.exerciseRewardRate()).to.equal(newExerciseRate);
    });

    it("Should emit RewardIssued event", async function () {
      const { healthRewards, oracle, user1 } = await loadFixture(deployFitDAOFixture);

      // 5000 steps = 5 SWEAT, good sleep = 5 SWEAT, 60 min exercise = 20 SWEAT
      // Total = 30 SWEAT
      await expect(
        healthRewards.connect(oracle).submitHealthData(
          user1.address,
          5000,
          true,
          60
        )
      )
        .to.emit(healthRewards, "RewardIssued")
        .withArgs(user1.address, ethers.parseEther("30"), "Daily health activities");
    });
  });

  // ============================================
  // Integration Tests
  // ============================================
  describe("Integration Tests", function () {
    it("Should handle multiple users earning rewards", async function () {
      const { sweatCoin, healthRewards, oracle, user1, user2, user3 } = 
        await loadFixture(deployFitDAOFixture);

      // User 1 earns rewards: 5000 steps, good sleep, 60 min exercise
      await healthRewards.connect(oracle).submitHealthData(user1.address, 5000, true, 60);
      
      // User 2 earns rewards: 10000 steps, no sleep, 30 min exercise
      await healthRewards.connect(oracle).submitHealthData(user2.address, 10000, false, 30);
      
      // User 3 earns rewards: 3000 steps, good sleep, 90 min exercise
      await healthRewards.connect(oracle).submitHealthData(user3.address, 3000, true, 90);

      expect(await sweatCoin.balanceOf(user1.address)).to.equal(ethers.parseEther("30")); // 5+5+20
      expect(await sweatCoin.balanceOf(user2.address)).to.equal(ethers.parseEther("20")); // 10+0+10
      expect(await sweatCoin.balanceOf(user3.address)).to.equal(ethers.parseEther("38")); // 3+5+30
    });

    it("Should allow users to transfer tokens", async function () {
      const { sweatCoin, healthRewards, oracle, user1, user2 } = 
        await loadFixture(deployFitDAOFixture);

      // User 1 earns tokens: 5000 steps, good sleep, 60 min = 30 SWEAT
      await healthRewards.connect(oracle).submitHealthData(user1.address, 5000, true, 60);

      // User 1 transfers to User 2
      const transferAmount = ethers.parseEther("10");
      await sweatCoin.connect(user1).transfer(user2.address, transferAmount);

      expect(await sweatCoin.balanceOf(user1.address)).to.equal(ethers.parseEther("20")); // 30 - 10 = 20
      expect(await sweatCoin.balanceOf(user2.address)).to.equal(ethers.parseEther("10")); // received 10
    });
  });
});
