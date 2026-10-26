const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const dir=path.join(root,'web/library-assets');
const names=new Set();
function walk(v){if(!v||typeof v!=='object')return;if(v.md5ext)names.add(v.md5ext);else if(v.assetId&&v.dataFormat)names.add(v.assetId+'.'+v.dataFormat);for(const x of Object.values(v))walk(x);}
(async()=>{
await fs.mkdir(dir,{recursive:true});
for(const name of ['sprites','costumes','sounds','backdrops'])walk(JSON.parse(await fs.readFile(path.join(root,'scratch-editor/packages/scratch-gui/src/lib/libraries',name+'.json'),'utf8')));
const pending=[...names];let done=0;const failures=[];
await Promise.all(Array.from({length:6},async()=>{
while(pending.length){const name=pending.pop();const dest=path.join(dir,name);let ok=false;
for(let retry=0;retry<3&&!ok;retry++){try{
let bytes;try{bytes=await fs.readFile(dest);}catch{}
if(!bytes){const response=await fetch('https://cdn.assets.scratch.mit.edu/internalapi/asset/'+name+'/get/',{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('HTTP '+response.status);bytes=Buffer.from(await response.arrayBuffer());}
if(crypto.createHash('md5').update(bytes).digest('hex')!==name.split('.')[0])throw Error('Asset hash mismatch: '+name);
await fs.writeFile(dest,bytes);ok=true;
}catch(e){if(retry===2)failures.push({name,error:e.message});}}
done++;if(done%100===0||done===names.size)console.log('Library assets '+done+'/'+names.size+'; failed '+failures.length);
}
}));
await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify({source:'https://cdn.assets.scratch.mit.edu',total:names.size,downloaded:names.size-failures.length,failures,verified:'MD5 content identifiers'},null,2));
if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
