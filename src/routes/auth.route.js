const express = require("express");
const authController = require("../controller/auth.controller");
const validate = require("../middleware/validate.middleware");
const { registerSchema ,loginSchema } = require("../validation/auth.validation");
const authMiddleware = require("../middleware/auth.middleware");
const {
    loginRateLimiter,
} = require("../middleware/rate-limit.middleware");

const router = express.Router();

/* POST /v1/api/auth/register */
router.post(
  "/register",
  validate(registerSchema),
  authController.userRegisterController,
);

/* POST /v1/api/auth/login */
router.post(
    "/login",
    loginRateLimiter,
    validate(loginSchema),
    authController.userLoginController,
);


router.post(
    "/logout",
    authMiddleware.authMiddleware,
    authController.userLogoutController
);
module.exports = router;
