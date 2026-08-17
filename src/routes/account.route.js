const express = require("express");
const authMiddleware = require("../middleware/auth.middleware")
const accountController = require("../controller/account.controller")

const router = express.Router();




/**
 * - POST /v1/api/accounts/
 * - Create a new account
 * - protected route
 */
router.post(
    "/",
    authMiddleware.authMiddleware,
    accountController.createAccountController
);

/**
 * - GET /v1/api/accounts/
 * - GET all account of loged in user
 */
router.get("/",authMiddleware.authMiddleware,accountController.getUserAccountController)

/**
 * - GET /v1/api/accounts/balance/:accountId
 * - GET balance forn  account id
 */
router.get("/balance/:accountId" , authMiddleware.authMiddleware ,accountController.getAccountBalance)

module.exports = router;