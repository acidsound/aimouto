const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 간단한 정적 파일 서버
function startServer(port = 3000) {
  const server = http.createServer((req, res) => {
    const filePath = req.url === '/' ? '/index.html' : req.url;
    const fullPath = path.join(__dirname, filePath);
    
    fs.readFile(fullPath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      
      const ext = path.extname(fullPath);
      const contentType = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.vrm': 'application/octet-stream'
      }[ext] || 'application/octet-stream';
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
  
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
      resolve(server);
    });
  });
}

async function captureScreenshot() {
  console.log('Starting server...');
  const server = await startServer(3000);
  
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  console.log('Loading page...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  
  // VRM 모델 로딩 대기
  console.log('Waiting for VRM model to load...');
  await page.waitForTimeout(5000);
  
  console.log('Capturing screenshot...');
  
  // 데스크톱 스크린샷
  await page.screenshot({
    path: 'screenshot-desktop.png',
    fullPage: false
  });
  
  // 모바일 Portrait 모드 스크린샷
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: 'screenshot-mobile.png',
    fullPage: false
  });
  
  // 태블릿 Landscape 모드 스크린샷
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: 'screenshot-tablet.png',
    fullPage: false
  });
  
  console.log('Screenshots captured:');
  console.log('  - screenshot-desktop.png (1920x1080)');
  console.log('  - screenshot-mobile.png (375x812)');
  console.log('  - screenshot-tablet.png (1024x768)');
  
  await browser.close();
  server.close();
  console.log('Done!');
}

captureScreenshot().catch(console.error);
