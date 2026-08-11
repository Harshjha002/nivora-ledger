const Account = require("../models/account.model");
const Transaction = require("../models/transaction.model");
const Ledger = require("../models/ledger.model");
const emailService = require("../services/email.service");
const mongoose = require("mongoose");
const TransactionHistoryDTO = require("../dto/transaction-history.dto");

const getTransactionHistory = async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

  const skip = (page - 1) * limit;

  const accounts = await Account.find({
    user: req.user.id,
  }).select("_id");

  const accountIds = accounts.map((account) => account._id);

  const transactionFilter = {
    $or: [
      { fromAccount: { $in: accountIds } },
      { toAccount: { $in: accountIds } },
    ],
  };

  const total = await Transaction.countDocuments(transactionFilter);

  const transactions = await Transaction.find(transactionFilter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalPages = Math.ceil(total / limit);

  const transactionIds = transactions.map((transaction) => transaction._id);

  const ledgerEntries = await Ledger.find({
    account: { $in: accountIds },
    transaction: { $in: transactionIds },
  });

  const ledgerMap = new Map(
    ledgerEntries.map((entry) => [entry.transaction.toString(), entry.type]),
  );

  const transactionHistory = transactions.map((transaction) => {
    const direction = ledgerMap.get(transaction._id.toString());

    return new TransactionHistoryDTO({
      transactionId: transaction._id,
      fromAccount: transaction.fromAccount,
      toAccount: transaction.toAccount,
      amount: transaction.amount,
      direction,
      status: transaction.status,
      createdAt: transaction.createdAt,
    });
  });

  return res.status(200).json({
    success: true,
    transactions: transactionHistory,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
};

/**
 * Create a new transaction
 *
 * THE 10-STEP TRANSFER FLOW:
 *
 * 1. Validate request
 * 2. Validate idempotency key
 * 3. Check account status
 * 4. Derive sender balance from Ledger
 * 5. Create transaction (PENDING)
 * 6. Create DEBIT Ledger entry
 * 7. Create CREDIT Ledger entry
 * 8. Mark transaction COMPLETED
 * 9. Send email notification
 */

const createTransaction = async (req, res) => {
  const { fromAccount, toAccount, amount } = req.body;

  if (fromAccount === toAccount) {
    return res.status(400).json({
      message: "Sender and receiver accounts must be different",
    });
  }

  const idempotencyKey = req.headers["idempotency-key"];

  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.length < 16 ||
    idempotencyKey.length > 100
  ) {
    return res.status(400).json({
      message: "Invalid Idempotency-Key",
    });
  }

  const existingTransaction = await Transaction.findOne({
    idempotencyKey,
  });

  if (existingTransaction) {
    switch (existingTransaction.status) {
      case "COMPLETED":
        return res.status(200).json({
          message: "Transaction already completed",
          transaction: existingTransaction,
        });

      case "PENDING":
        return res.status(409).json({
          message: "Transaction is still being processed",
          transaction: existingTransaction,
        });

      case "FAILED":
        return res.status(400).json({
          message: "Previous transaction failed",
          transaction: existingTransaction,
        });

      case "REVERSED":
        return res.status(400).json({
          message: "Transaction was reversed",
          transaction: existingTransaction,
        });

      default:
        return res.status(400).json({
          message: "Transaction has an unknown status",
        });
    }
  }

  const [fromUserAccount, toUserAccount] = await Promise.all([
    Account.findById(fromAccount),
    Account.findById(toAccount),
  ]);

  if (!fromUserAccount || !toUserAccount) {
    return res.status(404).json({
      message: "Sender or receiver account not found",
    });
  }

  if (fromUserAccount.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      message: "You are not authorized to use this account",
    });
  }

  if (
    fromUserAccount.status !== "ACTIVE" ||
    toUserAccount.status !== "ACTIVE"
  ) {
    return res.status(400).json({
      message: "Sender and receiver accounts must be active",
    });
  }

  const session = await mongoose.startSession();

  let transaction;

  try {
    await session.withTransaction(async () => {
      // Update the sender account inside the transaction.
      // This creates a write conflict for concurrent transfers
      // using the same account.
      const lockedAccount = await Account.findOneAndUpdate(
        {
          _id: fromAccount,
          status: "ACTIVE",
        },
        {
          $inc: {
            transferVersion: 1,
          },
        },
        {
          new: true,
          session,
        },
      );

      if (!lockedAccount) {
        const error = new Error("Sender account not found or inactive");

        error.statusCode = 404;

        throw error;
      }

      const balance = await lockedAccount.getBalance(session);

      if (balance < amount) {
        const error = new Error("INSUFFICIENT_BALANCE");

        error.statusCode = 400;
        error.currentBalance = balance;
        error.requestedAmount = amount;

        throw error;
      }

      [transaction] = await Transaction.create(
        [
          {
            fromAccount,
            toAccount,
            amount,
            idempotencyKey,
            status: "PENDING",
          },
        ],
        {
          session,
        },
      );

      await Ledger.create(
        [
          {
            account: fromAccount,
            amount,
            transaction: transaction._id,
            type: "DEBIT",
          },
        ],
        {
          session,
        },
      );

      await Ledger.create(
        [
          {
            account: toAccount,
            amount,
            transaction: transaction._id,
            type: "CREDIT",
          },
        ],
        {
          session,
        },
      );

      transaction.status = "COMPLETED";

      await transaction.save({
        session,
      });
    });

    // Email is intentionally outside the database transaction.
    try {
      await emailService.sendTransactionEmail(
        req.user.email,
        req.user.name,
        amount,
        toAccount,
      );
    } catch (emailError) {
      console.error(
        "Transaction completed but email failed:",
        emailError.message,
      );
    }

    return res.status(201).json({
      message: "Transaction completed successfully",
      transaction,
    });
  } catch (error) {
    if (error.statusCode === 400 && error.message === "INSUFFICIENT_BALANCE") {
      return res.status(400).json({
        message: "Insufficient balance",
        currentBalance: error.currentBalance,
        requestedAmount: error.requestedAmount,
      });
    }

    if (error.code === 11000 && error.keyPattern?.idempotencyKey) {
      const existingTransaction = await Transaction.findOne({
        idempotencyKey,
      });

      if (existingTransaction) {
        return res.status(200).json({
          message: "Transaction already processed",
          transaction: existingTransaction,
        });
      }

      return res.status(409).json({
        message: "Duplicate idempotency key",
      });
    }

    console.error("Transaction failed:", error.message);

    return res.status(500).json({
      message: "Transaction failed",
    });
  } finally {
    await session.endSession();
  }
};

const createInitialFundsTransaction = async (req, res) => {
  const { toAccount, amount } = req.body;
  const idempotencyKey = req.headers["idempotency-key"];

  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.length < 16 ||
    idempotencyKey.length > 100
  ) {
    return res.status(400).json({
      message: "Invalid Idempotency-Key",
    });
  }

  const existingTransaction = await Transaction.findOne({
    idempotencyKey,
  });

  if (existingTransaction) {
    switch (existingTransaction.status) {
      case "COMPLETED":
        return res.status(200).json({
          message: "Initial funds transaction already completed",
          transaction: existingTransaction,
        });

      case "PENDING":
        return res.status(409).json({
          message: "Initial funds transaction is still being processed",
          transaction: existingTransaction,
        });

      case "FAILED":
        return res.status(400).json({
          message: "Previous initial funds transaction failed",
          transaction: existingTransaction,
        });

      case "REVERSED":
        return res.status(400).json({
          message: "Initial funds transaction was reversed",
          transaction: existingTransaction,
        });

      default:
        return res.status(400).json({
          message: "Transaction has an unknown status",
        });
    }
  }

  const session = await mongoose.startSession();

  let transaction;
  let receiverAccount;

  try {
    await session.withTransaction(async () => {
      const systemAccount = await Account.findOne({
        user: req.user._id,
        status: "ACTIVE",
      }).session(session);

      if (!systemAccount) {
        const error = new Error("System account not found");
        error.statusCode = 404;
        throw error;
      }

      receiverAccount = await Account.findById(toAccount)
        .populate("user", "email name")
        .session(session);

      if (!receiverAccount) {
        const error = new Error("Receiver account not found");
        error.statusCode = 404;
        throw error;
      }

      if (receiverAccount.status !== "ACTIVE") {
        const error = new Error("Receiver account must be active");
        error.statusCode = 400;
        throw error;
      }

      if (systemAccount._id.toString() === receiverAccount._id.toString()) {
        const error = new Error("System account cannot fund itself");
        error.statusCode = 400;
        throw error;
      }

      [transaction] = await Transaction.create(
        [
          {
            fromAccount: systemAccount._id,
            toAccount: receiverAccount._id,
            amount,
            idempotencyKey,
            status: "PENDING",
          },
        ],
        { session },
      );

      await Ledger.create(
        [
          {
            account: systemAccount._id,
            amount,
            transaction: transaction._id,
            type: "DEBIT",
          },
        ],
        { session },
      );

      await Ledger.create(
        [
          {
            account: receiverAccount._id,
            amount,
            transaction: transaction._id,
            type: "CREDIT",
          },
        ],
        { session },
      );

      transaction.status = "COMPLETED";

      await transaction.save({ session });
    });

    try {
      await emailService.sendTransactionEmail(
        receiverAccount.user.email,
        receiverAccount.user.name,
        amount,
        receiverAccount._id,
      );
    } catch (emailError) {
      console.error(
        "Initial funds transaction completed but email failed:",
        emailError.message,
      );
    }

    return res.status(201).json({
      message: "Initial funds added successfully",
      transaction,
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.idempotencyKey) {
      const existingTransaction = await Transaction.findOne({
        idempotencyKey,
      });

      if (existingTransaction) {
        return res.status(200).json({
          message: "Initial funds transaction already processed",
          transaction: existingTransaction,
        });
      }

      return res.status(409).json({
        message: "Duplicate idempotency key",
      });
    }

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    console.error("Initial funds transaction failed:", error.message);

    return res.status(500).json({
      message: "Initial funds transaction failed",
    });
  } finally {
    await session.endSession();
  }
};

module.exports = {
  createTransaction,
  createInitialFundsTransaction,
  getTransactionHistory,
};
