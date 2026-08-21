const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  globalIgnores([".expo/**", "dist/**", "coverage/**", "android/**", "ios/**", "node_modules/**"]),
  expoConfig,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
]);
