const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const TokenBlacklist = require("../models/blacklist.model");

const getToken = (req) => {
    // 1. Check HTTP-only cookie
    if (req.cookies?.token) {
        return req.cookies.token;
    }

    // 2. Check Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
        return null;
    }

    return authHeader.slice(7).trim();
};

const authenticate = async (req, res, next) => {
    try {
        const token = getToken(req);

        if (!token) {
            return res.status(401).json({
                message: "Authentication required",
            });
        }

        // Check whether the token has been logged out
        const isBlacklisted = await TokenBlacklist.exists({
            token,
        });

        if (isBlacklisted) {
            return res.status(401).json({
                message: "Token has been invalidated",
            });
        }

        // Verify JWT
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        if (!decoded.userID) {
            return res.status(401).json({
                message: "Invalid token payload",
            });
        }

        // Find authenticated user
        const user = await User.findById(decoded.userID);

        if (!user) {
            return res.status(401).json({
                message: "User associated with token not found",
            });
        }

        // Attach authentication data to request
        req.user = user;
        req.token = token;

        next();
    } catch (error) {
        console.error(
            "Authentication error:",
            error.message
        );

        return res.status(401).json({
            message: "Invalid or expired authentication token",
        });
    }
};

const authSystemUserMiddleware = async (req, res, next) => {
    try {
        // authMiddleware must run first
        if (!req.user?._id) {
            return res.status(401).json({
                message: "Authentication required",
            });
        }

        // systemUser is select:false, so explicitly include it
        const user = await User.findById(req.user._id)
            .select("+systemUser");

        if (!user) {
            return res.status(401).json({
                message: "System user not found",
            });
        }

        if (!user.systemUser) {
            return res.status(403).json({
                message: "Forbidden: system user access required",
            });
        }

        req.user = user;

        next();
    } catch (error) {
        console.error(
            "System user verification error:",
            error.message
        );

        return res.status(500).json({
            message: "Failed to verify system user",
        });
    }
};

module.exports = {
    authMiddleware: authenticate,
    authSystemUserMiddleware,
};