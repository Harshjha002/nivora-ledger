const Account = require("../models/account.model");

const createAccountController = async (req, res) => {
    const user = req.user;

    const account = await Account.create({
        user: user._id
    });

    return res.status(201).json({
        account
    });
};

const getUserAccountController = async (req,res) => {
 const accounts = await Account.find({user:req.user._id})
 res.status(200).json({
    accounts
 })
}


const getAccountBalance = async (req, res) => {

    const { accountId } = req.params;

    const account = await Account.findOne({
        _id: accountId,
        user: req.user._id
    });

    if (!account) {
        return res.status(404).json({
            message: "Account not found"
        });
    } 

    const balance = await account.getBalance();

    return res.status(200).json({
        accountId: account._id,
        balance
    });
};

module.exports = {
    createAccountController,
    getUserAccountController,
    getAccountBalance
};