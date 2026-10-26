const assert=require('node:assert/strict');
const http=require('node:http');
const {createServer}=require('./serve-scratch-web.cjs');
(async()=>{
 const server=createServer();
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 const request=(path,method='GET')=>new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port,path,method},res=>{
   const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks)}));
  });req.on('error',reject);req.end();
 });
 try {
  assert.equal((await request('/')).status,200);
  assert.equal((await request('/gui.js','HEAD')).body.length,0);
  assert.equal((await request('/gui.js','HEAD')).status,200);
  assert.equal((await request('/','POST')).status,405);
  for(const p of ['/../README.md','/%2e%2e/README.md','/..%5cREADME.md','/%00'])assert.equal((await request(p)).status,400,p);
  for(const p of ['/README.md','/scripts/serve-scratch-web.cjs','/internalapi/asset/manifest.json','/missing.js'])assert.equal((await request(p)).status,404,p);
  const asset=await request('/internalapi/asset/809d9b47347a6af2860e7a3a35bce057.svg/get/');
  assert.equal(asset.status,200);assert.match(asset.body.toString(),/<svg/);
  console.log('PASS: index, HEAD, local assets, method restrictions and workspace isolation');
 } finally {await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
