const jwt = require("jsonwebtoken");
const authService = require("../services/auth.service");

const COOKIE_MAX_AGE = 3 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: COOKIE_MAX_AGE,
};

const generateToken = (userId) => {
  return jwt.sign(
    {
      userID: userId,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "3d",
    }
  );
};

const userRegisterController = async (req, res, next) => {
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
    next(error);
  }
};

const userLoginController = async (req, res, next) => {
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
    next(error);
  }
};

const userLogoutController = async (req, res, next) => {
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
    next(error);
  }
};

module.exports = {
  userRegisterController,
  userLoginController,
  userLogoutController,
};