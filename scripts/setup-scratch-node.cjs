const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
(async()=>{
const version=fs.readFileSync('scratch-editor/.nvmrc','utf8').trim();if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid Node version');
const folder=path.resolve('tools','node-v'+version),url='https://nodejs.org/dist/v'+version+'/';
fs.mkdirSync(folder,{recursive:true});
const sums=await fetch(url+'SHASUMS256.txt').then(r=>{if(!r.ok)throw Error(r.status);return r.text();});
const expected=sums.split('\n').find(line=>line.trim().endsWith('win-x64/node.exe'))?.split(/\s+/)[0];if(!expected)throw Error('Node executable checksum missing');
const response=await fetch(url+'win-x64/node.exe');if(!response.ok)throw Error(response.status);
const bytes=Buffer.from(await response.arrayBuffer()),actual=crypto.createHash('sha256').update(bytes).digest('hex');if(actual!==expected)throw Error('Checksum mismatch');
fs.writeFileSync(path.join(folder,'node.exe'),bytes);fs.writeFileSync(path.join(folder,'provenance.json'),JSON.stringify({version,url:url+'win-x64/node.exe',sha256:actual},null,2));
console.log(JSON.stringify({version,path:folder,bytes:bytes.length,checksumVerified:true}));
})().catch(e=>{console.error(e);process.exit(1);});
