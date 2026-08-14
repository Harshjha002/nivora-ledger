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

const env = {
    PORT: Number(process.env.PORT) || 3000,
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,

    CLIENT_ID: process.env.CLIENT_ID,
    CLIENT_SECRET: process.env.CLIENT_SECRET,
    REFRESH_TOKEN: process.env.REFRESH_TOKEN,
    EMAIL_USER: process.env.EMAIL_USER,

    CLIENT_URL: process.env.CLIENT_URL,
};

module.exports = env;