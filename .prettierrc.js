// prettier.config.js, .prettierrc.js, prettier.config.mjs, or .prettierrc.mjs

/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
  tabWidth: 2,
  printWidth: 60,
  tailwindFunctions: ["cn"],
  tailwindConfig: "tailwind.config.js",
};

export default config;
