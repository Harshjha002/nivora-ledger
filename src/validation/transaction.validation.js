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
    amount: z.number().positive("Amount must be greater than 0"),
});

const initialFundsSchema = z.object({
    toAccount: objectId,
    amount: z.number().positive("Amount must be greater than 0"),
});

module.exports = {
    createTransactionSchema,
    initialFundsSchema,
};