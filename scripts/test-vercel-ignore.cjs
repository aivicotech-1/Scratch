const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const ignore = require('../scratch-editor/node_modules/ignore');
const root = path.resolve(__dirname, '..');
const rules = ignore().add(fs.readFileSync(path.join(root, '.vercelignore'), 'utf8'));
for (const name of ['eye-dropper', 'fill-tool', 'oval-tool', 'rect-tool', 'rounded-rect-tool', 'text-tool']) {
    const file = 'scratch-editor/packages/scratch-paint/src/helper/tools/' + name + '.js';
    assert(fs.existsSync(path.join(root, file)), 'Missing source: ' + file);
    assert.equal(rules.ignores(file), false, 'Required paint tool excluded: ' + file);
}
const upstream = execFileSync('git', ['ls-files', '-z'], {
    cwd: path.join(root, 'scratch-editor'), encoding: 'utf8'
}).split('\0').filter(Boolean);
const sourceFiles = upstream.filter(file => /^(?:packages\/[^/]+\/src|scripts)\//.test(file));
const excluded = sourceFiles.filter(file => rules.ignores('scratch-editor/' + file));
assert.deepEqual(excluded, [], 'Tracked upstream source must not be excluded');
for (const file of ['tools/node-v24.22.1/node.exe', '.cache/temp/file', '.vercel/auth.json',
    '.env', '.env.production', 'scratch-editor/.env.local', 'credentials.pem',
    'node_modules/example/index.js', 'scratch-editor/node_modules/example/index.js']) {
    assert.equal(rules.ignores(file), true, 'Local/private file not excluded: ' + file);
}
console.log('PASS: all six paint tools and ' + sourceFiles.length +
    ' tracked upstream source files are retained; private/local files remain excluded');
