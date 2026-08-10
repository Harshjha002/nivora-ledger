const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const emailService = require("../services/email.service");
const TokenBlacklist = require("../models/blacklist.model");

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

    const existingUser = await User.findOne({
      email,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "User already exists with this email",
      });
    }

    const user = await User.create({
      email,
      name,
      password,
    });

    const token = generateToken(user._id);

    res.cookie("token", token, cookieOptions);

    // Email failure should not fail registration.
    try {
      await emailService.sendRegistrationEmail(user.email, user.name);
    } catch (emailError) {
      console.error("Registration successful but email failed:", emailError);
    }

    return res.status(201).json({
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    // MongoDB duplicate key error.
    if (error.code === 11000) {
      return res.status(409).json({
        message: "User already exists with this email",
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

    const user = await User.findOne({
      email,
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        message: "Email or password is invalid",
      });
    }

    const isValidPassword = await user.comparePassword(password);

    if (!isValidPassword) {
      return res.status(401).json({
        message: "Email or password is invalid",
      });
    }

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
    const token = req.token;

    if (token) {
      await TokenBlacklist.updateOne(
        { token },
        { $setOnInsert: { token } },
        { upsert: true },
      );
    }

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
