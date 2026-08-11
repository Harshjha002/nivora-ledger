jest.mock("../src/services/email.service", () => ({
    sendRegistrationEmail: jest.fn().mockResolvedValue(true),
    sendTransactionEmail: jest.fn().mockResolvedValue(true),
    sendTransactionFailedEmail: jest.fn().mockResolvedValue(true),
    sendEmail: jest.fn().mockResolvedValue(true),
}));

const request = require("supertest");
const { connect, closeDatabase, clearDatabase } = require("./setup");
const app = require("../src/app");
const User = require("../src/models/user.model");

beforeAll(async () => {
    await connect();
});

afterEach(async () => {
    await clearDatabase();
    jest.clearAllMocks();
});

afterAll(async () => {
    await closeDatabase();
});

const validUser = {
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "supersecret123",
};

describe("POST /v1/api/auth/register", () => {
    it("registers a new user and returns 201 with a safe user object", async () => {
        const res = await request(app)
            .post("/v1/api/auth/register")
            .send(validUser);

        expect(res.status).toBe(201);
        expect(res.body.user.email).toBe(validUser.email);
        expect(res.body.user.password).toBeUndefined();
    });

    it("hashes the password — it is never stored in plaintext", async () => {
        await request(app).post("/v1/api/auth/register").send(validUser);

        const stored = await User.findOne({ email: validUser.email }).select(
            "+password"
        );

        expect(stored.password).not.toBe(validUser.password);
    });

    it("sets an httpOnly auth cookie on successful registration", async () => {
        const res = await request(app)
            .post("/v1/api/auth/register")
            .send(validUser);

        const cookie = res.headers["set-cookie"]?.[0];

        expect(cookie).toMatch(/token=/);
        expect(cookie).toMatch(/HttpOnly/i);
    });

    it("rejects duplicate email registration with 409", async () => {
        await request(app).post("/v1/api/auth/register").send(validUser);

        const res = await request(app)
            .post("/v1/api/auth/register")
            .send(validUser);

        expect(res.status).toBe(409);
    });

    it("rejects a password shorter than 8 characters", async () => {
        const res = await request(app)
            .post("/v1/api/auth/register")
            .send({ ...validUser, password: "short" });

        expect(res.status).toBe(400);
    });

    it("rejects an invalid email format", async () => {
        const res = await request(app)
            .post("/v1/api/auth/register")
            .send({ ...validUser, email: "not-an-email" });

        expect(res.status).toBe(400);
    });
});

describe("POST /v1/api/auth/login", () => {
    beforeEach(async () => {
        await request(app).post("/v1/api/auth/register").send(validUser);
    });

    it("logs in with correct credentials and returns a cookie", async () => {
        const res = await request(app).post("/v1/api/auth/login").send({
            email: validUser.email,
            password: validUser.password,
        });

        expect(res.status).toBe(200);
        expect(res.headers["set-cookie"]?.[0]).toMatch(/token=/);
    });

    it("rejects an unknown email with a generic 401 (no user enumeration)", async () => {
        const res = await request(app).post("/v1/api/auth/login").send({
            email: "nobody@example.com",
            password: validUser.password,
        });

        expect(res.status).toBe(401);
        expect(res.body.message).toBe("Email or password is invalid");
    });

    it("rejects the wrong password with the SAME message as unknown email", async () => {
        const res = await request(app).post("/v1/api/auth/login").send({
            email: validUser.email,
            password: "wrongPassword123",
        });

        expect(res.status).toBe(401);
        expect(res.body.message).toBe("Email or password is invalid");
    });
});

describe("POST /v1/api/auth/logout", () => {
    it("rejects logout with no auth token", async () => {
        const res = await request(app).post("/v1/api/auth/logout");

        expect(res.status).toBe(401);
    });

    it("blacklists the token so it cannot be reused after logout", async () => {
        const agent = request.agent(app);

        const registerRes = await agent
            .post("/v1/api/auth/register")
            .send(validUser);

        const tokenCookie = registerRes.headers["set-cookie"][0];

        const logoutRes = await agent.post("/v1/api/auth/logout");
        expect(logoutRes.status).toBe(200);
        const res = await request(app)
            .get("/v1/api/account")
            .set("Cookie", tokenCookie);

        expect(res.status).toBe(401);
        expect(res.body.message).toBe("Token has been invalidated");
    });
});
