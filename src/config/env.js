const requiredEnv = [
    "MONGO_URI",
    "JWT_SECRET",
    "CLIENT_ID",
    "CLIENT_SECRET",
    "REFRESH_TOKEN",
    "EMAIL_USER",
    "CLIENT_URL",
];

const missingEnv = requiredEnv.filter(
    (key) => !process.env[key]
);

if (missingEnv.length > 0) {
    throw new Error(
        `Missing required environment variables: ${missingEnv.join(", ")}`
    );
}

const nodeEnv = process.env.NODE_ENV || "development";

const allowedEnvironments = [
    "development",
    "test",
    "production",
];

if (!allowedEnvironments.includes(nodeEnv)) {
    throw new Error(
        `Invalid NODE_ENV: ${nodeEnv}. Expected development, test, or production.`
    );
}

const logLevel = process.env.LOG_LEVEL || "info";

const allowedLogLevels = [
    "fatal",
    "error",
    "warn",
    "info",
    "debug",
    "trace",
];

if (!allowedLogLevels.includes(logLevel)) {
    throw new Error(
        `Invalid LOG_LEVEL: ${logLevel}.`
    );
}

const env = {
    NODE_ENV: nodeEnv,
    PORT: Number(process.env.PORT) || 3000,

    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,

    CLIENT_ID: process.env.CLIENT_ID,
    CLIENT_SECRET: process.env.CLIENT_SECRET,
    REFRESH_TOKEN: process.env.REFRESH_TOKEN,
    EMAIL_USER: process.env.EMAIL_USER,

    CLIENT_URL: process.env.CLIENT_URL,

    LOG_LEVEL: logLevel,
};

module.exports = env;