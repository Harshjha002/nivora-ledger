const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const swaggerUiDist = require("swagger-ui-dist");
const swaggerSpec = require("./config/swagger");
const pinoHttp = require("pino-http");
const logger = require("./config/logger");
const mongoose = require("mongoose");
const authRouter = require("./routes/auth.route");
const accountRouter = require("./routes/account.route");
const transactionRoutes = require("./routes/transaction.route");
const errorMiddleware = require("./middleware/error.middleware");

const app = express();

app.use(
    pinoHttp({
        logger,
        serializers: {
            req(req) {
                return {
                    id: req.id,
                    method: req.method,
                    url: req.url,
                    remoteAddress: req.remoteAddress,
                };
            },
            res(res) {
                return {
                    statusCode: res.statusCode,
                };
            },
        },
    })
);

app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "script-src": ["'self'", "'unsafe-inline'"],
                "style-src": ["'self'", "'unsafe-inline'"],
                "img-src": ["'self'", "data:"],
            },
        },
    })
);

app.use(
    cors({
        origin: process.env.CLIENT_URL,
        credentials: true,
    }),
);

app.get("/health/live", (req, res) => {
    return res.status(200).json({
        status: "success",
        message: "Nivora Ledger API is alive",
    });
});

app.get("/health/ready", (req, res) => {
    const isDatabaseReady =
        mongoose.connection.readyState === 1;

    if (!isDatabaseReady) {
        return res.status(503).json({
            status: "failed",
            message: "Nivora Ledger API is not ready",
        });
    }

    return res.status(200).json({
        status: "success",
        message: "Nivora Ledger API is ready",
    });
});

app.get("/health", (req, res) => {
    return res.status(200).json({
        status: "success",
        message: "Nivora Ledger API is running",
    });
});

app.use("/v1/api/auth", authRouter);
app.use("/v1/api/account", accountRouter);
app.use("/v1/api/transaction", transactionRoutes);

/*
 * Swagger UI
 */

const swaggerDistPath = swaggerUiDist.getAbsoluteFSPath();

app.get(["/api-docs", "/api-docs/"], (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1.0"
                />
                <title>Nivora Ledger API Docs</title>

                <link
                    rel="stylesheet"
                    href="/api-docs/swagger-ui.css"
                />
            </head>

            <body>
                <div id="swagger-ui"></div>

                <script src="/api-docs/swagger-ui-bundle.js"></script>
                <script src="/api-docs/swagger-ui-standalone-preset.js"></script>

                <script>
                    window.onload = () => {
                        window.ui = SwaggerUIBundle({
                            spec: ${JSON.stringify(swaggerSpec)},
                            dom_id: "#swagger-ui",
                            deepLinking: true,
                            presets: [
                                SwaggerUIBundle.presets.apis,
                                SwaggerUIStandalonePreset
                            ],
                            layout: "StandaloneLayout"
                        });
                    };
                </script>
            </body>
        </html>
    `);
});

/*
 * Serve Swagger assets with explicit MIME types
 */

app.get("/api-docs/swagger-ui.css", (req, res) => {
    res.setHeader(
        "Content-Type",
        "text/css; charset=utf-8"
    );

    return res.sendFile(
        path.join(swaggerDistPath, "swagger-ui.css")
    );
});

app.get("/api-docs/swagger-ui-bundle.js", (req, res) => {
    res.setHeader(
        "Content-Type",
        "application/javascript; charset=utf-8"
    );

    return res.sendFile(
        path.join(swaggerDistPath, "swagger-ui-bundle.js")
    );
});

app.get("/api-docs/swagger-ui-standalone-preset.js", (req, res) => {
    res.setHeader(
        "Content-Type",
        "application/javascript; charset=utf-8"
    );

    return res.sendFile(
        path.join(
            swaggerDistPath,
            "swagger-ui-standalone-preset.js"
        )
    );
});

app.use((req, res) => {
    return res.status(404).json({
        status: "failed",
        message: "Route not found",
    });
});

app.use(errorMiddleware);

module.exports = app;