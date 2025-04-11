module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  overrides: [
    {
      files: ['src/**/*.ts'],
      rules: {
        // using rest parameters can lead to problems on ES5 targets
        'prefer-rest-params': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
      },
    },
  ],
};
