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
        message: "Status must be PENDING, COMPLETED, FAILED, or REVERSED",
      },
      default: "PENDING",
    },

    amount: {
      type: Number,
      required: [true, "Amount is required for creating a transaction"],
      min: [1, "Transaction amount must be at least 1 paise"],
      validate: {
        validator: Number.isSafeInteger,
        message: "Transaction amount must be a safe integer in paise",
      },
    },

    idempotencyKey: {
      type: String,
      required: [true, "Idempotency key is required"],
      unique: true,
      trim: true,
      minlength: [16, "Idempotency key must be at least 16 characters"],
      maxlength: [100, "Idempotency key cannot exceed 100 characters"],
    },

    reversalOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",

    },
  },
  {
    timestamps: true,
  },
);

transactionSchema.index({ fromAccount: 1, createdAt: -1 });
transactionSchema.index({ toAccount: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });

transactionSchema.index(
  { reversalOf: 1 },
  {
    unique: true,
    sparse: true,
  },
);

const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = Transaction;
