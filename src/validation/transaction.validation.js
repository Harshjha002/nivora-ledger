const { z } = require("zod");
const mongoose = require("mongoose");

const objectId = z.string().refine(
    (value) => mongoose.Types.ObjectId.isValid(value),
    {
        message: "Invalid account ID",
    }
);

const createTransactionSchema = z.object({
    fromAccount: objectId,
    toAccount: objectId,
    amount: z
    .number()
    .int("Amount must be an integer in paise")
    .positive("Amount must be greater than 0")
    .safe("Amount must be a safe integer in paise"),
});

const initialFundsSchema = z.object({
    toAccount: objectId,
    amount: z
    .number()
    .int("Amount must be an integer in paise")
    .positive("Amount must be greater than 0")
    .safe("Amount must be a safe integer in paise"),
});

module.exports = {
    createTransactionSchema,
    initialFundsSchema,
};