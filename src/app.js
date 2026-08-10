const express = require("express");
const cookieParser = require("cookie-parser");



const app = express();

app.use(express.json());
app.use(cookieParser());

/** 
 * - Routes required
*/
const authRouter = require("./routes/auth.route");
const accountRouter = require("./routes/account.route");
const transactionRoutes = require("./routes/transaction.route")


/** 
 * - Use Routes
*/
app.use("/v1/api/auth", authRouter);
app.use("/v1/api/account", accountRouter);
app.use("/v1/api/transaction" , transactionRoutes)

module.exports = app;