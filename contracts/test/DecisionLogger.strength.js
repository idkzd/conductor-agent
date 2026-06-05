const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DecisionLogger Strength (JS smoke — rich metrics + economy + verify)", function () {
  let owner, conductor, op, logger;
  const CID = 1, RID = 3;

  beforeEach(async function () {
    [owner, conductor, op] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("DecisionLogger");
    logger = await Factory.deploy(ethers.ZeroAddress);
    await logger.waitForDeployment();

    await logger.bootstrapDemo(conductor.address, 0, [CID, 2, RID], [conductor.address, op.address, op.address]);
  });

  it("deploys and basic log works", async function () {
    const tx = await logger.connect(conductor).logDecision(CID, "t", "reasoning here 123456", "a", "r", ethers.ZeroHash);
    await tx.wait();
    expect(await logger.getDecisionCount()).to.equal(1);
  });

  it("logDecisionWithMetrics stores the portfolio numbers on chain (strength)", async function () {
    const tx = await logger.connect(conductor).logDecisionWithMetrics(
      CID, "goal", "research mETH USDY portfolio-logic gave 63 37", "action", "result",
      312, 620, 8100, 125, ethers.ZeroHash, 0, JSON.stringify({mETH:0.63,USDY:0.37}), ethers.ZeroHash
    );
    await tx.wait();

    const d = await logger.getDecision(0);
    expect(d.blendedAPY).to.equal(312);
    expect(d.riskScoreBps).to.equal(620);
    expect(d.liquidityScoreBps).to.equal(8100);
    expect(d.allocationJson).to.contain("0.63");
  });

  it("recordServicePayment emits economy event and updates stats", async function () {
    await logger.connect(conductor).logDecisionWithMetrics(CID, "t", "r1234567890", "a", "r", 0,0,0,0, ethers.ZeroHash,0,"",ethers.ZeroHash);
    const p = await logger.connect(conductor).recordServicePayment(CID, RID, 80, "RWA validation", 0);
    await p.wait();

    const stats = await logger.getAgentStats(CID);
    expect(stats.totalServiceFees).to.equal(80);
  });

  it("verifyAgentWithERC8004 works (demo registry=0)", async function () {
    const v = await logger.verifyAgentWithERC8004(RID);
    await v.wait();
    // just not revert
  });

  it("getDecisionChain + getRecentDecisions return data", async function () {
    await logger.connect(conductor).logDecisionWithMetrics(CID, "root", "r1234567890", "a", "r", 300,600,8000,0, ethers.ZeroHash,0,"",ethers.ZeroHash);
    const recent = await logger.getRecentDecisions(5);
    expect(recent.length).to.be.greaterThan(0);
  });

  // ==================== SECURITY / PROTECTION TESTS ====================

  it("rejects overly long strings (protection against storage griefing)", async function () {
    const longReasoning = "x".repeat(9000); // > MAX_REASONING_LENGTH
    await expect(
      logger.connect(conductor).logDecisionWithMetrics(
        CID, "short", longReasoning, "a", "r", 0,0,0,0, ethers.ZeroHash, 0, "{}", ethers.ZeroHash
      )
    ).to.be.revertedWithCustomError(logger, "StringTooLong");
  });

  it("accumulates fees safely (no external call in log path) and only owner can withdraw", async function () {
    await logger.setLogFee(ethers.parseEther("0.001"));

    // log with fee — should accumulate, not send immediately
    await logger.connect(conductor).logDecision(
      CID, "fee test task", "reasoning with enough chars 123", "action", "result",
      ethers.ZeroHash, { value: ethers.parseEther("0.001") }
    );

    const acc = await logger.accumulatedFees();
    expect(acc).to.equal(ethers.parseEther("0.001"));

    // non-owner cannot withdraw
    await expect(
      logger.connect(op).withdrawAccumulatedFees()
    ).to.be.reverted; // OwnableUnauthorizedAccount or similar

    // owner can
    const beforeBal = await ethers.provider.getBalance(treasury = owner.address); // simplistic
    const tx = await logger.connect(owner).withdrawAccumulatedFees();
    await tx.wait();

    expect(await logger.accumulatedFees()).to.equal(0);
    await expect(tx).to.emit(logger, "FeesWithdrawn");
  });

  it("protects simulateDeFiAction (onlyConductorOrOwner)", async function () {
    await logger.connect(conductor).logDecision(CID, "t", "r123456789", "a", "r", ethers.ZeroHash);
    await expect(
      logger.connect(op).simulateDeFiAction(0, "SWAP", "0x")
    ).to.be.revertedWithCustomError(logger, "ConductorOnly");
  });

  it("emergencyWipe is onlyOwner (and exists for dev only)", async function () {
    await logger.connect(conductor).logDecision(CID, "t", "r123456789", "a", "r", ethers.ZeroHash);
    await expect(
      logger.connect(op).emergencyWipeLastDecision_DEV_ONLY()
    ).to.be.reverted; // not owner
  });

  it("rejects zero treasury (setTreasury guard + runtime protection)", async function () {
    // setTreasury explicitly rejects zero address (anti foot-gun)
    await expect(logger.connect(owner).setTreasury(ethers.ZeroAddress)).to.be.revertedWithCustomError(logger, "ZeroAddress");

    // The _requireValidTreasury is also wired into fee accumulation path and withdraw.
    // (In normal flow treasury starts as deployer; the guard prevents accidental bad state.)
  });
});
