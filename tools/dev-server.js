import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookup as lookupMime } from './mime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const options = { port: 4173, host: '0.0.0.0' };
  for (const arg of argv) {
    if (arg.startsWith('--port=')) {
      const value = Number.parseInt(arg.split('=')[1], 10);
      if (!Number.isNaN(value)) options.port = value;
    } else if (arg === '--host' || arg.startsWith('--host=')) {
      const value = arg.includes('=') ? arg.split('=')[1] : argv[argv.indexOf(arg) + 1];
      if (value) options.host = value;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }
  return options;
}

function send(res, statusCode, headers, body) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

function normaliseUrl(urlPath) {
  try {
    const decoded = decodeURIComponent(urlPath.split('?')[0]);
    if (decoded.includes('..')) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function readFileSafe(filePath) {
  return fs.promises.readFile(filePath);
}

async function createHandler(rootDir) {
  const indexPath = path.join(rootDir, 'index.html');
  const indexExists = fs.existsSync(indexPath);

  return async (req, res) => {
    const urlPath = normaliseUrl(req.url || '/');
    if (!urlPath) {
      send(res, 400, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Solicitud inválida');
      return;
    }

    let requestPath = urlPath;
    if (requestPath.endsWith('/')) {
      requestPath = requestPath + 'index.html';
    }

    const absolutePath = path.join(rootDir, requestPath);

    try {
      const stat = await fs.promises.stat(absolutePath);
      if (stat.isDirectory()) {
        return send(res, 403, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Directorio no accesible');
      }
      const mimeType = lookupMime(path.extname(absolutePath)) || 'application/octet-stream';
      const data = await readFileSafe(absolutePath);
      send(res, 200, { 'Content-Type': mimeType }, data);
    } catch (error) {
      if (indexExists) {
        try {
          const fallback = await readFileSafe(indexPath);
          send(res, 200, { 'Content-Type': 'text/html; charset=utf-8' }, fallback);
          return;
        } catch {
          // fall through
        }
      }
      send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Recurso no encontrado');
    }
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log('Uso: npm run dev [-- --port=4173 --host=127.0.0.1]');
    process.exit(0);
  }

  const handler = await createHandler(projectRoot);
  const server = http.createServer(handler);

  server.listen(options.port, options.host, () => {
    const host = options.host === '0.0.0.0' ? 'localhost' : options.host;
    console.log(`Servidor listo en http://${host}:${options.port}`);
    console.log('Pulsa Ctrl+C para detenerlo.');
  });

  const shutdown = () => {
    console.log('\nCerrando servidor...');
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('No se pudo iniciar el servidor:', error);
  process.exit(1);
});
