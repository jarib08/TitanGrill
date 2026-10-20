import https from 'https';

const agent = new https.Agent({ rejectUnauthorized: false });

const routes = ['/', '/menu', '/login', '/pos', '/admin'];

async function testRoute(route) {
  return new Promise((resolve) => {
    const req = https.get(`https://localhost:5173${route}`, { agent }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          route,
          status: res.statusCode,
          hasAppRoot: data.includes('id="root"'),
          title: data.match(/<title>(.*?)<\/title>/)?.[1] || 'No title',
          length: data.length
        });
      });
    });
    req.on('error', (err) => {
      resolve({ route, error: err.message });
    });
  });
}

async function run() {
  console.log('Testing Vite routes on https://localhost:5173...');
  for (const r of routes) {
    const result = await testRoute(r);
    console.log(JSON.stringify(result));
  }
}

run();
