const { MongoMemoryReplSet } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let replSet;

/**
 * Nivora Ledger uses multi-document MongoDB transactions (session.withTransaction)
 * for every transfer. Transactions require a replica set — a standalone mongod
 * will not work. We spin up a single-node in-memory replica set for tests so the
 * exact same transactional code path is exercised as in production.
 */
const connect = async () => {
    replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: "wiredTiger" },
    });

    const uri = replSet.getUri();

    await mongoose.connect(uri);
};

const closeDatabase = async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await replSet.stop();
};

const clearDatabase = async () => {
    const collections = mongoose.connection.collections;

    for (const key in collections) {
        await collections[key].deleteMany({});
    }
};

module.exports = { connect, closeDatabase, clearDatabase };
