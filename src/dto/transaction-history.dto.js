class TransactionHistoryDTO {
    constructor({
        transactionId,
        fromAccount,
        toAccount,
        amount,
        direction,
        status,
        createdAt,
    }) {
        this.transactionId = transactionId;
        this.fromAccount = fromAccount;
        this.toAccount = toAccount;
        this.amount = amount;
        this.direction = direction;
        this.status = status;
        this.createdAt = createdAt;
    }
}

module.exports = TransactionHistoryDTO;