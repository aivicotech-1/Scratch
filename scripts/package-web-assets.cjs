const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'web/library-assets');
const output = path.join(root, 'web/dist');
const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
if (manifest.failures.length || manifest.total !== manifest.downloaded) throw new Error('Library asset download is incomplete');
if (!fs.existsSync(path.join(output, 'index.html'))) throw new Error('Build the editor before packaging assets');
const names = fs.readdirSync(source).filter(name => /^[a-f0-9]{32}\.[a-z0-9]+$/.test(name));
if (names.length !== manifest.total) throw new Error('Library asset count does not match the manifest');
fs.mkdirSync(path.join(output, 'library-assets'), {recursive: true});
for (const name of names) {
    const bytes = fs.readFileSync(path.join(source, name));
    if (crypto.createHash('md5').update(bytes).digest('hex') !== name.split('.')[0]) {
        throw new Error('Library asset checksum mismatch: ' + name);
    }
    fs.writeFileSync(path.join(output, 'library-assets', name), bytes);
}
for (const name of ['LICENSE', 'TRADEMARK', 'THIRD_PARTY_NOTICES.md']) {
    fs.copyFileSync(path.join(root, name), path.join(output, name));
}
fs.writeFileSync(path.join(output, 'SOURCE.txt'),
    'Website source and build instructions: https://github.com/aivicotech-1/Scratch\n' +
    'Includes the pinned Scratch editor submodule. Clone with --recurse-submodules.\n' +
    'Source license: AGPL-3.0-only. See LICENSE and THIRD_PARTY_NOTICES.md.\n');
console.log('Packaged ' + names.length + ' verified library assets and source/license notices');
