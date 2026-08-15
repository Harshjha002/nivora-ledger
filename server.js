require("dotenv").config();

const env = require("./src/config/env");
const app = require("./src/app");
const logger = require("./src/config/logger");
const {
    connectToDB,
    disconnectFromDB,
} = require("./src/config/db");

let server;

const startServer = async () => {
    try {
        await connectToDB();

        server = app.listen(env.PORT, "0.0.0.0", () => {
            logger.info({ port: env.PORT }, "Server is running");
        });
    } catch (error) {
        logger.error({ err: error }, "Failed to start server");
        process.exit(1);
    }
};

const shutdown = async (signal) => {
    logger.info({ signal }, "Signal received. Starting graceful shutdown...");

    if (!server) {
        await disconnectFromDB();
        process.exit(0);
    }

    server.close(async (error) => {
        if (error) {
            logger.error({ err: error }, "HTTP server shutdown failed");
            process.exit(1);
        }

        logger.info("HTTP server closed");

        try {
            await disconnectFromDB();
            process.exit(0);
        } catch (dbError) {
            logger.error({ err: dbError }, "Graceful shutdown failed");
            process.exit(1);
        }
    });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startServer();