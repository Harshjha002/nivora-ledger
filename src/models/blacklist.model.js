const mongoose = require("mongoose");

const tokenBlacklistSchema = new mongoose.Schema(
    {
        token: {
            type: String,
            required: [true, "Token is required"],
            unique: true,
        },
    },
    {
        timestamps: true,
    }
);

// Automatically delete blacklist entries after 3 days
tokenBlacklistSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: 60 * 60 * 24 * 3 }
);

const TokenBlacklist = mongoose.model(
    "TokenBlacklist",
    tokenBlacklistSchema
);

module.exports = TokenBlacklist;