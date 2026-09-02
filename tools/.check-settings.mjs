/**
 * Does the live settings screen show the ten panes, and do they write?
 *
 * Fresh browser, the review link as a reviewer opens it.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const url = readFileSync(process.argv[2], 'utf8').trim();
const site = url.split('/auth/')[0];
const out = process.argv[3];
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1200 } })).newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error).slice(0, 170)));

try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.goto(`${site}/settings`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForTimeout(1500);

  for (const [label, heading, file] of [
    ['Profile', 'My Profile', 'profile'],
    ['Security', 'Security Information', 'security'],
    ['KYC Verification', 'KYC Verification', 'kyc'],
    ['Get Paid', 'Get Paid', 'paid'],
    ['Notification', 'Notification Settings', 'notification'],
    ['Language', 'Language Settings', 'language'],
    ['Policy & Privacy', 'Privacy', 'policy'],
    ['Activity', 'Activity', 'activity'],
  ]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForTimeout(600);
    const shown = await page
      .getByRole('heading', { name: heading, exact: true })
      .first()
      .isVisible()
      .catch(() => false);
    console.log(`${label.padEnd(18)}: ${shown ? 'ok' : 'MISSING'}`);
    if (file === 'paid' || file === 'security') {
      await page.screenshot({ path: `${out}/live-set-${file}.png`, fullPage: true });
    }
  }

  // And one write, end to end, on the live database.
  await page.getByRole('button', { name: 'Language', exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByLabel('Account Language').selectOption('bn-BD');
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Language', exact: true }).click();
  await page.waitForTimeout(700);
  const kept = (await page.getByLabel('Account Language').inputValue()) === 'bn-BD';
  console.log(`a choice survives a reload live: ${kept ? 'ok' : 'NO'}`);
  await page.getByLabel('Account Language').selectOption('en-US');
  await page.waitForTimeout(2000);

  console.log('errors: ' + (errors.length === 0 ? 'none' : errors[0]));
} catch (error) {
  console.log('FAILED: ' + String(error).split('\n')[0]);
}
await browser.close();
