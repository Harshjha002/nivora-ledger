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
            min: [0.01, "Ledger amount must be greater than 0"],
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

const preventLedgerModification = () => {
    throw new Error(
        "Ledger entries are immutable and cannot be modified or deleted"
    );
};

// Prevent updates
ledgerSchema.pre("findOneAndUpdate", preventLedgerModification);
ledgerSchema.pre("updateOne", preventLedgerModification);
ledgerSchema.pre("updateMany", preventLedgerModification);
ledgerSchema.pre("findOneAndReplace", preventLedgerModification);

// Prevent deletes
ledgerSchema.pre("deleteOne", preventLedgerModification);
ledgerSchema.pre("deleteMany", preventLedgerModification);
ledgerSchema.pre("findOneAndDelete", preventLedgerModification);



const Ledger = mongoose.model("Ledger", ledgerSchema);

module.exports = Ledger;