module.exports = {
    testEnvironment: "node",
    setupFiles: ["<rootDir>/tests/env.setup.js"],
    testTimeout: 30000,
    verbose: true,
    collectCoverageFrom: ["src/**/*.js", "!src/**/*.config.js"],
    coveragePathIgnorePatterns: ["/node_modules/", "/tests/"],
};