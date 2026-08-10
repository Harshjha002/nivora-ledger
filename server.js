require("dotenv").config();

const app = require("./src/app");
const connectToDB = require("./src/config/db");

const PORT = Number(process.env.PORT) || 3000;

const startServer = async () => {
    try {
        await connectToDB();

        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();