import { configure } from '@genkit-ai/core';
import { googleAI } from '@genkit-ai/googleai';

configure({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY,
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
