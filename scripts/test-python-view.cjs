const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('../scratch-editor/node_modules/playwright');
(async () => {
    const root = path.resolve(__dirname, '..');
    process.env.TEMP = process.env.TMP = path.join(root, '.cache/temp');
    const browser = await chromium.launch({executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true});
    const context = await browser.newContext({viewport: {width: 1440, height: 900}, permissions: ['clipboard-read', 'clipboard-write']});
    const page = await context.newPage();
    const errors = [], checks = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.dismiss());
    const check = message => { checks.push(message); console.log('PASS:', message); };
    try {
        await page.goto(process.env.SCRATCH_TEST_URL || 'http://localhost:8601');
        await page.getByRole('button', {name: 'Both', exact: true}).waitFor({timeout: 180000});
        await page.waitForFunction(() => {
            for (const el of document.querySelectorAll('div')) {
                let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber$'))];
                while (fiber) {
                    if (fiber.memoizedProps?.vm?.runtime?.targets?.length >= 2) window.testVM = fiber.memoizedProps.vm;
                    if (fiber.stateNode?.workspace?.getAllBlocks && !fiber.stateNode.workspace.isFlyout) window.testWorkspace = fiber.stateNode.workspace;
                    fiber = fiber.return;
                }
            }
            return window.testVM && window.testWorkspace;
        });
        await page.getByRole('button', {name: 'Python code', exact: true}).click();
        await page.waitForFunction(() => document.querySelector('.orbit-python-pane pre')?.textContent.includes('No scripts yet'));
        assert(!(await page.locator('.orbit-block-pane').isVisible()));
        check('Python-only view replaces blocks and shows an empty-state explanation');
        await page.getByRole('button', {name: 'Blocks', exact: true}).click();
        await page.locator('.blocklyToolboxCategory').filter({hasText: /^Motion$/}).click();
        await page.waitForTimeout(800);
        const source = await page.evaluate(() => {
            const pane = document.querySelector('.orbit-block-pane').getBoundingClientRect();
            return [...document.querySelectorAll('.blocklyFlyout .blocklyDraggable')]
                .map(el => el.getBoundingClientRect().toJSON())
                .filter(r => r.y > pane.y + 10 && r.y + r.height < pane.bottom && r.width > 70 && r.height > 25)
                .sort((a, b) => a.y - b.y)[0];
        });
        const pane = await page.locator('.orbit-block-pane').boundingBox();
        assert(source && pane);
        await page.mouse.move(source.x + 30, source.y + 15);
        await page.mouse.down();
        await page.mouse.move(source.x + 40, source.y + 25, {steps: 5});
        await page.mouse.move(pane.x + pane.width - 180, pane.y + 140, {steps: 30});
        await page.mouse.up();
        await page.waitForFunction(() => window.testWorkspace.getAllBlocks(false).some(b => b.type === 'motion_movesteps'));
        await page.getByRole('button', {name: 'Both', exact: true}).click();
        await page.waitForFunction(() => document.querySelector('.orbit-python-pane pre')?.textContent.includes('sprite.move(10)'));
        assert(await page.locator('.orbit-block-pane').isVisible());
        check('Dragging a real Motion block produces Python in Both view');
        await page.evaluate(() => {
            const move = window.testWorkspace.getAllBlocks(false).find(b => b.type === 'motion_movesteps');
            move.getInput('STEPS').connection.targetBlock().setFieldValue('25', 'NUM');
        });
        await page.waitForFunction(() => document.querySelector('.orbit-python-pane pre')?.textContent.includes('sprite.move(25)'));
        check('Changing a block input updates Python live');
        await page.evaluate(() => window.testWorkspace.getAllBlocks(false).find(b => b.type === 'motion_movesteps').dispose(false));
        await page.waitForFunction(() => document.querySelector('.orbit-python-pane pre')?.textContent.includes('No scripts yet'));
        await page.evaluate(() => window.testWorkspace.undo(false));
        await page.waitForFunction(() => document.querySelector('.orbit-python-pane pre')?.textContent.includes('sprite.move(25)'));
        check('Deleting and undoing blocks updates the preview');
        await page.evaluate(async () => {
            const vm = window.testVM, project = JSON.parse(vm.toJSON());
            const sprite = project.targets.find(t => !t.isStage);
            sprite.blocks = {
                flag: {opcode:'event_whenflagclicked',next:'loop',parent:null,inputs:{},fields:{},topLevel:true,shadow:false,x:400,y:90},
                loop: {opcode:'control_repeat',next:null,parent:'flag',inputs:{TIMES:[1,[6,'3']],SUBSTACK:[2,'move']},fields:{},shadow:false},
                move: {opcode:'motion_movesteps',next:'say',parent:'loop',inputs:{STEPS:[1,[4,'10']]},fields:{},shadow:false},
                say: {opcode:'looks_say',next:null,parent:'move',inputs:{MESSAGE:[1,[10,'Hello, Python!']]},fields:{},shadow:false}
            };
            await vm.loadProject(JSON.stringify(project));
        });
        await page.waitForFunction(() => document.querySelector('.orbit-python-pane pre')?.textContent.includes('for _ in range'));
        const before = await page.evaluate(() => window.testVM.toJSON());
        await page.getByRole('button', {name: 'Copy code', exact: true}).click();
        await page.getByRole('status').filter({hasText: 'Copied'}).waitFor();
        assert((await page.evaluate(() => navigator.clipboard.readText())).includes('sprite.say("Hello, Python!")'));
        for (const name of ['Python code', 'Blocks', 'Both']) await page.getByRole('button', {name, exact: true}).click();
        assert.equal(await page.evaluate(() => window.testVM.toJSON()), before, 'View switching must not modify a project');
        check('Nested scripts, clipboard copy, and mode switching preserve the project');
        for (const width of [1440, 1024, 731]) {
            await page.setViewportSize({width, height: width === 731 ? 580 : 900});
            await page.waitForTimeout(600);
            const blocks = await page.locator('.orbit-block-pane').boundingBox(), python = await page.locator('.orbit-python-pane').boundingBox();
            assert(blocks.width > 200 && blocks.height > 140 && python.width > 200 && python.height > 140);
            assert(width === 1440 ? python.x >= blocks.x + blocks.width - 2 : python.y >= blocks.y + blocks.height - 2);
                        await page.getByRole('button', {name:'Fit blocks',exact:true}).click();
            await page.waitForTimeout(200);
            const fit = await page.evaluate(() => {
                const ws = window.testWorkspace;
                const rect = ws.getTopBlocks(false)[0].getSvgRoot().getBoundingClientRect();
                const pane = document.querySelector('.orbit-block-pane').getBoundingClientRect();
                const palette = document.querySelector('.blocklyFlyout').getBoundingClientRect();
                return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,
                    paletteRight:palette.right,paneRight:pane.right,paneTop:pane.top,paneBottom:pane.bottom,
                    documentWidth:document.documentElement.scrollWidth,windowWidth:innerWidth};
            });
            assert(fit.left >= fit.paletteRight - 2, 'Script stays clear of palette at ' + width);
            assert(fit.right <= fit.paneRight + 2 && fit.top >= fit.paneTop - 2 && fit.bottom <= fit.paneBottom + 2,
                'Whole script fits after resize at ' + width);
            if (width === 731) {
                assert(fit.documentWidth <= fit.windowWidth + 1, 'Narrow Both view has no horizontal page overflow');
                const stage = await page.locator('[class*="gui_stage-and-target-wrapper_"]').boundingBox();
                assert(stage.y >= python.y + python.height - 2, 'Stage is below the editor');
            }
            await page.screenshot({path: path.join(root, 'research/validation/python-both-' + width + '.png')});
        }
        check('Both view is side by side on desktop and stacked on smaller screens');
        await page.setViewportSize({width:1440,height:900});
        const spriteId = await page.evaluate(() => window.testVM.editingTarget.id);
        await page.evaluate(() => window.testVM.setEditingTarget(window.testVM.runtime.getTargetForStage().id));
        await page.waitForFunction(() => document.querySelector('.orbit-python-heading strong')?.textContent === 'Stage');
        assert((await page.locator('.orbit-python-pane pre').innerText()).includes('No scripts yet'));
        await page.evaluate(id => window.testVM.setEditingTarget(id), spriteId);
        await page.waitForFunction(() => document.querySelector('.orbit-python-pane pre')?.textContent.includes('sprite.move(10)'));
        check('Selected sprite and stage each show their own scripts');
        await page.getByRole('tab').filter({hasText:'Costumes'}).click();
        await page.waitForSelector('[class*="paint-editor"]');
        assert(!(await page.locator('.orbit-python-pane').isVisible()));
        await page.getByRole('tab').filter({hasText:/^Code$/}).click();
        await page.getByRole('button', {name:'Python code',exact:true}).click();
        await page.evaluate(() => { window.startX=window.testVM.editingTarget.x; window.testVM.greenFlag(); });
        await page.waitForFunction(() => window.testVM.editingTarget.x === window.startX + 30);
        check('Costume tabs remain separate and green flag still executes blocks in Python view');
        assert.deepEqual(errors, []);
        await fs.writeFile(path.join(root, 'research/validation/python-view.json'), JSON.stringify({checks, errors}, null, 2));
    } catch (error) { await page.screenshot({path: path.join(root, "research/validation/python-error.png")}); console.log(await page.evaluate(() => ({vmBlocks: window.testVM?.editingTarget.blocks._blocks, blockTypes: window.testWorkspace?.getAllBlocks(false).map(b => b.type), workspace: document.querySelector(".orbit-block-pane")?.getBoundingClientRect().toJSON(), flyout: document.querySelector(".blocklyFlyout")?.getBoundingClientRect().toJSON()}))); throw error; } finally { await browser.close(); }
})().catch(e => {console.error(e); process.exitCode=1;});
