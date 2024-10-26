/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+.tsx?$": ["ts-jest",{}],
  },
  collectCoverageFrom: ['src/**/*.ts'],
  setupFiles: [
    "dotenv/config"
  ],
  testPathIgnorePatterns: [
    "node_modules",
    "out"
  ]
};