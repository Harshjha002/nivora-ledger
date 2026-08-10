const express = require("express");
const cookieParser = require("cookie-parser");

const authRouter = require("./routes/auth.route");
const accountRouter = require("./routes/account.route");
const transactionRoutes = require("./routes/transaction.route");

const app = express();

app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.get("/health", (req, res) => {
    return res.status(200).json({
        status: "success",
        message: "Nivora Ledger API is running",
    });
});

app.use("/v1/api/auth", authRouter);
app.use("/v1/api/account", accountRouter);
app.use("/v1/api/transaction", transactionRoutes);

app.use((req, res) => {
    return res.status(404).json({
        status: "failed",
        message: "Route not found",
    });
});

app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);

    return res.status(500).json({
        status: "failed",
        message: "Internal server error",
    });
});

module.exports = app;