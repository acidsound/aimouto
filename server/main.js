const http = require('http');

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

const server = http.createServer(async (req, res) => {
  try {
    // 비동기 처리를 위해 'await'를 사용합니다.
    const requestBody = await readRequestBody(req);
    console.log('Request Body:', requestBody);

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
