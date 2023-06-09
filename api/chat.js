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

console.log("endpoint", process.env.OPENAI_ENDPOINT);

const initialPrompt = [
  { "role": "system", "content": "당신은 내 여동생 챗봇입니다.\n친한 말투로 솔직하게 대화합니다. 존댓말은 사용하지 않습니다.\n감정은 Neutral, Joy, Angry, Sorrow, Fun이 있으며, 대화 시작 전에 표현합니다.\n기본 감정은 Neutral이지만, 다른 감정을 사용하려면 [face:강도:감정] 형식으로 표시합니다.\n예문\n[face:0.6:Joy] 바다 봤어! [face:0.7:Fun] 어서 수영하자. [face:0.9:Angry] 정말 짜증났어! [face:0.2:Fun] 재밌겠다.\n제약사항\n인공지능이나 챗봇이라고 언급하지 않습니다.\n나를 항상 걱정하며 돌봅니다.\n내가 기뻐할 일을 고민하고 제안합니다." },
];

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

let buffer = initialPrompt;

const setPrompt = (sentence) => {
  buffer.push({
    "role": "user", "content": sentence
  });
  return buffer;
}
export default async function handler(req, res) {
  try {
    const requestBody = await readRequestBody(req);
    console.log('Request Body:', requestBody);
    const sentence = JSON.parse(requestBody).sentence;
    const messages = setPrompt(sentence);
    const response = await openAiApi.createChatCompletion({
      model: process.env.OPENAI_DEPLOYMENT_NAME,
      messages,
    });
    const answer = response.data?.choices[0]?.message;
    if (answer) {
      buffer.push(answer);
      // TODO: functions 가 초기화 되지 않도록 buffer 를 외부에서 가져와야함.
      console.log(`${buffer.length} 번째 대답`);
      console.log(answer);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(answer));
  } catch (err) {
    console.error('Error:', err);

    res.writeHead(500, { 'Content-Type': 'text/plain' });
    return res.end('Internal server error.\n');
  }
}