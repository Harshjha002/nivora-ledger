const pino = require("pino");
const env = require("./env");


const usePrettyLogs =
    env.NODE_ENV === "development" && process.env.VERCEL !== "1";

const logger = pino({
    level: env.LOG_LEVEL,

    redact: {
        paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "req.body.password",
            "req.body.token",
            "req.body.refreshToken",
            "res.headers['set-cookie']",
        ],
        remove: true,
    },

    transport: usePrettyLogs
        ? {
              target: "pino-pretty",
              options: {
                  colorize: true,
                  translateTime: "SYS:standard",
                  ignore: "pid,hostname",
              },
          }
        : undefined,
});

module.exports = logger;