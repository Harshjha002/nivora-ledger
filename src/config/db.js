const mongoose = require("mongoose");
const logger = require("./logger");

const connectToDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
        });

        logger.info("Database connected successfully");
    } catch (error) {
        logger.error({ err: error }, "Database connection failed");
        throw error;
    }
};

const disconnectFromDB = async () => {
    try {
        await mongoose.disconnect();
        logger.info("Database disconnected successfully");
    } catch (error) {
        logger.error({ err: error }, "Database disconnection failed");
        throw error;
    }
};

module.exports = {
    connectToDB,
    disconnectFromDB,
};