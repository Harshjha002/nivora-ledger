const mongoose = require("mongoose");

const ledgerSchema = new mongoose.Schema(
    {
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Account",
            required: [true, "Ledger must be associated with an account"],
            index: true,
            immutable: true,
        },

        amount: {
            type: Number,
            required: [true, "Amount is required for creating ledger entry"],
            min: [1, "Ledger amount must be at least 1 paise"],
            validate: {
                validator: Number.isSafeInteger,
                message: "Ledger amount must be a safe integer in paise",
            },
            immutable: true,
        },

        transaction: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Transaction",
            required: [true, "Ledger must be associated with a transaction"],
            index: true,
            immutable: true,
        },

        type: {
            type: String,
            enum: {
                values: ["CREDIT", "DEBIT"],
                message: "Type must be either CREDIT or DEBIT",
            },
            required: [true, "Ledger type is required"],
            immutable: true,
        },
    },
    {
        timestamps: true,
    }
);

ledgerSchema.index({ account: 1, createdAt: -1 });
ledgerSchema.index(
    { transaction: 1, type: 1 },
    { unique: true }
);

const preventLedgerModification = () => {
    throw new Error(
        "Ledger entries are immutable and cannot be modified or deleted"
    );
};

ledgerSchema.pre("findOneAndUpdate", preventLedgerModification);
ledgerSchema.pre("updateOne", preventLedgerModification);
ledgerSchema.pre("updateMany", preventLedgerModification);
ledgerSchema.pre("findOneAndReplace", preventLedgerModification);

ledgerSchema.pre("deleteOne", preventLedgerModification);
ledgerSchema.pre("deleteMany", preventLedgerModification);
ledgerSchema.pre("findOneAndDelete", preventLedgerModification);

const Ledger = mongoose.model("Ledger", ledgerSchema);

module.exports = Ledger;