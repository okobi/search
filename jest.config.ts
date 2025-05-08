import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node', // Changed from 'jsdom' to 'node' for server-side testing
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  roots: ['<rootDir>/tests'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }], // Transform TypeScript files
  },
  transformIgnorePatterns: [
    '/node_modules/(?!jose|next-auth)/', // Transform jose and next-auth, ignore others
  ],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' }, // Optional: if using @/ alias
};

export default config;