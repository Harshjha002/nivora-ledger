const User = require("../models/user.model");
const emailService = require("./email.service");
const TokenBlacklist = require("../models/blacklist.model");
const ApiError = require("../utils/ApiError");
const logger = require("../config/logger");

const registerUser = async ({ email, name, password }) => {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
        throw new ApiError(
            409,
            "User already exists with this email"
        );
    }

    const user = await User.create({
        email,
        name,
        password,
    });

    try {
        await emailService.sendRegistrationEmail(
            user.email,
            user.name
        );
    } catch (emailError) {
        logger.warn(
            { err: emailError, userId: user._id },
            "Registration succeeded but welcome email failed to send"
        );
    }

    return user;
};

const loginUser = async ({ email, password }) => {
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
        throw new ApiError(
            401,
            "Email or password is invalid"
        );
    }

    const isValidPassword = await user.comparePassword(password);

    if (!isValidPassword) {
        throw new ApiError(
            401,
            "Email or password is invalid"
        );
    }

    return user;
};

const logoutUser = async (token) => {
    if (!token) {
        return;
    }

    await TokenBlacklist.updateOne(
        { token },
        { $setOnInsert: { token } },
        { upsert: true }
    );
};

module.exports = {
    registerUser,
    loginUser,
    logoutUser,
};