const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      // Catch real bugs, not style preferences — this is CI, not a
      // formatter. Allow unused function args prefixed with _ (common
      // for Express middleware signatures like (err, req, res, next)
      // where not every param is used in every handler).
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": "warn", // logging should go through Pino, not console
    },
  },
  {
    ignores: ["node_modules/**", "coverage/**", "dist/**"],
  },
];