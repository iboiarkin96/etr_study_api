// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '.vite', 'storybook-static'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  // Storybook config files (.storybook/*) and story modules (*.stories.tsx)
  // aren't part of the app HMR graph, so the fast-refresh rule doesn't
  // apply — it only exists to keep dev-server hot reloading fast.
  {
    files: ['.storybook/**/*.{ts,tsx}', 'src/**/*.stories.@(ts|tsx)'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  storybook.configs['flat/recommended'],
);
