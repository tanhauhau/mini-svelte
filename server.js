import appComponent from './ssr.js';
import { createServer } from 'node:http';

const server = createServer((req, res) => {
  res.write(appComponent());
  res.end();
});
server.listen(8000);

