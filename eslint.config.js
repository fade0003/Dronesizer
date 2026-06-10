import tseslint from 'typescript-eslint';

// SPEC §5: the repository boundary is sacred. Nothing outside src/db/ may
// import jsonStore (or reach around the repository into seed/restStore).
export default tseslint.config(
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/db/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/jsonStore',
                '**/jsonStore.*',
                '**/restStore',
                '**/restStore.*',
                '**/db/seed/*',
              ],
              message:
                'Repository boundary (SPEC §5): everything outside src/db/ must go through src/db/repository.ts.',
            },
          ],
        },
      ],
    },
  },
);
