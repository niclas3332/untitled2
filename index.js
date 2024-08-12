const assert = require('node:assert');
const { chromium, devices } = require('playwright');

(async () => {
    // Setup
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // The actual interesting bit
    await context.route('**.jpg', route => route.abort());
    await page.goto('http://sportshub:Dontbeadick!@sportshub.hopto.org/SHUB/fixtures/creator/tools/fixtureschannel/live.php');

    await page.screenshot({ path: 'screenshot.png' });


    // Teardown
    await context.close();
    await browser.close();
})();