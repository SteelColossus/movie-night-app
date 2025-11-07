import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import importPlugin from 'eslint-plugin-import';
import nPlugin from 'eslint-plugin-n';
import promisePlugin from 'eslint-plugin-promise';
import globals from 'globals';

export default [
    // Base recommended rules
    js.configs.recommended,

    // Global ignores
    {
        ignores: [
            'node_modules/**',
            'built/**',
            'logs/**',
            'playwright-report/**',
            'test-results/**',
            '*.lockb',
            'client/views/external/**'
        ]
    },

    // Base configuration for all JavaScript files
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module'
        },
        plugins: {
            import: importPlugin,
            n: nPlugin,
            promise: promisePlugin,
            prettier: prettierPlugin
        }
    },

    // Server-side configuration
    {
        files: ['server/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.node
            }
        },
        rules: {
            'no-underscore-dangle': 'off'
        }
    },

    // Client-side configuration
    {
        files: ['client/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.jquery,
                io: 'readonly',
                Chart: 'readonly',
                ClientJS: 'readonly'
            }
        }
    },

    // Test configuration
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jasmine
            }
        }
    },

    // Prettier config (must be last to override formatting rules
    prettier
];
