require("dotenv").config();

const env = require("./src/config/env");
const app = require("./src/app");
const {
    connectToDB,
    disconnectFromDB,
} = require("./src/config/db");

let server;

const startServer = async () => {
    try {
        await connectToDB();

        server = app.listen(env.PORT, "0.0.0.0", () => {
            console.log(`Server is running on port ${env.PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

const shutdown = async (signal) => {
    console.log(`${signal} received. Starting graceful shutdown...`);

    if (!server) {
        await disconnectFromDB();
        process.exit(0);
    }

    server.close(async (error) => {
        if (error) {
            console.error("HTTP server shutdown failed:", error);
            process.exit(1);
        }

        console.log("HTTP server closed");

        try {
            await disconnectFromDB();
            process.exit(0);
        } catch (dbError) {
            console.error("Graceful shutdown failed:", dbError);
            process.exit(1);
        }
    });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startServer();