const Account = require("../models/account.model");
const Transaction = require("../models/transaction.model");
const Ledger = require("../models/ledger.model");
const emailService = require("../services/email.service");
const mongoose = require("mongoose");
const TransactionHistoryDTO = require("../dto/transaction-history.dto");
const transactionService = require("../services/transaction.service");

const getTransactionHistory = async (req, res) => {
  const result = await transactionService.getTransactionHistory(
    req.user.id,
    req.query,
  );
  return res.status(200).json({
    success: true,
    ...result,
  });
};

const createTransaction = async (req, res) => {
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
    if (error.statusCode === 400 && error.message === "INSUFFICIENT_BALANCE") {
      return res.status(400).json({
        message: "Insufficient balance",
        currentBalance: error.currentBalance,
        requestedAmount: error.requestedAmount,
      });
    }

    console.error("Transaction failed:", error.message);

    return res.status(error.statusCode || 500).json({
      message: error.message || "Transaction failed",
    });
  }
};

const createInitialFundsTransaction = async (req, res) => {
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
    console.error("Transaction failed:", error);

    if (error.statusCode === 400 && error.message === "INSUFFICIENT_BALANCE") {
      return res.status(400).json({
        message: "Insufficient balance",
        currentBalance: error.currentBalance,
        requestedAmount: error.requestedAmount,
      });
    }

    return res.status(error.statusCode || 500).json({
      message: error.message || "Transaction failed",
    });
  }
};

module.exports = {
  createTransaction,
  createInitialFundsTransaction,
  getTransactionHistory,
};
