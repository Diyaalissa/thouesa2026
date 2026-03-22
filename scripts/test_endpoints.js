const http = require('http');

const paths = ['/', '/client', '/gate77', '/status', '/api/health'];
const port = 3000;

async function test() {
  for (const path of paths) {
    try {
      const res = await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}${path}`, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => resolve({ statusCode: res.statusCode, data: data.slice(0, 50) }));
        });
        req.on('error', reject);
        req.setTimeout(2000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      console.log(`Path: ${path} | Status: ${res.statusCode} | Data: ${res.data}...`);
    } catch (err) {
      console.log(`Path: ${path} | Error: ${err.message}`);
    }
  }
}

test();
