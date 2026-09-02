/**
 * Fill the live shop's settings, through the panel's own forms.
 *
 * A deploy applies migrations, it does not seed, and re-seeding would undo
 * whatever a reviewer had changed. So a payout method, the tax details and a
 * submitted identity check go in the way a shop puts them in.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const url = readFileSync(process.argv[2], 'utf8').trim();
const site = url.split('/auth/')[0];
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1200 } })).newPage();
page.on('pageerror', (error) => console.log('pageerror: ' + String(error).slice(0, 170)));

const pane = async (label) => {
  await page.goto(`${site}/settings`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(1200);
};

try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 });

  // ── the person's name ────────────────────────────────────────────────────
  await pane('Profile');
  if ((await page.getByLabel('First Name').inputValue()) === '') {
    await page.getByLabel('First Name').fill('PrecisionCircuit');
    await page.getByLabel('Last Name').fill('Operator');
    await page.getByRole('button', { name: 'Update' }).click();
    await page.waitForTimeout(2500);
    console.log('name: set');
  } else {
    console.log('name: already set');
  }

  // ── a picture ────────────────────────────────────────────────────────────
  await pane('Profile');
  await page.getByRole('button', { name: 'Choose Picture' }).click();
  const avatar = page.getByRole('dialog', { name: 'Upload Profile Picture' });
  await avatar.waitFor({ timeout: 30_000 });
  await avatar.getByRole('radio', { name: 'Dusk' }).click();
  await avatar.getByRole('button', { name: 'Update' }).click();
  await avatar.waitFor({ state: 'detached', timeout: 40_000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log('picture: set');

  // ── a payout method ──────────────────────────────────────────────────────
  await pane('Get Paid');
  if ((await page.locator('main').innerText()).includes('No payout method yet')) {
    await page.getByRole('button', { name: 'Add method' }).click();
    const form = page.getByRole('dialog', { name: 'Add method' });
    await form.waitFor({ timeout: 30_000 });
    await form.getByLabel('Name on the account').fill('PrecisionCircuit Manufacturing Ltd.');
    await form.getByLabel('Account number').fill('4321876500991234');
    await form.getByLabel('Bank name').fill('Bank of China');
    await form.getByLabel('Bank country').selectOption('CN');
    await form.getByLabel('Label').fill('Operating account');
    await form.getByRole('button', { name: 'Add', exact: true }).click();
    await form.waitFor({ state: 'detached', timeout: 40_000 }).catch(() => {});
    await page.waitForTimeout(2500);
    console.log('payout method: added');
  } else {
    console.log('payout method: already there');
  }

  // ── tax residence and number ─────────────────────────────────────────────
  await pane('Get Paid');
  await page.getByRole('button', { name: 'Tax Residence' }).click();
  const residence = page.getByRole('dialog', { name: 'Tax Residence' });
  await residence.waitFor({ timeout: 30_000 });
  await residence.getByLabel('Country of tax residence').selectOption('CN');
  await residence.getByRole('button', { name: 'Save' }).click();
  await residence.waitFor({ state: 'detached', timeout: 40_000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log('tax residence: set');

  await pane('Get Paid');
  await page.getByRole('button', { name: 'Tax Identification' }).click();
  const taxId = page.getByRole('dialog', { name: /Tax Identification/ });
  await taxId.waitFor({ timeout: 30_000 });
  await taxId.getByLabel('Number').fill('91440300MA5EX1234');
  await taxId.getByRole('button', { name: 'Save' }).click();
  await taxId.waitFor({ state: 'detached', timeout: 40_000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log('tax number: set');

  // ── the identity check, submitted ────────────────────────────────────────
  await pane('KYC Verification');
  if ((await page.locator('main').innerText()).includes('Not Submitted')) {
    await page.getByLabel('Full Legal Name').fill('PrecisionCircuit Manufacturing Ltd.');
    await page.getByLabel('Mobile Number').fill('+8675583992200');
    await page.getByLabel('Country of Residence').selectOption('CN');
    await page.getByLabel(/Marketplace Seller Terms/).check();
    await page.getByRole('button', { name: 'Submit for Review' }).click();
    await page.waitForTimeout(3000);
    console.log('kyc: submitted');
  } else {
    console.log('kyc: already submitted');
  }

  // ── a couple of notification choices, so the pane is not all defaults ────
  await pane('Notification');
  const topics = page.getByRole('group', { name: 'Notification topics' });
  await topics.getByRole('button', { name: /^Blog/ }).first().click();
  await page.waitForTimeout(500);
  const mobile = page.getByRole('switch', { name: 'Blog by Mobile Application' });
  if ((await mobile.count()) === 1 && (await mobile.getAttribute('aria-checked')) === 'true') {
    await mobile.click();
    await page.waitForTimeout(2500);
    console.log('notification: one choice made');
  }

  // ── what it looks like now ───────────────────────────────────────────────
  for (const [label, file] of [
    ['Get Paid', 'paid'],
    ['KYC Verification', 'kyc'],
    ['Profile', 'profile'],
  ]) {
    await pane(label);
    await page.screenshot({ path: `${process.argv[3]}/live-final-${file}.png`, fullPage: true });
    const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    console.log(`${label}: ${text.slice(text.indexOf('Dispute') + 8, text.indexOf('Dispute') + 150)}`);
  }
} catch (error) {
  console.log('FAILED: ' + String(error).split('\n')[0]);
}

await browser.close();
