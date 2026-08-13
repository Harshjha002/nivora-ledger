jest.mock("../src/services/email.service", () => ({
  sendRegistrationEmail: jest.fn().mockResolvedValue(true),
  sendTransactionEmail: jest.fn().mockResolvedValue(true),
  sendTransactionFailedEmail: jest.fn().mockResolvedValue(true),
  sendEmail: jest.fn().mockResolvedValue(true),
}));

const request = require("supertest");
const crypto = require("crypto");
const { connect, closeDatabase, clearDatabase } = require("./setup");

// Own file => own module cache => a fresh `app` (and login limiter)
// that isn't shared with any other test file.
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

describe("Rate limiting — login", () => {
  it("rate limits repeated login attempts", async () => {
    const plainPassword = "supersecret123";

    // Created directly against the model — the pre-save hook hashes the
    // password the same way the real /register endpoint does — so this
    // test never touches the register rate limiter at all.
    const user = await User.create({
      name: "Rate Limit User",
      email: `rate-${crypto.randomBytes(4).toString("hex")}@example.com`,
      password: plainPassword,
    });

    // 5 allowed attempts
    for (let i = 0; i < 5; i++) {
      await request(app).post("/v1/api/auth/login").send({
        email: user.email,
        password: plainPassword,
      });
    }

    // 6th request should be rate limited
    const response = await request(app).post("/v1/api/auth/login").send({
      email: user.email,
      password: plainPassword,
    });

    expect(response.status).toBe(429);
  });
});