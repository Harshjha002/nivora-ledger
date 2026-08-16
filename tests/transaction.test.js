jest.mock("../src/services/email.service", () => ({
  sendRegistrationEmail: jest.fn().mockResolvedValue(true),
  sendTransactionEmail: jest.fn().mockResolvedValue(true),
  sendTransactionFailedEmail: jest.fn().mockResolvedValue(true),
  sendEmail: jest.fn().mockResolvedValue(true),
}));

const request = require("supertest");
const crypto = require("crypto");
const { connect, closeDatabase, clearDatabase } = require("./setup");
const app = require("../src/app");
const User = require("../src/models/user.model");
const Account = require("../src/models/account.model");
const Transaction = require("../src/models/transaction.model");
const Ledger = require("../src/models/ledger.model");

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

const idKey = () => crypto.randomBytes(16).toString("hex");

const registerAndLogin = async (overrides = {}) => {
  const agent = request.agent(app);

  const user = {
    name: "Test User",
    email: `user-${crypto.randomBytes(4).toString("hex")}@example.com`,
    password: "supersecret123",
    ...overrides,
  };

  await agent.post("/v1/api/auth/register").send(user);

  return agent;
};

/**
 * Funding an account has to go through the "system user" path
 * (createInitialFundsTransaction), which requires `systemUser: true` on the
 * User doc. That flag is immutable + select:false, so it can only be set at
 * creation — we do it directly against the model, then log in normally
 * through the real API so the auth flow under test is unchanged.
 */
const createFundedAccount = async (amountInPaise) => {
  const systemPassword = "supersecret123";

  const systemUserDoc = await User.create({
    name: "System User",
    email: `system-${crypto.randomBytes(4).toString("hex")}@example.com`,
    password: systemPassword,
    systemUser: true,
  });

  const systemAgent = request.agent(app);
  await systemAgent.post("/v1/api/auth/login").send({
    email: systemUserDoc.email,
    password: systemPassword,
  });

  const systemAccount = await Account.create({ user: systemUserDoc._id });

  const userAgent = await registerAndLogin();
  const userAccountRes = await userAgent.post("/v1/api/account");
  const userAccountId = userAccountRes.body.account._id;

  await systemAgent
    .post("/v1/api/transaction/system/initial-funds")
    .set("Idempotency-Key", idKey())
    .send({ toAccount: userAccountId, amount: amountInPaise });

  return { userAgent, userAccountId, systemAccount, systemAgent };
};

describe("POST /v1/api/transaction (transfer)", () => {
  it("moves funds from sender to receiver atomically", async () => {
    const { userAgent, userAccountId } = await createFundedAccount(10000); // ₹100.00

    const receiverAgent = await registerAndLogin();
    const receiverAccountRes = await receiverAgent.post("/v1/api/account");
    const receiverAccountId = receiverAccountRes.body.account._id;

    const res = await userAgent
      .post("/v1/api/transaction")
      .set("Idempotency-Key", idKey())
      .send({
        fromAccount: userAccountId,
        toAccount: receiverAccountId,
        amount: 3000, // ₹30.00
      });

    expect(res.status).toBe(201);
    expect(res.body.transaction.status).toBe("COMPLETED");

    const senderBalance = await userAgent.get(
      `/v1/api/account/balance/${userAccountId}`,
    );
    const receiverBalance = await receiverAgent.get(
      `/v1/api/account/balance/${receiverAccountId}`,
    );

    expect(senderBalance.body.balance).toBe(7000);
    expect(receiverBalance.body.balance).toBe(3000);
  });

  it("rejects a transfer that exceeds the sender's balance", async () => {
    const { userAgent, userAccountId } = await createFundedAccount(1000);

    const receiverAgent = await registerAndLogin();
    const receiverAccountRes = await receiverAgent.post("/v1/api/account");

    const res = await userAgent
      .post("/v1/api/transaction")
      .set("Idempotency-Key", idKey())
      .send({
        fromAccount: userAccountId,
        toAccount: receiverAccountRes.body.account._id,
        amount: 999999,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Insufficient balance");
  });

  it("rejects unauthenticated transaction requests", async () => {
    const sender = await createFundedAccount(10000);
    const receiver = await createFundedAccount(0);

    const res = await request(app)
      .post("/v1/api/transaction")
      .set("Idempotency-Key", idKey())
      .send({
        fromAccount: sender.userAccountId,
        toAccount: receiver.userAccountId,
        amount: 1000,
      });

    expect(res.status).toBe(401);
  });

  it("rejects transfers with no Idempotency-Key header", async () => {
    const { userAgent, userAccountId } = await createFundedAccount(1000);
    const receiverAgent = await registerAndLogin();
    const receiverAccountRes = await receiverAgent.post("/v1/api/account");

    const res = await userAgent.post("/v1/api/transaction").send({
      fromAccount: userAccountId,
      toAccount: receiverAccountRes.body.account._id,
      amount: 500,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid Idempotency-Key");
  });

  it("rejects an invalid Idempotency-Key", async () => {
    const { userAgent, userAccountId } = await createFundedAccount(10000);

    const receiverAgent = await registerAndLogin();
    const receiverAccountRes = await receiverAgent.post("/v1/api/account");

    const res = await userAgent
      .post("/v1/api/transaction")
      .set("Idempotency-Key", "short-key")
      .send({
        fromAccount: userAccountId,
        toAccount: receiverAccountRes.body.account._id,
        amount: 1000,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid Idempotency-Key");
  });

  it("is idempotent: retrying the same Idempotency-Key never double-spends", async () => {
    const { userAgent, userAccountId } = await createFundedAccount(10000);
    const receiverAgent = await registerAndLogin();
    const receiverAccountRes = await receiverAgent.post("/v1/api/account");
    const receiverAccountId = receiverAccountRes.body.account._id;

    const key = idKey();
    const payload = {
      fromAccount: userAccountId,
      toAccount: receiverAccountId,
      amount: 4000,
    };

    const first = await userAgent
      .post("/v1/api/transaction")
      .set("Idempotency-Key", key)
      .send(payload);

    const retry = await userAgent
      .post("/v1/api/transaction")
      .set("Idempotency-Key", key)
      .send(payload);

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200); // "already completed", not re-executed
    expect(retry.body.transaction._id).toBe(first.body.transaction._id);

    const senderBalance = await userAgent.get(
      `/v1/api/account/balance/${userAccountId}`,
    );

    // If the retry had double-spent, this would be 2000, not 6000.
    expect(senderBalance.body.balance).toBe(6000);
  });

  it("rejects transfers between two accounts that are not both ACTIVE", async () => {
    const { userAgent, userAccountId } = await createFundedAccount(5000);
    const receiverAgent = await registerAndLogin();
    const receiverAccountRes = await receiverAgent.post("/v1/api/account");

    await Account.findByIdAndUpdate(receiverAccountRes.body.account._id, {
      status: "FROZEN",
    });

    const res = await userAgent
      .post("/v1/api/transaction")
      .set("Idempotency-Key", idKey())
      .send({
        fromAccount: userAccountId,
        toAccount: receiverAccountRes.body.account._id,
        amount: 500,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "Sender and receiver accounts must be active",
    );
  });

  it("blocks direct mutation of ledger entries at the schema level", async () => {
    const { userAgent, userAccountId } = await createFundedAccount(5000);
    const receiverAgent = await registerAndLogin();
    const receiverAccountRes = await receiverAgent.post("/v1/api/account");

    await userAgent
      .post("/v1/api/transaction")
      .set("Idempotency-Key", idKey())
      .send({
        fromAccount: userAccountId,
        toAccount: receiverAccountRes.body.account._id,
        amount: 1000,
      });

    const entry = await Ledger.findOne({ account: userAccountId });

    await expect(
      Ledger.updateOne({ _id: entry._id }, { amount: 999999 }),
    ).rejects.toThrow(/immutable/i);
  });

  it("prevents a user from spending another user's account", async () => {
    const sender = await createFundedAccount(10000);
    const attacker = await createFundedAccount(10000);

    const receiverAgent = await registerAndLogin();
    const receiverAccountRes = await receiverAgent.post("/v1/api/account");

    const res = await attacker.userAgent
      .post("/v1/api/transaction")
      .set("Idempotency-Key", idKey())
      .send({
        fromAccount: sender.userAccountId,
        toAccount: receiverAccountRes.body.account._id,
        amount: 1000,
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("You are not authorized to use this account");
  });
  it("rejects a transfer when sender and receiver accounts are the same", async () => {
    const { userAgent, userAccountId } = await createFundedAccount(10000);

    const res = await userAgent
      .post("/v1/api/transaction")
      .set("Idempotency-Key", idKey())
      .send({
        fromAccount: userAccountId,
        toAccount: userAccountId,
        amount: 1000,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "Sender and receiver accounts must be different",
    );
  });

  /**
   * THE CORE CORRECTNESS PROOF.
   *
   * Fires many simultaneous transfer requests from a single account that
   * only has enough balance for ONE of them to succeed. Because each
   * transfer locks the sender account inside a MongoDB session
   * (Account.findOneAndUpdate incrementing transferVersion) before
   * re-reading the ledger-derived balance, MongoDB serializes the
   * conflicting writes instead of letting them race.
   *
   * If the locking were broken, more than one transfer would succeed and
   * the sender's final balance would go negative — asserted below.
   */
  it("never allows two concurrent transfers to overdraw the same account", async () => {
    const startingBalance = 1000; // enough for exactly ONE ₹10 transfer
    const { userAgent, userAccountId } =
      await createFundedAccount(startingBalance);

    // These 5 receivers only need to exist as valid transfer targets —
    // the test doesn't log in as them or assert anything about their
    // own state. Creating them directly (like the system user already
    // does) keeps this test's setup from being bottlenecked by the
    // register rate limiter, which is a real, correctly-enforced
    // limit unrelated to what this test is actually proving.
    const receivers = await Promise.all(
      Array.from({ length: 5 }).map(async (_, i) => {
        const receiverUser = await User.create({
          name: "Concurrency Receiver",
          email: `concurrency-receiver-${i}-${crypto
            .randomBytes(4)
            .toString("hex")}@example.com`,
          password: "supersecret123",
        });

        const receiverAccount = await Account.create({
          user: receiverUser._id,
        });

        return receiverAccount._id.toString();
      }),
    );

    const attempts = await Promise.allSettled(
      receivers.map((toAccount) =>
        userAgent
          .post("/v1/api/transaction")
          .set("Idempotency-Key", idKey())
          .send({
            fromAccount: userAccountId,
            toAccount,
            amount: startingBalance, // each attempt tries to spend the FULL balance
          }),
      ),
    );

    const successes = attempts.filter(
      (a) => a.status === "fulfilled" && a.value.status === 201,
    );

    // Exactly one of the five concurrent full-balance transfers may succeed.
    expect(successes).toHaveLength(1);

    const finalBalance = await userAgent.get(
      `/v1/api/account/balance/${userAccountId}`,
    );

    // The critical assertion: balance must never go negative.
    expect(finalBalance.body.balance).toBe(0);
    expect(finalBalance.body.balance).toBeGreaterThanOrEqual(0);
  });

  it("rate limits repeated transaction attempts", async () => {
    const sender = await createFundedAccount(100000);
    const receiver = await createFundedAccount(0);

    // 30 allowed requests
    for (let i = 0; i < 30; i++) {
      const response = await sender.userAgent
        .post("/v1/api/transaction")
        .set("Idempotency-Key", idKey())
        .send({
          fromAccount: sender.userAccountId,
          toAccount: receiver.userAccountId,
          amount: 1,
        });

      expect(response.status).toBe(201);
    }

    // 31st request should be rate limited
    const response = await sender.userAgent
      .post("/v1/api/transaction")
      .set("Idempotency-Key", idKey())
      .send({
        fromAccount: sender.userAccountId,
        toAccount: receiver.userAccountId,
        amount: 1,
      });

    expect(response.status).toBe(429);
  });
});

describe("GET /v1/api/transaction (transaction history)", () => {
  it("should return the logged-in user's transaction history", async () => {
    const sender = await createFundedAccount(10000);
    const receiver = await createFundedAccount(0);

    await sender.userAgent
      .post("/v1/api/transaction")
      .set("Idempotency-Key", idKey())
      .send({
        fromAccount: sender.userAccountId,
        toAccount: receiver.userAccountId,
        amount: 1000,
      })
      .expect(201);

    const response = await sender.userAgent
      .get("/v1/api/transaction")
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.transactions).toHaveLength(2);

    expect(response.body.transactions[0]).toMatchObject({
      fromAccount: sender.userAccountId,
      toAccount: receiver.userAccountId,
      amount: 1000,
      direction: "DEBIT",
      status: "COMPLETED",
    });
  });

  it("should paginate transaction history", async () => {
    const sender = await createFundedAccount(10000);
    const receiver = await createFundedAccount(0);

    await sender.userAgent
      .post("/v1/api/transaction")
      .set("Idempotency-Key", idKey())
      .send({
        fromAccount: sender.userAccountId,
        toAccount: receiver.userAccountId,
        amount: 1000,
      })
      .expect(201);

    await sender.userAgent
      .post("/v1/api/transaction")
      .set("Idempotency-Key", idKey())
      .send({
        fromAccount: sender.userAccountId,
        toAccount: receiver.userAccountId,
        amount: 2000,
      })
      .expect(201);

    const response = await sender.userAgent
      .get("/v1/api/transaction?page=1&limit=2")
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.transactions).toHaveLength(2);

    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
  });

  it("rejects unauthenticated transaction history requests", async () => {
    const res = await request(app)
        .get("/v1/api/transaction")
        .expect(401);

    expect(res.status).toBe(401);
});

  it("should not return transactions unrelated to the logged-in user", async () => {
    const userA = await createFundedAccount(10000);
    const userB = await createFundedAccount(10000);
    const userC = await createFundedAccount(10000);

    // A → C
    await userA.userAgent
      .post("/v1/api/transaction")
      .set("Idempotency-Key", idKey())
      .send({
        fromAccount: userA.userAccountId,
        toAccount: userC.userAccountId,
        amount: 1000,
      })
      .expect(201);

    const response = await userB.userAgent
      .get("/v1/api/transaction")
      .expect(200);

    expect(response.body.success).toBe(true);

    expect(
      response.body.transactions.some(
        (transaction) =>
          transaction.fromAccount === userA.userAccountId ||
          transaction.toAccount === userA.userAccountId ||
          transaction.fromAccount === userC.userAccountId ||
          transaction.toAccount === userC.userAccountId,
      ),
    ).toBe(false);
  });
});

describe("POST /v1/api/transaction/system/initial-funds", () => {
  it("prevents a normal user from creating initial funds", async () => {
    const userAgent = await registerAndLogin();

    const accountRes = await userAgent.post("/v1/api/account");
    const accountId = accountRes.body.account._id;

    const res = await userAgent
      .post("/v1/api/transaction/system/initial-funds")
      .set("Idempotency-Key", idKey())
      .send({
        toAccount: accountId,
        amount: 10000,
      });

    expect(res.status).toBe(403);
  });
});

describe("POST /v1/api/transaction/:transactionId/reverse", () => {
  it("allows a system user to reverse a completed transaction", async () => {
    const sender = await createFundedAccount(10000);
    const receiver = await registerAndLogin();

    const receiverAccountRes = await receiver.post("/v1/api/account");
    const receiverAccountId = receiverAccountRes.body.account._id;

    const transferRes = await sender.userAgent
      .post("/v1/api/transaction")
      .set("Idempotency-Key", idKey())
      .send({
        fromAccount: sender.userAccountId,
        toAccount: receiverAccountId,
        amount: 3000,
      })
      .expect(201);

    const originalTransactionId = transferRes.body.transaction._id;

    const reversalRes = await sender.systemAgent
      .post(`/v1/api/transaction/${originalTransactionId}/reverse`)
      .expect(200);

    expect(reversalRes.body.message).toBe(
      "Transaction reversed successfully",
    );

    expect(reversalRes.body.transaction).toMatchObject({
      status: "COMPLETED",
      amount: 3000,
      reversalOf: originalTransactionId,
    });

    const senderBalance = await sender.userAgent.get(
      `/v1/api/account/balance/${sender.userAccountId}`,
    );

    const receiverBalance = await receiver.get(
      `/v1/api/account/balance/${receiverAccountId}`,
    );

    expect(senderBalance.body.balance).toBe(10000);
    expect(receiverBalance.body.balance).toBe(0);

    const originalTransaction = await Transaction.findById(
      originalTransactionId,
    );

    expect(originalTransaction.status).toBe("REVERSED");

    const reversalTransaction = await Transaction.findOne({
      reversalOf: originalTransactionId,
    });

    expect(reversalTransaction).not.toBeNull();
    expect(reversalTransaction.status).toBe("COMPLETED");

    const reversalEntries = await Ledger.find({
      transaction: reversalTransaction._id,
    });

    expect(reversalEntries).toHaveLength(2);

    expect(reversalEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          account: expect.objectContaining({
            toString: expect.any(Function),
          }),
          amount: 3000,
          type: "DEBIT",
        }),
        expect.objectContaining({
          amount: 3000,
          type: "CREDIT",
        }),
      ]),
    );
  });

  it("prevents a normal user from reversing a transaction", async () => {
    const sender = await createFundedAccount(10000);
    const receiver = await registerAndLogin();

    const receiverAccountRes = await receiver.post("/v1/api/account");

    const transferRes = await sender.userAgent
      .post("/v1/api/transaction")
      .set("Idempotency-Key", idKey())
      .send({
        fromAccount: sender.userAccountId,
        toAccount: receiverAccountRes.body.account._id,
        amount: 1000,
      })
      .expect(201);

    const transactionId = transferRes.body.transaction._id;

    const response = await sender.userAgent.post(
      `/v1/api/transaction/${transactionId}/reverse`,
    );

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "Forbidden: system user access required",
    );
  });

  it("rejects an unauthenticated reversal request", async () => {
    const sender = await createFundedAccount(10000);
    const receiver = await registerAndLogin();

    const receiverAccountRes = await receiver.post("/v1/api/account");

    const transferRes = await sender.userAgent
      .post("/v1/api/transaction")
      .set("Idempotency-Key", idKey())
      .send({
        fromAccount: sender.userAccountId,
        toAccount: receiverAccountRes.body.account._id,
        amount: 1000,
      })
      .expect(201);

    const transactionId = transferRes.body.transaction._id;

    const response = await request(app).post(
      `/v1/api/transaction/${transactionId}/reverse`,
    );

    expect(response.status).toBe(401);
  });

  it("prevents reversing the same transaction twice", async () => {
    const sender = await createFundedAccount(10000);
    const receiver = await registerAndLogin();

    const receiverAccountRes = await receiver.post("/v1/api/account");

    const transferRes = await sender.userAgent
      .post("/v1/api/transaction")
      .set("Idempotency-Key", idKey())
      .send({
        fromAccount: sender.userAccountId,
        toAccount: receiverAccountRes.body.account._id,
        amount: 2000,
      })
      .expect(201);

    const transactionId = transferRes.body.transaction._id;

    await sender.systemAgent
      .post(`/v1/api/transaction/${transactionId}/reverse`)
      .expect(200);

    const secondReversal = await sender.systemAgent.post(
      `/v1/api/transaction/${transactionId}/reverse`,
    );

    expect(secondReversal.status).toBe(400);
    expect(secondReversal.body.message).toBe(
      "Transaction has already been reversed",
    );
  });

  it("rejects reversal when the receiver no longer has enough balance", async () => {
    const sender = await createFundedAccount(10000);
    const receiver = await registerAndLogin();

    const receiverAccountRes = await receiver.post("/v1/api/account");
    const receiverAccountId = receiverAccountRes.body.account._id;

    const transferRes = await sender.userAgent
      .post("/v1/api/transaction")
      .set("Idempotency-Key", idKey())
      .send({
        fromAccount: sender.userAccountId,
        toAccount: receiverAccountId,
        amount: 3000,
      })
      .expect(201);

    const transactionId = transferRes.body.transaction._id;

    // Receiver spends the transferred money.
    const thirdUser = await registerAndLogin();
    const thirdAccountRes = await thirdUser.post("/v1/api/account");

    await receiver
      .post("/v1/api/transaction")
      .set("Idempotency-Key", idKey())
      .send({
        fromAccount: receiverAccountId,
        toAccount: thirdAccountRes.body.account._id,
        amount: 3000,
      })
      .expect(201);

    const reversalRes = await sender.systemAgent.post(
      `/v1/api/transaction/${transactionId}/reverse`,
    );

    expect(reversalRes.status).toBe(400);
    expect(reversalRes.body.message).toBe(
      "Receiver has insufficient balance for reversal",
    );

    const originalTransaction = await Transaction.findById(transactionId);

    expect(originalTransaction.status).toBe("COMPLETED");

    const reversal = await Transaction.findOne({
      reversalOf: transactionId,
    });

    expect(reversal).toBeNull();
  });
});