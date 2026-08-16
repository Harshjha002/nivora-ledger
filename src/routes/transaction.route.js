const { Router } = require("express");

const {
    authMiddleware,
    authSystemUserMiddleware,
} = require("../middleware/auth.middleware");

const transactionController = require("../controller/transaction.controller");
const validate = require("../middleware/validate.middleware");

const {
    createTransactionSchema,
    initialFundsSchema,
} = require("../validation/transaction.validation");

const {
    transactionRateLimiter,
} = require("../middleware/rate-limit.middleware");

const transactionRoutes = Router();


/**
 * POST /v1/api/transaction
 *
 * Create a new transaction
 *
 * Middleware flow:
 * 1. Authenticate user
 * 2. Validate request with Zod
 * 3. Create transaction
 */


transactionRoutes.get("/", authMiddleware, transactionController.getTransactionHistory);

transactionRoutes.post(
    "/",
    authMiddleware,
    transactionRateLimiter,
    validate(createTransactionSchema),
    transactionController.createTransaction
);

/**
 * POST /v1/api/transaction/system/initial-funds
 *
 * Create initial funds transaction from system user
 *
 * Middleware flow:
 * 1. Authenticate request
 * 2. Verify system user
 * 3. Validate request with Zod
 * 4. Create initial-funds transaction
 */
transactionRoutes.post(
    "/system/initial-funds",
    authMiddleware,
    authSystemUserMiddleware,
    validate(initialFundsSchema),
    transactionController.createInitialFundsTransaction
);

transactionRoutes.post(
    "/:transactionId/reverse",
    authMiddleware,
    authSystemUserMiddleware,
    transactionController.reverseTransaction
);



module.exports = transactionRoutes;