module.exports = {
    testEnvironment: "node",
    setupFiles: ["<rootDir>/tests/env.setup.js"],
    testTimeout: 30000,
    verbose: true,
    coveragePathIgnorePatterns: ["/node_modules/", "/tests/"],
};
