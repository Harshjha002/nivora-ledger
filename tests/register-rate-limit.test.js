jest.mock("../src/services/email.service", () => ({
  sendRegistrationEmail: jest.fn().mockResolvedValue(true),
  sendTransactionEmail: jest.fn().mockResolvedValue(true),
  sendTransactionFailedEmail: jest.fn().mockResolvedValue(true),
  sendEmail: jest.fn().mockResolvedValue(true),
}));

const request = require("supertest");
const crypto = require("crypto");
const { connect, closeDatabase, clearDatabase } = require("./setup");

// Own file => own module cache => a fresh `app` (and register limiter)
// that isn't shared with any other test file.
const app = require("../src/app");

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

describe("Rate limiting — register", () => {
  it("rate limits repeated registration attempts", async () => {
    for (let i = 0; i < 5; i++) {
      const response = await request(app)
        .post("/v1/api/auth/register")
        .send({
          name: "Rate Limit User",
          email: `rate-${crypto.randomBytes(4).toString("hex")}@example.com`,
          password: "supersecret123",
        });

      expect(response.status).toBe(201);
    }

    // 6th request in this window should be rate limited
    const response = await request(app)
      .post("/v1/api/auth/register")
      .send({
        name: "Rate Limit User",
        email: `rate-${crypto.randomBytes(4).toString("hex")}@example.com`,
        password: "supersecret123",
      });

    expect(response.status).toBe(429);
  });
});