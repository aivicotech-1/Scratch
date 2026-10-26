const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('../scratch-editor/node_modules/playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
const reportName=process.env.SCRATCH_TEST_REPORT || 'scratch-web';
const baseUrl=process.env.SCRATCH_TEST_URL || 'http://localhost:8601';
process.env.TEMP=path.join(root,'.cache/temp');process.env.TMP=process.env.TEMP;
const app=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await app.newContext({viewport:{width:1350,height:900},acceptDownloads:true});
const page=await context.newPage();
const remoteAssets=[];const writes=[];page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
page.on('request',request=>{if(/^https:\/\/(?:cdn\.)?assets\.scratch\.mit\.edu\//.test(request.url()))remoteAssets.push(request.url());});
const checks=[];const errors=[];checks.push=(...items)=>{console.log('PASS:',...items);return Array.prototype.push.apply(checks,items);};
try{
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.type()==='confirm'?dialog.accept():dialog.dismiss());page.setDefaultTimeout(20000);
const clickFlyout=async label=>{
 const button=page.locator('.blocklyFlyoutButton').filter({hasText:label});
 await button.waitFor({state:'visible'});
 // Match the upstream integration helper's wait for continuous-toolbox scrolling.
 await page.waitForTimeout(700);
 let box=await button.boundingBox();
 for(let retry=0;retry<40&&(!box||box.y<0||box.y+box.height>await page.evaluate(()=>innerHeight));retry++){await page.waitForTimeout(100);box=await button.boundingBox();}
 assert(box&&box.y>=0&&box.y+box.height<page.viewportSize()?.height || box&&box.y>=0&&box.y<900,'Flyout button is onscreen');
 await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
};

await page.goto(baseUrl);
await page.waitForSelector('.blocklySvg',{timeout:180000});
await page.waitForFunction(()=>{
 for(const el of document.querySelectorAll('div')){
 const key=Object.keys(el).find(k=>k.startsWith('__reactFiber$'));let fiber=key&&el[key];
 while(fiber){const vm=fiber.memoizedProps?.vm;if(vm?.runtime?.targets?.length>=2){window.__testVM=vm;return true;}fiber=fiber.return;}
 }return false;
},{timeout:120000});
checks.push('Official editor loads with stage and sprite');
const cachedAsset=await page.evaluate(async()=>{
 const response=await fetch('/internalapi/asset/809d9b47347a6af2860e7a3a35bce057.svg/get/');
 return {ok:response.ok,url:response.url,body:await response.text()};
});
assert(cachedAsset.ok);assert(cachedAsset.body.includes('<svg'));assert(new URL(cachedAsset.url).origin===new URL(baseUrl).origin);
checks.push('Standard library assets load from verified local cache');
await page.getByRole('button',{name:'Choose a Sprite',exact:true}).first().click();
await page.getByText('Abby',{exact:true}).click();
await page.waitForFunction(()=>window.__testVM.runtime.targets.some(t=>t.getName()==='Abby'));
assert.equal(await page.evaluate(()=>window.__testVM.runtime.targets.find(t=>t.getName()==='Abby').getCostumes().length),4);
checks.push('Sprite library thumbnails and selected sprite assets load locally');


await page.locator('.blocklyToolboxCategory').filter({hasText:/^Variables$/}).click();
await clickFlyout('Make a Variable');
await page.locator('input[name="New variable name:"]').fill('score');
await page.getByRole('button',{name:'OK',exact:true}).click();
await clickFlyout('Make a List');
await page.locator('input[name="New list name:"]').fill('results');
await page.getByRole('button',{name:'OK',exact:true}).click();
const data=await page.evaluate(()=>Object.values(window.__testVM.runtime.getTargetForStage().variables).map(v=>({name:v.name,type:v.type})));
assert(data.some(v=>v.name==='score'&&v.type===''));assert(data.some(v=>v.name==='results'&&v.type==='list'));
checks.push('Create global variables and lists through the UI');
await page.locator('.blocklyToolboxCategory').filter({hasText:/^My Blocks$/}).click();
await clickFlyout('Make a Block');
await page.waitForSelector('[class*="custom-procedures"]');
await page.getByRole('button',{name:'Cancel',exact:true}).click();
checks.push('Custom block editor opens');
await page.getByText('Costumes',{exact:true}).first().click();
await page.waitForSelector('[class*="paint-editor"]');
checks.push('Costume paint editor loads');
await page.getByText('Sounds',{exact:true}).first().click();
await page.waitForSelector('[class*="sound-editor"]');
checks.push('Sound editor loads');
await page.getByText('Code',{exact:true}).first().click();
const fixture=await page.evaluate(async()=>{
 const vm=window.__testVM;const project=JSON.parse(vm.toJSON());const stage=project.targets.find(t=>t.isStage);const sprite=project.targets.find(t=>!t.isStage);
 stage.variables={score:['score',0]};stage.lists={results:['results',[]]};sprite.x=0;sprite.y=0;sprite.blocks={
 hat:{opcode:'event_whenflagclicked',next:'set',parent:null,inputs:{},fields:{},shadow:false,topLevel:true,x:50,y:50},
 set:{opcode:'data_setvariableto',next:'loop',parent:'hat',inputs:{VALUE:[1,[4,'0']]},fields:{VARIABLE:['score','score']},shadow:false,topLevel:false},
 loop:{opcode:'control_repeat',next:null,parent:'set',inputs:{TIMES:[1,[6,'3']],SUBSTACK:[2,'change']},fields:{},shadow:false,topLevel:false},
 change:{opcode:'data_changevariableby',next:'add',parent:'loop',inputs:{VALUE:[1,[4,'2']]},fields:{VARIABLE:['score','score']},shadow:false,topLevel:false},
 add:{opcode:'data_addtolist',next:'move',parent:'change',inputs:{ITEM:[1,[10,'working']]},fields:{LIST:['results','results']},shadow:false,topLevel:false},
 move:{opcode:'motion_movesteps',next:null,parent:'add',inputs:{STEPS:[1,[4,'10']]},fields:{},shadow:false,topLevel:false}
 };
 await vm.loadProject(JSON.stringify(project));const blob=await vm.saveProjectSb3();return Array.from(new Uint8Array(await blob.arrayBuffer()));
});
await fs.writeFile(path.join(root,'research/validation/scratch-roundtrip.sb3'),Buffer.from(fixture));
await page.evaluate(()=>window.__testVM.greenFlag());
await page.waitForFunction(()=>window.__testVM.runtime.getTargetForStage().variables.score.value===6);
const result=await page.evaluate(()=>({score:window.__testVM.runtime.getTargetForStage().variables.score.value,list:window.__testVM.runtime.getTargetForStage().variables.results.value,x:window.__testVM.runtime.targets.find(t=>!t.isStage).x}));
assert.equal(result.score,6);assert.equal(result.list.length,3);assert.equal(result.x,30);
checks.push('Real Scratch VM executes events, repeat, variables, lists and motion');
await page.evaluate(async bytes=>{await window.__testVM.loadProject(new Uint8Array(bytes));window.__testVM.greenFlag();},fixture);
await page.waitForFunction(()=>window.__testVM.runtime.getTargetForStage().variables.score.value===6);
checks.push('SB3 archive saves and reopens with working scripts and assets');
const downloadPromise=page.waitForEvent('download');
await page.getByText('File',{exact:true}).click();
await page.getByText('Save to your computer',{exact:true}).click();
const download=await downloadPromise;
const downloadPath=path.join(root,'research/validation/scratch-web-download.sb3');
await download.saveAs(downloadPath);
const saved=await fs.readFile(downloadPath);assert.equal(saved.subarray(0,2).toString(),'PK');
checks.push('File menu saves a native SB3 project to disk');
await page.evaluate(()=>{window.__testVM.runtime.getTargetForStage().variables.score.value=-1;});
await page.getByText('File',{exact:true}).click();
const chooser=page.waitForEvent('filechooser');
await page.getByText('Load from your computer',{exact:true}).click();
await (await chooser).setFiles(downloadPath);
await page.waitForFunction(()=>window.__testVM.runtime.getTargetForStage()?.variables?.score?.value===6);
checks.push('File menu reopens the saved SB3 project');

await page.mouse.click(1000,700);
assert.equal(await page.getByText('Could not create the project. Please try again!',{exact:true}).count(),0);
await page.getByText('File',{exact:true}).click();
await page.getByText('New',{exact:true}).click();
await page.waitForFunction(()=>window.__testVM.runtime.targets.length===2 && !window.__testVM.runtime.getTargetForStage().variables.score);
checks.push('File menu creates a fresh local project without a server account');
assert.deepEqual(writes,[],'Local editing never attempts server-side project creation');
await page.mouse.click(1000,700);

assert.deepEqual(remoteAssets,[],'No standard assets fetched from Scratch servers');
assert.deepEqual(errors,[],'No unhandled renderer errors');
await page.screenshot({path:path.join(root,'research/validation',reportName+'.png'),timeout:30000});
await fs.writeFile(path.join(root,'research/validation',reportName+'.json'),JSON.stringify({checks,result,pageErrors:errors},null,2));
console.log(JSON.stringify({checks,result,pageErrors:errors},null,2));
}catch(error){if(page){await fs.writeFile(path.join(root,'research/validation/scratch-failure.txt'),await page.locator('body').innerText().catch(()=>''));await page.screenshot({path:path.join(root,'research/validation/scratch-failure.png'),timeout:15000}).catch(()=>{});}console.error('Page errors:',errors,error);throw error;}finally{await app.close().catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});
