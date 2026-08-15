const mongoose = require("mongoose");

const connectToDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
        });

        console.log("Database connected successfully");
    } catch (error) {
        console.error("Database connection failed:", error.message);
        throw error;
    }
};

const disconnectFromDB = async () => {
    try {
        await mongoose.disconnect();
        console.log("Database disconnected successfully");
    } catch (error) {
        console.error("Database disconnection failed:", error.message);
        throw error;
    }
};

module.exports = {
    connectToDB,
    disconnectFromDB,
};