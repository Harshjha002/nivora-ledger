const mongoose = require("mongoose");
const Account = require("../models/account.model");

const createAccount = async (userId) => {
    return Account.create({
        user: userId,
    });
};

const getUserAccounts = async (userId) => {
    return Account.find({
        user: userId,
    });
};

const getAccountBalance = async (userId, accountId) => {
    if (!mongoose.Types.ObjectId.isValid(accountId)) {
        const error = new Error("Invalid account ID");
        error.statusCode = 400;
        throw error;
    }

    const account = await Account.findOne({
        _id: accountId,
        user: userId,
    });

    if (!account) {
        const error = new Error("Account not found");
        error.statusCode = 404;
        throw error;
    }

    const balance = await account.getBalance();

    return {
        accountId: account._id,
        balance,
        currency: account.currency,
    };
};

module.exports = {
    createAccount,
    getUserAccounts,
    getAccountBalance,
};