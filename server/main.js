const http = require('http');
require('dotenv').config();

const { Configuration, OpenAIApi } = require("azure-openai");

const openAiApi = new OpenAIApi(
  new Configuration({
    // add azure info into configuration
    azure: {
      apiKey: process.env.OPENAI_API_KEY,
      endpoint: process.env.OPENAI_ENDPOINT,
    }
  }),
);


const initialPrompt = [
  { "role": "system", "content": "당신은 내 여동생 챗봇입니다.\n친한 말투로 솔직하게 대화합니다. 존댓말은 사용하지 않습니다.\n감정은 Neutral, Joy, Angry, Sorrow, Fun이 있으며, 대화 시작 전에 표현합니다.\n기본 감정은 Neutral이지만, 다른 감정을 사용하려면 [face:강도:감정] 형식으로 표시합니다.\n예문\n[face:0.6:Joy] 바다 봤어! [face:0.7:Fun] 어서 수영하자. [face:0.9:Angry] 정말 짜증났어! [face:0.2:Fun] 재밌겠다.\n제약사항\n인공지능이나 챗봇이라고 언급하지 않습니다.\n나를 항상 걱정하며 돌봅니다.\n내가 기뻐할 일을 고민하고 제안합니다." },
  // {"role":"user","content":"다녀왔어"},
  // {"role":"assistant","content":"[face:0.6:Joy] 어디 다녀왔어? 재미있는 일 있었어?"}
];

/*
curl https://yyyy.openai.azure.com/openai/deployments/xxxx/chat/completions?api-version=2023-03-15-preview \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR_API_KEY" \
  -d '{
  "messages": "[
    {\"role\":\"system\",\"content\":\"당신은 내 여동생 챗봇입니다.\n친한 말투로 솔직하게 대화합니다. 존댓말은 사용하지 않습니다.\n감정은 Neutral, Joy, Angry, Sorrow, Fun이 있으며, 대화 시작 전에 표현합니다.\n기본 감정은 Neutral이지만, 다른 감정을 사용하려면 [face:강도:감정] 형식으로 표시합니다.\n예문\n[face:0.6:Joy] 바다 봤어! [face:0.7:Fun] 어서 수영하자. [face:0.9:Angry] 정말 짜증났어! [face:0.2:Fun] 재밌겠다.\n제약사항\n인공지능이나 챗봇이라고 언급하지 않습니다.\n나를 항상 걱정하며 돌봅니다.\n내가 기뻐할 일을 고민하고 제안합니다.\"},
    {\"role\":\"user\",\"content\":\"다녀왔어\"},
    {\"role\":\"assistant\",\"content\":\"[face:0.6:Joy] 어디 다녀왔어? 재미있는 일 있었어?\"}
  ]",
  "max_tokens": 800,
  "temperature": 0.7,
  "frequency_penalty": 0,
  "presence_penalty": 0,
  "top_p": 0.95,
  "stop": null
}'
*/

// Promise를 반환하는 함수를 정의합니다.
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

let buffer = [];
const setPrompt = (sentence) => {
  buffer.push({
    "role": "user", "content": sentence
  });
  return buffer;
}
const server = http.createServer(async (req, res) => {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    // 브라우저의 CORS 프리플라이트 요청 처리
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.url === "/clear") {
    buffer = initialPrompt;
    return;
  }
  try {
    const requestBody = await readRequestBody(req);
    console.log('Request Body:', requestBody);
    const sentence = JSON.parse(requestBody).sentence;
    const response = await openAiApi.createCompletion({
      model: process.env.OPENAI_DEPLOYMENT_NAME,
      prompt: JSON.stringify(setPrompt(sentence)),
      maxTokens: 100,
      temperature: 0.9,
      topP: 1,
      presencePenalty: 0,
      frequencyPenalty: 0,
      bestOf: 1,
    });
    console.log('Response:', response);

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Received request body.\n');
  } catch (err) {
    console.error('Error:', err);

    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal server error.\n');
  }
});

const port = 8080;
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
