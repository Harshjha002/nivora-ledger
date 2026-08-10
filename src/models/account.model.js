const mongoose = require("mongoose");
const Ledger = require("./ledger.model");

const accountSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Account must be associated with a user"],
            index: true,
        },

        status: {
            type: String,
            enum: {
                values: ["ACTIVE", "FROZEN", "CLOSED"],
                message: "Status must be ACTIVE, FROZEN, or CLOSED",
            },
            default: "ACTIVE",
        },

        currency: {
            type: String,
            required: [true, "Currency is required for creating an account"],
            default: "INR",
            uppercase: true,
            trim: true,
            match: [
                /^[A-Z]{3}$/,
                "Currency must be a valid 3-letter currency code",
            ],
        },

        transferVersion: {
            type: Number,
            default: 0,
            select: false,
        },
    },
    {
        timestamps: true,
    }
);

accountSchema.index({ user: 1, status: 1 });

accountSchema.methods.getBalance = async function (session) {
    const aggregate = Ledger.aggregate([
        {
            $match: {
                account: this._id,
            },
        },
        {
            $group: {
                _id: null,

                totalDebit: {
                    $sum: {
                        $cond: [
                            { $eq: ["$type", "DEBIT"] },
                            "$amount",
                            0,
                        ],
                    },
                },

                totalCredit: {
                    $sum: {
                        $cond: [
                            { $eq: ["$type", "CREDIT"] },
                            "$amount",
                            0,
                        ],
                    },
                },
            },
        },
        {
            $project: {
                _id: 0,
                balance: {
                    $subtract: ["$totalCredit", "$totalDebit"],
                },
            },
        },
    ]);

    if (session) {
        aggregate.session(session);
    }

    const balanceData = await aggregate;

    if (balanceData.length === 0) {
        return 0;
    }

    return balanceData[0].balance;
};

const Account = mongoose.model("Account", accountSchema);

module.exports = Account;