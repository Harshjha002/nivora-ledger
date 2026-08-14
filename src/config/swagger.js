const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const filePath = path.join(__dirname, "../docs/openapi.yaml");

const file = fs.readFileSync(filePath, "utf8");

const swaggerSpec = YAML.parse(file);

module.exports = swaggerSpec;