const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const TokenBlacklist = require("../models/blacklist.model")

const authMiddleware = async (req, res, next) => {
    const token =
        req.cookies.token ||
        req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "Unauthorized access, token is missing",
        });
    }

    const isBlackListed = await TokenBlacklist.findOne({token})
    if(isBlackListed){
        return res.status(401).json({
            message:"Token is invalid"
        })
    }

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const user = await User.findById(decoded.userID);

        if (!user) {
            return res.status(401).json({
                message: "Unauthorized access, user not found",
            });
        }

        req.user = user;

        next();

    } catch (error) {
        return res.status(401).json({
            message: "Unauthorized access, token is invalid",
        });
    }
};


const authSystemUserMiddleware = async (req, res, next) => {

    const token =
        req.cookies.token ||
        req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "Unauthorized access, token is missing",
        });
    }

    const isBlackListed = await TokenBlacklist.findOne({token})
    if(isBlackListed){
        return res.status(401).json({
            message:"Token is invalid"
        })
    }

    try {

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const user = await User.findById(decoded.userID)
            .select("+systemUser");

        if (!user) {
            return res.status(401).json({
                message: "Unauthorized access, user not found",
            });
        }

        // Only system users can access this route
        if (!user.systemUser) {
            return res.status(403).json({
                message: "Forbidden: system user access required",
            });
        }

        req.user = user;

        return next();

    } catch (error) {
        return res.status(401).json({
            message: "Unauthorized access, token is invalid",
        });
    }
};


module.exports = {
    authMiddleware,
    authSystemUserMiddleware,
};