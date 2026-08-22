const rateLimit = require("express-rate-limit");
const { MemoryStore, ipKeyGenerator } = require("express-rate-limit");

const createRateLimiter = (options) => {
  return rateLimit(options);
};

const LOGIN_RATE_LIMIT_MAX = Number(process.env.LOGIN_RATE_LIMIT_MAX) || 5;
const LOGIN_RATE_LIMIT_WINDOW_MS =
  Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const TRANSACTION_RATE_LIMIT_MAX =
  Number(process.env.TRANSACTION_RATE_LIMIT_MAX) || 30;
const TRANSACTION_RATE_LIMIT_WINDOW_MS =
  Number(process.env.TRANSACTION_RATE_LIMIT_WINDOW_MS) || 60 * 1000;
const REGISTER_RATE_LIMIT_MAX =
  Number(process.env.REGISTER_RATE_LIMIT_MAX) || 5;
const REGISTER_RATE_LIMIT_WINDOW_MS =
  Number(process.env.REGISTER_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;


const registerStore = new MemoryStore();
const loginStore = new MemoryStore();
const transactionStore = new MemoryStore();

const registerRateLimiter = createRateLimiter({
  windowMs: REGISTER_RATE_LIMIT_WINDOW_MS,
  limit: REGISTER_RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: registerStore,
  message: {
    status: "failed",
    message: "Too many registration attempts. Please try again later.",
  },
});

const loginRateLimiter = createRateLimiter({
  windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  limit: LOGIN_RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: loginStore,
  keyGenerator: (req) =>
    typeof req.body?.email === "string" && req.body.email.length > 0
      ? req.body.email
      : ipKeyGenerator(req.ip),
});

const transactionRateLimiter = createRateLimiter({
  windowMs: TRANSACTION_RATE_LIMIT_WINDOW_MS,
  limit: TRANSACTION_RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: transactionStore,
  keyGenerator: (req) => req.user._id.toString(),
});


const resetRateLimiters = async () => {
  await Promise.all([
    registerStore.resetAll(),
    loginStore.resetAll(),
    transactionStore.resetAll(),
  ]);
};

module.exports = {
  loginRateLimiter,
  transactionRateLimiter,
  registerRateLimiter,
  resetRateLimiters,
};