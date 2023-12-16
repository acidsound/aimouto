// node --version # Should be >= 18
// npm install @google/generative-ai


const {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
  } = require("@google/generative-ai");
  
const MODEL_NAME = "gemini-pro";
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
  temperature: 0.9,
  topK: 1,
  topP: 1,
  maxOutputTokens: 2048,
};
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

async function runChat(dialogs) {
  const message = dialogs.pop(1).parts;
  const chat = model.startChat({
    generationConfig,
    safetySettings,
    history: dialogs
  });

  console.log(message[0].text);

  const result = await chat.sendMessage(message[0].text);
  // const response = await result.response;
  return result.response;
}

export default async function handler(req, res) {
  try {
    const requestBody = await readRequestBody(req);
    console.log('Request Body:', requestBody);
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