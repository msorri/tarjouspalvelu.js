module.exports = {
    root: true,
    env: {
        node: true,
    },
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended",
        "prettier",
        "prettier/@typescript-eslint",
    ],
    "overrides": [
        {
            "files": ["*.js", "*.jsx"],
            "rules": {
                "@typescript-eslint/no-var-requires": "off",
            }
        }
    ]
};
