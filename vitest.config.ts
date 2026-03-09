import { defineConfig } from 'vitest/config';
import path from 'path';

const alias = {
  '@agents': path.resolve(__dirname, 'src/agents'),
  '@pipeline': path.resolve(__dirname, 'src/pipeline'),
  '@evaluate': path.resolve(__dirname, 'src/evaluate'),
  '@metrics': path.resolve(__dirname, 'src/metrics'),
  '@types': path.resolve(__dirname, 'src/types'),
  '@config': path.resolve(__dirname, 'src/config'),
  '@utils': path.resolve(__dirname, 'src/utils'),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'evals',
          include: ['tests/evals/**/*.eval.ts'],
          testTimeout: 60000,
        },
      },
    ],
  },
});
