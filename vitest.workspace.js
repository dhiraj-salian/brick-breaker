export default [
  {
    test: {
      name: 'unit',
      include: ['tests/unit/**/*.{test,spec}.js'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'worker',
      include: ['tests/worker/**/*.{test,spec}.js'],
    },
  },
];
