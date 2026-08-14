const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

const authRouter = require("./routes/auth.route");
const accountRouter = require("./routes/account.route");
const transactionRoutes = require("./routes/transaction.route");
const errorMiddleware = require("./middleware/error.middleware");

const app = express();

app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  }),
);

app.get("/health", (req, res) => {
  return res.status(200).json({
    status: "success",
    message: "Nivora Ledger API is running",
  });
});

app.use("/v1/api/auth", authRouter);
app.use("/v1/api/account", accountRouter);
app.use("/v1/api/transaction", transactionRoutes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use((req, res) => {
  return res.status(404).json({
    status: "failed",
    message: "Route not found",
  });
});

app.use(errorMiddleware);

module.exports = app;
