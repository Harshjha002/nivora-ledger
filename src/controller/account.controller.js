const mongoose = require("mongoose");
const Account = require("../models/account.model");

const createAccountController = async (req, res) => {
    try {
        const account = await Account.create({
            user: req.user._id,
        });

        return res.status(201).json({
            message: "Account created successfully",
            account,
        });
    } catch (error) {
        console.error("Create account error:", error);

        return res.status(500).json({
            message: "Failed to create account",
        });
    }
};

const getUserAccountController = async (req, res) => {
    try {
        const accounts = await Account.find({
            user: req.user._id,
        });

        return res.status(200).json({
            accounts,
        });
    } catch (error) {
        console.error("Get user accounts error:", error);

        return res.status(500).json({
            message: "Failed to fetch accounts",
        });
    }
};

const getAccountBalance = async (req, res) => {
    try {
        const { accountId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(accountId)) {
            return res.status(400).json({
                message: "Invalid account ID",
            });
        }

        const account = await Account.findOne({
            _id: accountId,
            user: req.user._id,
        });

        if (!account) {
            return res.status(404).json({
                message: "Account not found",
            });
        }

        const balance = await account.getBalance();

        return res.status(200).json({
            accountId: account._id,
            balance,
            currency: account.currency,
        });
    } catch (error) {
        console.error("Get account balance error:", error);

        return res.status(500).json({
            message: "Failed to fetch account balance",
        });
    }
};

module.exports = {
    createAccountController,
    getUserAccountController,
    getAccountBalance,
};