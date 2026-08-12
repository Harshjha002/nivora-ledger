const transactionService = require("../services/transaction.service");

const getTransactionHistory = async (req, res, next) => {
  try {
    const result = await transactionService.getTransactionHistory(
      req.user.id,
      req.query
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const createTransaction = async (req, res, next) => {
  try {
    const result = await transactionService.createTransaction({
      user: req.user,
      fromAccount: req.body.fromAccount,
      toAccount: req.body.toAccount,
      amount: req.body.amount,
      idempotencyKey: req.headers["idempotency-key"],
    });

    return res.status(result.statusCode || 201).json({
      message: result.message,
      transaction: result.transaction,
    });
  } catch (error) {
    next(error);
  }
};

const createInitialFundsTransaction = async (req, res, next) => {
  try {
    const result = await transactionService.createInitialFundsTransaction({
      user: req.user,
      toAccount: req.body.toAccount,
      amount: req.body.amount,
      idempotencyKey: req.headers["idempotency-key"],
    });

    return res.status(result.statusCode || 201).json({
      message: result.message,
      transaction: result.transaction,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTransaction,
  createInitialFundsTransaction,
  getTransactionHistory,
};