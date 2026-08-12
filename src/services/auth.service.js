const User = require("../models/user.model");
const emailService = require("./email.service");
const TokenBlacklist = require("../models/blacklist.model");

const registerUser = async ({ email, name, password }) => {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
        const error = new Error("User already exists with this email");
        error.statusCode = 409;
        throw error;
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
        console.error(
            "Registration successful but email failed:",
            emailError
        );
    }

    return user;
};

const loginUser = async ({ email, password }) => {
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
        const error = new Error("Email or password is invalid");
        error.statusCode = 401;
        throw error;
    }

    const isValidPassword = await user.comparePassword(password);

    if (!isValidPassword) {
        const error = new Error("Email or password is invalid");
        error.statusCode = 401;
        throw error;
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