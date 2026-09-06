import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Flat ESLint config.
 *
 * The goal is useful correctness checking, not rule count. We take the
 * recommended sets plus type-aware rules (which is where the real value is for a
 * TypeScript codebase), then let `eslint-config-prettier` switch off everything
 * stylistic so formatting stays Prettier's job alone.
 */
export default tseslint.config(
  {
    // The preserved Python implementation and build output are never linted.
    // Build output, the preserved Python implementation, and the standalone
    // asset generator, which is a Node script outside the app's tsconfig program.
    ignores: ['dist/**', 'coverage/**', 'legacy/**', 'tools/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        // The flat config itself is plain JS and is not part of tsconfig's
        // program, so it is type-checked against the default project.
        projectService: {
          allowDefaultProject: ['eslint.config.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Surface unfinished work rather than letting it sink into the codebase.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // An unused argument is usually a mistake; an intentional one is named `_`.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  {
    // Config files run in Node, not the browser.
    files: ['*.config.js', '*.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },

  prettier,
);
