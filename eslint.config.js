import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
// 👇 新增：引入 Prettier 插件
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    // 👇 插件里加入 prettier
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      prettier, // 👈 新增
    },
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // 👇 新增：关闭冲突规则 + 启用 Prettier
      prettierConfig,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // 👇 强制 Prettier 作为 ESLint 规则（核心！）
      'prettier/prettier': 'error',

      // 原来的规则
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
]);
