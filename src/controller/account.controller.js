const accountService = require("../services/account.service");

const createAccountController = async (req, res) => {
  try {
    const account = await accountService.createAccount(req.user._id);

    return res.status(201).json({
      message: "Account created successfully",
      account,
    });
  } catch (error) {
    console.error("Create account error:", error);

    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Failed to create account",
    });
  }
};

const getUserAccountController = async (req, res) => {
  try {
    const accounts = await accountService.getUserAccounts(req.user._id);

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
    const result = await accountService.getAccountBalance(
      req.user._id,
      req.params.accountId,
    );
    return res.status(200).json(result);
  } catch (error) {
    console.error("Get account balance error:", error);

    return res.status(error.statusCode || 500).json({
      message: error.statusCode
        ? error.message
        : "Failed to fetch account balance",
    });
  }
};

module.exports = {
  createAccountController,
  getUserAccountController,
  getAccountBalance,
};
