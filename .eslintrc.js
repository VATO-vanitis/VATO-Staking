/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ["next/core-web-vitals"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "prefer-const": "off",
    "@typescript-eslint/no-unused-vars": "warn",
    "@next/next/no-img-element": "off",
    "react-hooks/exhaustive-deps": "warn"
  }
};
