// node --version # Should be >= 18
// npm install @google/generative-ai


const {
    GoogleGenerativeAI,
  } = require("@google/generative-ai");
  
const MODEL_NAME = process.env.GEMINI_MODEL_NAME
const API_KEY = process.env.GEMINI_API_KEY;
;

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      resolve(body);
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });
const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
};

async function runChat(dialogs) {
  const message = dialogs.pop(1).parts;
  const chatSession = model.startChat({
    generationConfig,
    history: dialogs
  });
  console.log(message[0].text);
  const result = await chatSession.sendMessage(message[0].text);
  return result.response;
}

export default async function handler(req, res) {
  try {
    const requestBody = await readRequestBody(req);
    console.log("request body:", requestBody);
    const body = JSON.parse(requestBody);
    const response = await runChat(body.dialogs);
    const result = response.text();
    console.log("model response:", result);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      message:result
    }));
  } catch (err) {
    console.error('Error:', err);

    res.writeHead(500, { 'Content-Type': 'text/plain' });
    return res.end('Internal server error.\n');
  }
}