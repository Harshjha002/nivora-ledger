const express = require("express");
const authMiddleware = require("../middleware/auth.middleware")
const accountController = require("../controller/account.controller")

const router = express.Router();




/**
 * - POST /v1/api/accounts/
 * - Create a new account
 * - protected routh
 */
router.post(
    "/",
    authMiddleware.authMiddleware,
    accountController.createAccountController
);
module.exports = router;
