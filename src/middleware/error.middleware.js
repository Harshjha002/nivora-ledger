const logger = require("../config/logger");

const errorMiddleware = (err, req, res, _next) => {
    const statusCode = err.statusCode || 500;

    logger.error(
        {
            err,
            requestId: req.id,
            method: req.method,
            url: req.originalUrl,
            statusCode,
        },
        "Request failed"
    );

    // Mongoose validation error
    if (err.name === "ValidationError") {
        return res.status(400).json({
            status: "failed",
            message: err.message,
        });
    }

    // Invalid MongoDB ObjectId
    if (err.name === "CastError") {
        return res.status(400).json({
            status: "failed",
            message: "Invalid ID",
        });
    }

    // MongoDB duplicate key
    if (err.code === 11000) {
        return res.status(409).json({
            status: "failed",
            message: "Duplicate value already exists",
        });
    }

    // Custom ApiError
    if (err.statusCode) {
        return res.status(err.statusCode).json({
            status: "failed",
            message: err.message,
        });
    }

    // Unknown/unexpected error
    return res.status(500).json({
        status: "failed",
        message: "Internal server error",
    });
};

module.exports = errorMiddleware;