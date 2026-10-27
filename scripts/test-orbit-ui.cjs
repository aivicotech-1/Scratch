const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('../scratch-editor/node_modules/playwright');
const root = path.resolve(__dirname, '..');
(async () => {
    process.env.TEMP = path.join(root, '.cache/temp');
    process.env.TMP = process.env.TEMP;
    const browser = await chromium.launch({
        executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true
    });
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.dismiss());
    const checks = [];
    try {
        await page.goto(process.env.SCRATCH_TEST_URL || 'http://localhost:8601');
        await page.locator('.blocklyToolboxCategory').filter({hasText: /^Motion$/}).click({timeout: 120000});
        await page.locator('.blocklyFlyout .blocklyBlockCanvas .blocklyDraggable').first().waitFor({state: 'visible'});
        assert.equal(await page.title(), 'Blocks Orbit');
        assert.equal(await page.locator('#logo_img').getAttribute('alt'), 'Blocks Orbit');
        assert((await page.locator('link[rel="shortcut icon"]').getAttribute('href')).startsWith('data:image/svg+xml,'));
        assert.equal(await page.locator('input[value="Blocks Orbit Project"]').count(), 1);
        checks.push('Blocks Orbit page title, logo, favicon and default project title');
        for (const viewport of [{width: 1440, height: 900}, {width: 1024, height: 768}]) {
            await page.setViewportSize(viewport);
            await page.waitForTimeout(400);
            for (const label of ['Code', 'Costumes', 'Sounds']) {
                const tab = page.getByRole('tab').filter({hasText: label});
                assert(await tab.isVisible(), label + ' tab remains available');
            }
            const bounds = await page.locator('#logo_img').boundingBox();
            assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= viewport.width);
            const headerOverflow = await page.locator('header').evaluate(el => el.scrollWidth > innerWidth + 1);
            assert.equal(headerOverflow, false, 'Header fits the viewport');
            await page.screenshot({path: path.join(root, 'research/validation/blocks-orbit-' + viewport.width + '.png')});
        }
        checks.push('Toolbar and tabs fit 1440px and 1024px desktop layouts');
        await page.setViewportSize({width: 1440, height: 900});
        await page.getByText('File', {exact: true}).click();
        assert(await page.getByText('Save to your computer', {exact: true}).isVisible());
        await page.getByText('File', {exact: true}).click();
        checks.push('File menu remains readable and accessible');
        await page.getByAltText('Enter full screen mode', {exact: true}).click();
        await page.getByAltText('Exit full screen mode', {exact: true}).waitFor({state: 'visible'});
        await page.getByAltText('Exit full screen mode', {exact: true}).click();
        await page.getByRole('tab').filter({hasText: 'Costumes'}).click();
        await page.waitForSelector('[class*="paint-editor"]');
        await page.screenshot({path: path.join(root, 'research/validation/blocks-orbit-costumes.png')});
        await page.getByRole('tab').filter({hasText: 'Code'}).click();
        checks.push('Fullscreen round trip and costume editor preserve their controls');
        await page.getByRole('button', {name: 'Choose a Sprite', exact: true}).first().click();
        await page.getByText('Abby', {exact: true}).waitFor({state: 'visible'});
        await page.waitForFunction(() => { const images = [...document.querySelectorAll('[class*="library-item_library-item_"] img')].slice(0, 16); return images.length >= 16 && images.every(img => img.complete && img.naturalWidth > 0); });
        await page.screenshot({path: path.join(root, 'research/validation/blocks-orbit-library.png')});
        checks.push('Sprite library remains available with the new modal styling');
        assert.deepEqual(errors, []);
        await fs.writeFile(path.join(root, 'research/validation/blocks-orbit-ui.json'),
            JSON.stringify({checks, pageErrors: errors}, null, 2) + '\n');
        console.log(JSON.stringify({checks, pageErrors: errors}, null, 2));
    } finally {
        await browser.close();
    }
})().catch(error => {console.error(error); process.exitCode = 1;});
