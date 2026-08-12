const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const emailService = require("../services/email.service");
const TokenBlacklist = require("../models/blacklist.model");
const authService = require("../services/auth.service");

const COOKIE_MAX_AGE = 3 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: COOKIE_MAX_AGE,
};

/**
 * Generate JWT for authenticated user.
 */
const generateToken = (userId) => {
  return jwt.sign(
    {
      userID: userId,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "3d",
    },
  );
};

/**
 * User Register Controller
 *
 * POST /v1/api/auth/register
 */
const userRegisterController = async (req, res) => {
    try {
        const { email, name, password } = req.body;

        const user = await authService.registerUser({
            email,
            name,
            password,
        });

        const token = generateToken(user._id);

        res.cookie("token", token, cookieOptions);

        return res.status(201).json({
            user: {
                _id: user._id,
                email: user.email,
                name: user.name,
            },
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: "User already exists with this email",
            });
        }

        if (error.statusCode) {
            return res.status(error.statusCode).json({
                message: error.message,
            });
        }

        console.error("User registration error:", error);

        return res.status(500).json({
            message: "Registration failed",
        });
    }
};

/**
 * User Login Controller
 *
 * POST /v1/api/auth/login
 */
const userLoginController = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await authService.loginUser({
            email,
            password,
        });

        const token = generateToken(user._id);

        res.cookie("token", token, cookieOptions);

        return res.status(200).json({
            user: {
                _id: user._id,
                email: user.email,
                name: user.name,
            },
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                message: error.message,
            });
        }

        console.error("User login error:", error);

        return res.status(500).json({
            message: "Login failed",
        });
    }
};

/**
 * User Logout Controller
 *
 * POST /v1/api/auth/logout
 */
const userLogoutController = async (req, res) => {
    try {
        await authService.logoutUser(req.token);

        res.clearCookie("token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
        });

        return res.status(200).json({
            message: "User logged out successfully",
        });
    } catch (error) {
        console.error("User logout error:", error);

        return res.status(500).json({
            message: "Logout failed",
        });
    }
};

module.exports = {
  userRegisterController,
  userLoginController,
  userLogoutController,
};
