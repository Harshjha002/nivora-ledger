require("dotenv").config();

const mongoose = require("mongoose");
const app = require("../src/app");
const logger = require("../src/config/logger");


let cachedConnection = null;

async function ensureDbConnected() {
    if (cachedConnection && mongoose.connection.readyState === 1) {
        return cachedConnection;
    }

    cachedConnection = await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 10000,
    });

    logger.info("Database connected successfully (serverless)");
    return cachedConnection;
}

module.exports = async (req, res) => {
    try {
        await ensureDbConnected();
    } catch (error) {
        logger.error({ err: error }, "Database connection failed");
        return res.status(503).json({
            status: "failed",
            message: "Database unavailable",
        });
    }

    return app(req, res);
};