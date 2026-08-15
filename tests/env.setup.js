process.env.NODE_ENV = "test";

process.env.JWT_SECRET = "test-secret-do-not-use-in-production";

process.env.MONGO_URI = "mongodb://127.0.0.1:27017/nivora-test";

process.env.CLIENT_ID = "test-client-id";
process.env.CLIENT_SECRET = "test-client-secret";
process.env.REFRESH_TOKEN = "test-refresh-token";
process.env.EMAIL_USER = "test@example.com";

process.env.CLIENT_URL = "http://localhost:5173";

process.env.LOG_LEVEL = "error";

process.env.LOGIN_RATE_LIMIT_MAX = "5";
process.env.TRANSACTION_RATE_LIMIT_MAX = "30";
process.env.REGISTER_RATE_LIMIT_MAX = "5";