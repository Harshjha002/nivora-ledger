const Account = require("../models/account.model");
const Transaction = require("../models/transaction.model");
const Ledger = require("../models/ledger.model");
const TransactionHistoryDTO = require("../dto/transaction-history.dto");
const mongoose = require("mongoose");
const emailService = require("../services/email.service");

const getTransactionHistory = async (userId, query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(query.limit, 10) || 20, 100);

  const skip = (page - 1) * limit;

  const accounts = await Account.find({
    user: userId,
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

  return {
    transactions: transactionHistory,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
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
const createTransaction = async ({
  user,
  fromAccount,
  toAccount,
  amount,
  idempotencyKey,
}) => {
  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.length < 16 ||
    idempotencyKey.length > 100
  ) {
    const error = new Error("Invalid Idempotency-Key");
    error.statusCode = 400;
    throw error;
  }

  if (fromAccount === toAccount) {
    const error = new Error("Sender and receiver accounts must be different");

    error.statusCode = 400;
    throw error;
  }

  const existingTransaction = await Transaction.findOne({
    idempotencyKey,
  });

  if (existingTransaction) {
    switch (existingTransaction.status) {
      case "COMPLETED":
        return {
          statusCode: 200,
          message: "Transaction already completed",
          transaction: existingTransaction,
        };

      case "PENDING":
        return {
          statusCode: 409,
          message: "Transaction is still being processed",
          transaction: existingTransaction,
        };

      case "FAILED":
        return {
          statusCode: 400,
          message: "Previous transaction failed",
          transaction: existingTransaction,
        };

      case "REVERSED":
        return {
          statusCode: 400,
          message: "Transaction was reversed",
          transaction: existingTransaction,
        };

      default: {
        const error = new Error("Transaction has an unknown status");

        error.statusCode = 400;
        throw error;
      }
    }
  }

  const [fromUserAccount, toUserAccount] = await Promise.all([
    Account.findById(fromAccount),
    Account.findById(toAccount),
  ]);

  if (!fromUserAccount || !toUserAccount) {
    const error = new Error("Sender or receiver account not found");

    error.statusCode = 404;
    throw error;
  }

  if (fromUserAccount.user.toString() !== user._id.toString()) {
    const error = new Error("You are not authorized to use this account");

    error.statusCode = 403;
    throw error;
  }

  if (
    fromUserAccount.status !== "ACTIVE" ||
    toUserAccount.status !== "ACTIVE"
  ) {
    const error = new Error("Sender and receiver accounts must be active");

    error.statusCode = 400;
    throw error;
  }

  const session = await mongoose.startSession();

  let transaction;

  try {
    await session.withTransaction(async () => {
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

    // Email intentionally stays outside the DB transaction.
    try {
      await emailService.sendTransactionEmail(user.email, user.name, amount, toAccount);
    } catch (emailError) {
      console.error("Transaction completed but email failed:", emailError.message);
    }

    return { message: "Transaction completed successfully", transaction };
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.idempotencyKey) {
      const existingTransaction = await Transaction.findOne({ idempotencyKey });

      if (existingTransaction) {
        return {
          statusCode: 200,
          message: "Transaction already processed",
          transaction: existingTransaction,
        };
      }

      const duplicateError = new Error("Duplicate idempotency key");
      duplicateError.statusCode = 409;
      throw duplicateError;
    }

    throw error; 
  } finally {
    await session.endSession();
  }
};



const createInitialFundsTransaction = async ({
    user,
    toAccount,
    amount,
    idempotencyKey,
}) => {
    if (
        typeof idempotencyKey !== "string" ||
        idempotencyKey.length < 16 ||
        idempotencyKey.length > 100
    ) {
        const error = new Error("Invalid Idempotency-Key");
        error.statusCode = 400;
        throw error;
    }

    const existingTransaction = await Transaction.findOne({
        idempotencyKey,
    });

    if (existingTransaction) {
        switch (existingTransaction.status) {
            case "COMPLETED":
                return {
                    statusCode: 200,
                    message: "Initial funds transaction already completed",
                    transaction: existingTransaction,
                };

            case "PENDING":
                return {
                    statusCode: 409,
                    message:
                        "Initial funds transaction is still being processed",
                    transaction: existingTransaction,
                };

            case "FAILED":
                return {
                    statusCode: 400,
                    message: "Previous initial funds transaction failed",
                    transaction: existingTransaction,
                };

            case "REVERSED":
                return {
                    statusCode: 400,
                    message: "Initial funds transaction was reversed",
                    transaction: existingTransaction,
                };

            default: {
                const error = new Error(
                    "Transaction has an unknown status"
                );
                error.statusCode = 400;
                throw error;
            }
        }
    }

    const session = await mongoose.startSession();

    let transaction;
    let receiverAccount;

    try {
        await session.withTransaction(async () => {
            const systemAccount = await Account.findOne({
                user: user._id,
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
                const error = new Error(
                    "Receiver account must be active"
                );
                error.statusCode = 400;
                throw error;
            }

            if (
                systemAccount._id.toString() ===
                receiverAccount._id.toString()
            ) {
                const error = new Error(
                    "System account cannot fund itself"
                );
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
                { session }
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
                { session }
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
                { session }
            );

            transaction.status = "COMPLETED";

            await transaction.save({ session });
        });

        try {
            await emailService.sendTransactionEmail(
                receiverAccount.user.email,
                receiverAccount.user.name,
                amount,
                receiverAccount._id
            );
        } catch (emailError) {
            console.error(
                "Initial funds transaction completed but email failed:",
                emailError.message
            );
        }

        return {
            statusCode: 201,
            message: "Initial funds added successfully",
            transaction,
        };
    } catch (error) {
        if (
            error.code === 11000 &&
            error.keyPattern?.idempotencyKey
        ) {
            const existingTransaction = await Transaction.findOne({
                idempotencyKey,
            });

            if (existingTransaction) {
                return {
                    statusCode: 200,
                    message:
                        "Initial funds transaction already processed",
                    transaction: existingTransaction,
                };
            }

            const duplicateError = new Error(
                "Duplicate idempotency key"
            );
            duplicateError.statusCode = 409;
            throw duplicateError;
        }

        throw error;
    } finally {
        await session.endSession();
    }
};

module.exports = {
  getTransactionHistory,
  createTransaction,
  createInitialFundsTransaction
};
