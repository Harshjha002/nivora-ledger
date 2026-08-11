const rateLimit = require("express-rate-limit");

const createRateLimiter = (options) => {

    return rateLimit(options);
};

const LOGIN_RATE_LIMIT_MAX = Number(process.env.LOGIN_RATE_LIMIT_MAX) || 5;
const LOGIN_RATE_LIMIT_WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;

const TRANSACTION_RATE_LIMIT_MAX = Number(process.env.TRANSACTION_RATE_LIMIT_MAX) || 30;
const TRANSACTION_RATE_LIMIT_WINDOW_MS = Number(process.env.TRANSACTION_RATE_LIMIT_WINDOW_MS) || 60 * 1000;

const loginRateLimiter = createRateLimiter({
    windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
    limit: LOGIN_RATE_LIMIT_MAX,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => req.body.email,
});

const transactionRateLimiter = createRateLimiter({
    windowMs: TRANSACTION_RATE_LIMIT_WINDOW_MS,
    limit: TRANSACTION_RATE_LIMIT_MAX,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => req.user._id.toString(),
});

module.exports = {
    loginRateLimiter,
    transactionRateLimiter,
};