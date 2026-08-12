const mongoose = require("mongoose");
const Account = require("../models/account.model");
const ApiError = require("../utils/ApiError");

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
    throw new ApiError(400, "Invalid account ID");
  }

  const account = await Account.findOne({
    _id: accountId,
    user: userId,
  });

  if (!account) {
    throw new ApiError(404, "Account not found");
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
