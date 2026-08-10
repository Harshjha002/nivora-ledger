const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        fromAccount: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Account",
            required: [true, "Transaction must be associated with a from account"],
            index: true,
        },

        toAccount: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Account",
            required: [true, "Transaction must be associated with a to account"],
            index: true,
        },

        status: {
            type: String,
            enum: {
                values: ["PENDING", "COMPLETED", "FAILED", "REVERSED"],
                message:
                    "Status must be PENDING, COMPLETED, FAILED, or REVERSED",
            },
            default: "PENDING",
        },

        amount: {
            type: Number,
            required: [true, "Amount is required for creating a transaction"],
            min: [0.01, "Transaction amount must be greater than 0"],
        },

        idempotencyKey: {
            type: String,
            required: [true, "Idempotency key is required"],
            unique: true,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = Transaction;