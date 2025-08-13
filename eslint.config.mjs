// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.recommended,
    {
        languageOptions: {
            globals: {
                "logger": "writable"
            }
        }
    },
    {
        "rules": {
            "no-trailing-spaces": [
                "warn",
                {
                    "ignoreComments": true,
                    "skipBlankLines": true
                }
            ],
            "prefer-const": "off",
            "prefer-spread": "off",
            "no-dupe-class-members": "off",
            "space-before-function-paren": "off",
            "@typescript-eslint/no-duplicate-enum-values": "warn",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    "argsIgnorePattern": "."
                }
            ]
        }
    }
);