const Account = require("../models/account.model");
const Transaction = require("../models/transaction.model");
const Ledger = require("../models/ledger.model");
const emailService = require("../services/email.service");
const mongoose = require("mongoose");

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
 * 9. Commit MongoDB session
 * 10. Send email notification
 */

const createTransaction = async (req, res) => {

    /**
     * 1. Validate request
     *
     * Zod validation middleware handles basic
     * request validation before reaching this controller.
     */

    const { fromAccount, toAccount, amount } = req.body;

    // Sender and receiver cannot be the same account
    if (fromAccount === toAccount) {
        return res.status(400).json({
            message: "Sender and receiver accounts must be different",
        });
    }

    const idempotencyKey = req.headers["idempotency-key"];


    /**
     * 2. Validate idempotency key
     */

    if (!idempotencyKey) {
        return res.status(400).json({
            message: "Idempotency-Key header is required",
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


    /**
     * Find sender and receiver accounts
     */

    const [fromUserAccount, toUserAccount] = await Promise.all([
        Account.findById(fromAccount),
        Account.findById(toAccount),
    ]);

    if (!fromUserAccount || !toUserAccount) {
        return res.status(404).json({
            message: "Sender or receiver account not found",
        });
    }


    /**
     * Validate account ownership
     *
     * The authenticated user must own the sender account.
     */

    if (
        fromUserAccount.user.toString() !==
        req.user._id.toString()
    ) {
        return res.status(403).json({
            message: "You are not authorized to use this account",
        });
    }


    /**
     * 3. Check account status
     *
     * Both accounts must be ACTIVE.
     */

    if (
        fromUserAccount.status !== "ACTIVE" ||
        toUserAccount.status !== "ACTIVE"
    ) {
        return res.status(400).json({
            message: "Sender and receiver accounts must be active",
        });
    }


    /**
     * Start MongoDB session
     */

    const session = await mongoose.startSession();

    try {

        session.startTransaction();


        /**
         * 4. Derive sender balance from Ledger
         */

        const balance = await fromUserAccount.getBalance();

        if (balance < amount) {

            await session.abortTransaction();

            return res.status(400).json({
                message: "Insufficient balance",
                currentBalance: balance,
                requestedAmount: amount,
            });
        }


        /**
         * 5. Create transaction (PENDING)
         */

        const [transaction] = await Transaction.create(
            [
                {
                    fromAccount,
                    toAccount,
                    amount,
                    idempotencyKey,
                    status: "PENDING",
                },
            ],
            { session }
        );


        /**
         * 6. Create DEBIT Ledger entry
         *
         * Money leaves sender account.
         */

        await Ledger.create(
            [
                {
                    account: fromAccount,
                    amount,
                    transaction: transaction._id,
                    type: "DEBIT",
                },
            ],
            { session }
        );


        /**
         * 7. Create CREDIT Ledger entry
         *
         * Money enters receiver account.
         */

        await Ledger.create(
            [
                {
                    account: toAccount,
                    amount,
                    transaction: transaction._id,
                    type: "CREDIT",
                },
            ],
            { session }
        );


        /**
         * 8. Mark transaction COMPLETED
         */

        transaction.status = "COMPLETED";

        await transaction.save({ session });


        /**
         * 9. Commit MongoDB session
         */

        await session.commitTransaction();


        /**
         * 10. Send email notification
         *
         * Email is sent AFTER the database transaction
         * successfully commits.
         */

        try {

            await emailService.sendTransactionEmail(
                req.user.email,
                req.user.name,
                amount,
                toAccount
            );

        } catch (emailError) {

            // Transaction is already successful.
            // Email failure should not undo the transaction.

            console.error(
                "Transaction completed but email failed:",
                emailError
            );
        }


        /**
         * Return successful response
         */

        return res.status(201).json({
            message: "Transaction completed successfully",
            transaction,
        });


    } catch (error) {

        /**
         * Rollback everything if any operation fails.
         */

        await session.abortTransaction();

        console.error("Transaction failed:", error);

        return res.status(500).json({
            message: "Transaction failed",
        });

    } finally {

        await session.endSession();
    }
};

const createInitialFundsTransaction = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        /**
         * 1. Validate request
         *
         * Zod middleware already validates:
         * - toAccount
         * - amount
         */

        const { toAccount, amount } = req.body;

        /**
         * 2. Get system user
         *
         * authSystemUserMiddleware has already verified
         * that the authenticated user is the system user.
         */

        const systemUser = req.user;

        /**
         * 3. Find system account
         */

        const systemAccount = await Account.findOne({
            user: systemUser._id,
            status: "ACTIVE",
        });

        if (!systemAccount) {
            return res.status(404).json({
                message: "System account not found",
            });
        }

        /**
         * 4. Find receiver account
         */

        const receiverAccount = await Account.findById(toAccount);

        if (!receiverAccount) {
            return res.status(404).json({
                message: "Receiver account not found",
            });
        }

        /**
         * 5. Check receiver account status
         */

        if (receiverAccount.status !== "ACTIVE") {
            return res.status(400).json({
                message: "Receiver account must be active",
            });
        }

        /**
         * 6. Prevent system account from funding itself
         */

        if (
            systemAccount._id.toString() ===
            receiverAccount._id.toString()
        ) {
            return res.status(400).json({
                message: "System account cannot fund itself",
            });
        }

        /**
         * 7. Get idempotency key
         */

        const idempotencyKey =
            req.headers["idempotency-key"];

        if (!idempotencyKey) {
            return res.status(400).json({
                message: "Idempotency-Key header is required",
            });
        }

        /**
         * 8. Check idempotency
         */

        const existingTransaction =
            await Transaction.findOne({
                idempotencyKey,
            });

        if (existingTransaction) {
            return res.status(200).json({
                message: "Initial funds transaction already exists",
                transaction: existingTransaction,
            });
        }

        /**
         * 9. Start MongoDB transaction
         */

        session.startTransaction();

        /**
         * 10. Create transaction
         *
         * IMPORTANT:
         * Transaction.create() receives an ARRAY here
         * because we are destructuring the returned document.
         */

        const [transaction] = await Transaction.create(
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

        /**
         * 11. Create DEBIT ledger entry
         *
         * System account loses money.
         */

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

        /**
         * 12. Create CREDIT ledger entry
         *
         * Receiver account receives money.
         */

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

        /**
         * 13. Mark transaction COMPLETED
         */

        transaction.status = "COMPLETED";

        await transaction.save({ session });

        /**
         * 14. Commit MongoDB transaction
         */

        await session.commitTransaction();

        /**
         * 15. Send email
         *
         * Email failure should NOT reverse
         * an already completed financial transaction.
         */

        try {
            await emailService.sendTransactionEmail(
                receiverAccount.user.email,
                receiverAccount.user.name,
                amount,
                receiverAccount._id
            );
        } catch (emailError) {
            console.error(
                "Initial funds completed but email failed:",
                emailError
            );
        }

        /**
         * 16. Return response
         */

        return res.status(201).json({
            message: "Initial funds added successfully",
            transaction,
        });

    } catch (error) {

        /**
         * Rollback all database operations
         * if anything failed before commit.
         */

        if (session.inTransaction()) {
            await session.abortTransaction();
        }

        console.error(
            "Initial funds transaction failed:",
            error
        );

        return res.status(500).json({
            message: "Initial funds transaction failed",
            error: error.message,
        });

    } finally {

        /**
         * Always close the MongoDB session.
         */

        await session.endSession();
    }
};

module.exports = {
    createTransaction,
    createInitialFundsTransaction,
};