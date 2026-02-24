const { configure } = require('@genkit-ai/core');
const { googleAI } = require('@genkit-ai/googleai');
const { runFlow } = require('@genkit-ai/flow');
const { aimoutoFlow } = require('./chat.js');

beforeAll(() => {
  configure({
    plugins: [
      googleAI({
        apiKey: process.env.GEMINI_API_KEY,
      }),
    ],
    logLevel: 'debug',
    enableTracingAndMetrics: true,
  });
});

describe('aimoutoFlow', () => {
  it('should return a response', async () => {
    const response = await runFlow(aimoutoFlow, '안녕');
    console.log(response);
    expect(response).toBeDefined();
  });
});
