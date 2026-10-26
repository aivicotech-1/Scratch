const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const env = {...process.env, NODE_ENV: 'production'};
if (Number(process.versions.node.split('.')[0]) !== 24) {
    throw new Error('Build with Node.js 24.x, matching package.json and Vercel settings.');
}
for (const name of ['build-scratch.cjs', 'cache-scratch-library.cjs', 'package-web-assets.cjs']) {
    const result = spawnSync(process.execPath, [path.join(__dirname, name)], {cwd: root, env, stdio: 'inherit'});
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Vercel static website ready in web/dist');
