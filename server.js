import { createServer } from 'node:http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { buildAppAndSsr } from './index.js';

buildAppAndSsr();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/app.js') {
    const appJsContent = fs.readFileSync(
      path.join(fileURLToPath(import.meta.url), '../app.js'),
      'utf-8'
    );
    res.setHeader('Content-Type', 'text/javascript');
    res.write(appJsContent);
    res.end();
    return;
  }

  // dynamically import the ssr code
  const appComponent = (await import('./ssr.js?t=' + Date.now())).default;
  res.write(
    `<html>
    <body>
      <div id="app">${appComponent()}</div>
      <script type="module">
        import App from './app.js';
        const container = document.querySelector('#app');

        let app = App();
        app.create(container);

        const ws = new WebSocket('ws://localhost:8080');
        ws.addEventListener('message', () => {
          import('./app.js?t=' + Date.now()).then(newModule => {
            const App = newModule.default;
            const restored_state = app.capture_state();
            app.destroy(container);
            app = App({ restored_state });
            app.create(container, false);
          })
        });
      </script>
    </body>
  </html>`
  );
  res.end();
});
server.listen(8000);

const webSockets = [];
const wss = new WebSocketServer({ port: 8080 });
wss.on('connection', function connection(ws) {
  webSockets.push(ws);
  ws.on('error', console.error);
  ws.on('close', () => {
    webSockets.splice(webSockets.indexOf(ws), 1);
  });
});

fs.watchFile(
  path.join(fileURLToPath(import.meta.url), '../app.svelte'),
  { interval: 0 },
  () => {
    buildAppAndSsr();
    for (const ws of webSockets) {
      ws.send('something has changed');
    }
  }
);
