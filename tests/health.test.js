jest.mock("../src/services/email.service", () => ({
  sendRegistrationEmail: jest.fn().mockResolvedValue(true),
  sendTransactionEmail: jest.fn().mockResolvedValue(true),
  sendTransactionFailedEmail: jest.fn().mockResolvedValue(true),
  sendEmail: jest.fn().mockResolvedValue(true),
}));

const request = require("supertest");
const app = require("../src/app");
const {
    connect,
    closeDatabase,
    clearDatabase,
} = require("./setup");

beforeAll(async () => {
    await connect();
});

afterEach(async () => {
    await clearDatabase();
});

afterAll(async () => {
    await closeDatabase();
});

describe("Health checks", () => {
    it("returns 200 when the API is alive", async () => {
        const res = await request(app)
            .get("/health/live")
            .expect(200);

        expect(res.body).toEqual({
            status: "success",
            message: "Nivora Ledger API is alive",
        });
    });

    it("returns 200 when the API is ready", async () => {
        const res = await request(app)
            .get("/health/ready")
            .expect(200);

        expect(res.body).toEqual({
            status: "success",
            message: "Nivora Ledger API is ready",
        });
    });
});