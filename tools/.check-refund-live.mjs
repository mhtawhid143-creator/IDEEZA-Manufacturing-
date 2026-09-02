import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const url = readFileSync(process.argv[2], 'utf8').trim();
const site = url.split('/auth/')[0];
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1200 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
const reach = async (u) => { for (let i=0;i<12;i++){ try { await page.goto(u,{waitUntil:'networkidle',timeout:60000}); return true; } catch { await page.waitForTimeout(3000); } } return false; };
await reach(url);
await reach(`${site}/orders?status=refund_requested`);
await page.waitForTimeout(1200);
const rows = await page.locator('tbody tr').count();
console.log('refund_requested orders: ' + rows);
if (rows > 0) {
  const href = await page.locator('tbody tr').first().getByRole('link').first().getAttribute('href');
  await reach(`${site}${href}`);
  await page.waitForTimeout(1200);
  const body = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  console.log('banner: ' + body.slice(body.indexOf('CLAIM-'), body.indexOf('CLAIM-') + 200));
  const approve = page.getByRole('button', { name: 'Approve' });
  if ((await approve.count()) > 0) {
    await approve.click();
    const form = page.getByRole('dialog', { name: /Refund Request/ });
    await form.waitFor({ timeout: 30000 });
    console.log('form labels: ' + JSON.stringify(await form.locator('label').allInnerTexts()));
    console.log('give refund disabled at first: ' + await form.getByRole('button', { name: 'Give refund' }).isDisabled());
    await page.screenshot({ path: process.argv[3] + '/live-refund-form.png' });
  } else {
    console.log('already answered: ' + (/You have answered/.test(body) ? 'yes' : 'no'));
  }
}
console.log('errors: ' + (errors.length === 0 ? 'none' : errors[0]));
await browser.close();
