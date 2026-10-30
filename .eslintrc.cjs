/* The `lint` script in package.json predates this file -- without a
   config ESLint errored out instead of running, which meant every
   `// eslint-disable-next-line react-hooks/exhaustive-deps` in the
   codebase was inert and the hooks rules never actually ran.
   Legacy (.eslintrc) format rather than flat config: ESLint 8 is what's
   pinned here, and flat config isn't the default until v9. */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
  ],
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  settings: { react: { version: "18.2" } },
  plugins: ["react-refresh"],
  rules: {
    /* The codebase leans on prop-types-free function components. */
    "react/prop-types": "off",
    /* Intentional throughout: empty catch blocks around audio, clipboard
       and storage calls that are all deliberately best-effort. */
    "no-empty": ["error", { allowEmptyCatch: true }],
    /* Off deliberately, not as a shortcut: this app renders a lot of
       prose with apostrophes ("Time's up.", "That's all"). Escaping
       every one to &apos; would churn ~20 files and make the copy harder
       to read, for no correctness or rendering benefit -- JSX text
       handles them fine. */
    "react/no-unescaped-entities": "off",
    /* PixelAvatar exports its palettes beside the component, pieceSets
       exports both the list and a getter. That co-location is the
       established pattern here (see DESIGN_PRINCIPLES.md), and the only
       cost is a slightly less granular HMR boundary. */
    "react-refresh/only-export-components": "off",
  },
  overrides: [
    {
      files: ["**/*.test.js", "**/*.test.jsx"],
      env: { node: true },
      globals: { describe: "readonly", it: "readonly", expect: "readonly", vi: "readonly" },
    },
  ],
};
