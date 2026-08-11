jest.mock("../src/services/email.service", () => ({
    sendRegistrationEmail: jest.fn().mockResolvedValue(true),
    sendTransactionEmail: jest.fn().mockResolvedValue(true),
    sendTransactionFailedEmail: jest.fn().mockResolvedValue(true),
    sendEmail: jest.fn().mockResolvedValue(true),
}));

const request = require("supertest");
const { connect, closeDatabase, clearDatabase } = require("./setup");
const app = require("../src/app");

beforeAll(async () => {
    await connect();
});

afterEach(async () => {
    await clearDatabase();
});

afterAll(async () => {
    await closeDatabase();
});

const registerAndLogin = async (overrides = {}) => {
    const agent = request.agent(app);

    const user = {
        name: "Grace Hopper",
        email: "grace@example.com",
        password: "supersecret123",
        ...overrides,
    };

    await agent.post("/v1/api/auth/register").send(user);

    return agent;
};

describe("POST /v1/api/account", () => {
    it("rejects account creation without auth", async () => {
        const res = await request(app).post("/v1/api/account");
        expect(res.status).toBe(401);
    });

    it("creates an account for the authenticated user, defaulting to ACTIVE / INR", async () => {
        const agent = await registerAndLogin();

        const res = await agent.post("/v1/api/account");

        expect(res.status).toBe(201);
        expect(res.body.account.status).toBe("ACTIVE");
        expect(res.body.account.currency).toBe("INR");
    });
});

describe("GET /v1/api/account", () => {
    it("only returns accounts belonging to the requesting user", async () => {
        const alice = await registerAndLogin({ email: "alice@example.com" });
        const bob = await registerAndLogin({ email: "bob@example.com" });

        await alice.post("/v1/api/account");
        await alice.post("/v1/api/account");
        await bob.post("/v1/api/account");

        const aliceRes = await alice.get("/v1/api/account");
        const bobRes = await bob.get("/v1/api/account");

        expect(aliceRes.body.accounts).toHaveLength(2);
        expect(bobRes.body.accounts).toHaveLength(1);
    });
});

describe("GET /v1/api/account/balance/:accountId", () => {
    it("returns 0 balance for a freshly created account", async () => {
        const agent = await registerAndLogin();

        const createRes = await agent.post("/v1/api/account");
        const accountId = createRes.body.account._id;

        const res = await agent.get(`/v1/api/account/balance/${accountId}`);

        expect(res.status).toBe(200);
        expect(res.body.balance).toBe(0);
    });

    it("rejects a malformed account id with 400, not a 500", async () => {
        const agent = await registerAndLogin();

        const res = await agent.get("/v1/api/account/balance/not-a-valid-id");

        expect(res.status).toBe(400);
    });

    it("returns 404 when requesting another user's account balance", async () => {
        const alice = await registerAndLogin({ email: "alice2@example.com" });
        const bob = await registerAndLogin({ email: "bob2@example.com" });

        const aliceAccount = await alice.post("/v1/api/account");

        const res = await bob.get(
            `/v1/api/account/balance/${aliceAccount.body.account._id}`
        );

        // Account isolation: Bob must not be able to probe Alice's balance.
        expect(res.status).toBe(404);
    });
});
