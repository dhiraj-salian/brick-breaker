import globals from 'globals';

export default [
  {
    files: ['src/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
      },
    },
    rules: {
      // Errors, not warnings — so `npm run lint` fails on unused vars.
      // 'no-unused-vars' is configured to ignore:
      //   - names prefixed with `_` (intentional "ignore me")
      //   - unused catch parameters (caughtErrors: 'none')
      //     so `catch (e) { /* swallow */ }` doesn't fail
      //   - argsAfterThis in class methods
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          caughtErrors: 'none',
          args: 'after-used',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];
