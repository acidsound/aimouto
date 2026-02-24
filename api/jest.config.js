module.exports = {
  setupFilesAfterEnv: ['./genkit.js'],
  transform: {
    '^.+\.js
: 'babel-jest',
  },
};
