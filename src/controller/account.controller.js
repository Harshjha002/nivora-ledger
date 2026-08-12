const accountService = require("../services/account.service");

const createAccountController = async (req, res, next) => {
  try {
    const account = await accountService.createAccount(req.user._id);

    return res.status(201).json({
      message: "Account created successfully",
      account,
    });
  } catch (error) {
    next(error);
  }
};

const getUserAccountController = async (req, res, next) => {
  try {
    const accounts = await accountService.getUserAccounts(req.user._id);

    return res.status(200).json({
      accounts,
    });
  } catch (error) {
    next(error);
  }
};

const getAccountBalance = async (req, res, next) => {
  try {
    const result = await accountService.getAccountBalance(
      req.user._id,
      req.params.accountId
    );

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAccountController,
  getUserAccountController,
  getAccountBalance,
};