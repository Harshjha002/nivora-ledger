require("dotenv").config();

const env = require("./src/config/env");
const app = require("./src/app");
const connectToDB = require("./src/config/db");

const startServer = async () => {
    try {
        await connectToDB();

        app.listen(env.PORT, "0.0.0.0", () => {
            console.log(`Server is running on port ${env.PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();