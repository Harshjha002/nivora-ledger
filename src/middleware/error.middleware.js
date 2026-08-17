const logger = require("../config/logger");

const resolveStatusCode = (err) => {
    if (err.name === "ValidationError") return 400;
    if (err.name === "CastError") return 400;
    if (err.code === 11000) return 409;
    if (err.statusCode) return err.statusCode;
    return 500;
};

const resolveResponseBody = (err) => {
    if (err.name === "ValidationError") {
        return { status: "failed", message: err.message };
    }

    if (err.name === "CastError") {
        return { status: "failed", message: "Invalid ID" };
    }

    if (err.code === 11000) {
        return { status: "failed", message: "Duplicate value already exists" };
    }

    if (err.statusCode) {
        return { status: "failed", message: err.message };
    }

    return { status: "failed", message: "Internal server error" };
};

const errorMiddleware = (err, req, res, _next) => {
    const statusCode = resolveStatusCode(err);

    const logContext = {
        err,
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
        statusCode,
    };


    if (statusCode >= 500) {
        logger.error(logContext, "Request failed");
    } else {
        logger.warn(logContext, "Request rejected");
    }

    return res.status(statusCode).json(resolveResponseBody(err));
};

module.exports = errorMiddleware;