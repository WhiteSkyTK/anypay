import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import sonarjs from 'eslint-plugin-sonarjs'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  // shadcn/ui components are vendored code we copy in, not code we author.
  globalIgnores(['**/dist', '**/dev-dist', '**/coverage', 'apps/web/src/components/ui']),
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    // sonarjs mirrors the SonarCloud rules, so issues show up locally before CI.
    extends: [js.configs.recommended, sonarjs.configs.recommended],
    rules: {
      'sonarjs/cognitive-complexity': ['error', 15],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['apps/api/**/*.{ts,mjs}', 'packages/**/*.ts', 'apps/web/scripts/**', '*.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  prettier,
])
