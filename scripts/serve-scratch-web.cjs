const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const build = path.join(root, 'web/dist');
const assets = path.join(root, 'web/library-assets');
const port = Number(process.env.PORT || 8601);
const mime = {
 '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8', '.json':'application/json', '.map':'application/json',
 '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
 '.gif':'image/gif', '.wav':'audio/wav', '.mp3':'audio/mpeg', '.ogg':'audio/ogg',
 '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf',
 '.wasm':'application/wasm', '.ico':'image/x-icon'
};
function createServer() {
 return http.createServer(async (req, res) => {
  const fail = (status, message) => {res.writeHead(status, {'Content-Type':'text/plain'}); res.end(message);};
  if (!['GET','HEAD'].includes(req.method)) {res.setHeader('Allow','GET, HEAD'); return fail(405, 'Method not allowed');}
  let pathname;
  try {pathname = decodeURIComponent(req.url.split('?')[0]);} catch {return fail(400,'Invalid path');}
  if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').includes('..')) return fail(400,'Invalid path');
  if (pathname === '/healthz') {
   res.writeHead(200, {'Content-Type':'application/json', 'Cache-Control':'no-store'});
   return res.end(req.method === 'HEAD' ? undefined : JSON.stringify({app:'scratch-local-web', port}));
  }
  const match = /^\/internalapi\/asset\/([a-f0-9]{32}\.(?:svg|png|jpg|jpeg|gif|wav|mp3))\/get\/$/i.exec(pathname);
  const base = match ? assets : build;
  const file = path.resolve(base, match ? match[1] : '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(base + path.sep)) return fail(400,'Invalid path');
  try {
   const stat = await fs.promises.stat(file);
   if (!stat.isFile()) return fail(404,'Not found');
   res.writeHead(200, {'Content-Type':mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length':stat.size, 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-cache'});
   if (req.method === 'HEAD') return res.end();
   const stream = fs.createReadStream(file);
   stream.on('error', () => res.destroy());
   stream.pipe(res);
  } catch (err) {return fail(err.code === 'ENOENT' || err.code === 'ENOTDIR' ? 404 : 500, 'File unavailable');}
 });
}
if (require.main === module) {
 if (!fs.existsSync(path.join(build, 'index.html'))) {
  console.error('Build the website first: node scripts/build-scratch-web.cjs'); process.exit(1);
 }
 const server = createServer();
 server.on('error', error => {console.error(error.message); process.exitCode = 1;});
 server.listen(port, '127.0.0.1', () => console.log('Scratch: http://localhost:' + port));
}
module.exports = {createServer};
