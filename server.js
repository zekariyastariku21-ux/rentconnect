const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const authApp = express();
authApp.use('/api/auth', require('./auth-routes'));
authApp.use('/api/listings', require('./listings-routes'));
authApp.use('/api', require('./admin-routes'));

const hasCustomPort = Boolean(process.env.PORT);
let port = hasCustomPort ? Number(process.env.PORT) : 3000;
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be an integer between 1 and 65535.');
  process.exit(1);
}
const publicDir = path.join(__dirname, 'public');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) return authApp(req, res);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
    res.end('Method not allowed');
    return;
  }

  let requestPath;
  try {
    requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request');
    return;
  }

  if (requestPath === '/') requestPath = '/rent.html';
  if (requestPath === '/rent.html') requestPath = '/index.html';
  const filePath = path.resolve(publicDir, `.${requestPath}`);
  if (filePath !== publicDir && !filePath.startsWith(`${publicDir}${path.sep}`)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Server error');
        return;
      }

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(req.method === 'HEAD' ? undefined : content);
    });
  });
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE' && !hasCustomPort && port < 65535) {
    const unavailablePort = port;
    port += 1;
    console.warn(`Port ${unavailablePort} is already in use; trying port ${port}.`);
    server.listen(port);
    return;
  }

  console.error(`Unable to start RentConnect server: ${error.message}`);
  process.exitCode = 1;
});

server.on('listening', () => {
  const address = server.address();
  const listeningPort = typeof address === 'object' && address ? address.port : port;
  console.log(`RentConnect server running at http://localhost:${listeningPort}`);
});

server.listen(port);


