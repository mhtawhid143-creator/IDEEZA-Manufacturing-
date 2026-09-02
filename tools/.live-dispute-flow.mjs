/**
 * Raise a real dispute on the live site, the way the product raises one.
 *
 * There is no other route: a dispute comes out of a buyer's refund claim that
 * the shop challenges, and neither panel can invent one on its own. So this
 * walks both — the buyer claims on a delivered order, the shop answers with a
 * dispute — and leaves the platform in a state it could have reached by itself.
 *
 * A delivered order rather than the one in production: that one is the whole
 * production-tracking demo and a status cannot be walked back. There are two
 * delivered orders, so one is left untouched.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const token = new URL(readFileSync(process.argv[2], 'utf8').trim()).searchParams.get('token');
const shopSite = 'https://ideeza-manufacturer-panel.vercel.app';
const buyerSite = 'https://ideeza-buyer-panel.vercel.app';
const enter = (site) => `${site}/auth/enter?token=${String(token)}`;

const browser = await chromium.launch();

const open = async () => {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1300 } })).newPage();
  page.on('pageerror', (error) => console.log('pageerror: ' + String(error).slice(0, 150)));
  return page;
};

/** *.vercel.app is intermittently unreachable from here; retry rather than fail. */
const reach = async (page, url) => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
      return true;
    } catch {
      await page.waitForTimeout(3_000);
    }
  }
  return false;
};

try {
  // ── the buyer claims ─────────────────────────────────────────────────────
  const buyer = await open();
  if (!(await reach(buyer, enter(buyerSite)))) throw new Error('the buyer panel is unreachable');
  // The buyer lists orders as cards rather than a table, and the delivered one
  // is known: it is the order the shop side shows as delivered and is not the
  // production-tracking demo.
  const orderPath = '/manufacturing/orders/demo_order_payloadbay';
  console.log('claiming on: ' + orderPath);

  if (!(await reach(buyer, `${buyerSite}${orderPath}/refund`))) {
    throw new Error('the refund form is unreachable');
  }
  await buyer.waitForTimeout(1_000);

  const already = (await buyer.locator('main').innerText()).replace(/\s+/g, ' ');
  if (/already/i.test(already) && /claim/i.test(already)) {
    console.log('a claim is already open on it');
  } else {
    await buyer.locator('select').first().selectOption({ index: 3 });
    await buyer.waitForTimeout(300);
    const amount = buyer.getByLabel('Amount');
    if ((await amount.count()) > 0) await amount.fill('180.00');
    await buyer
      .getByLabel('Description')
      .fill(
        'The boards carry revision C on the silkscreen. The requirements we sent, and the specification the quote was accepted against, are revision D — the change was the connector footprint, and D is what our enclosure is cut for. The boards look well made; we cannot use them in this enclosure.',
      );
    // A claim is decided on the record, so the form refuses one with nothing
    // attached. The file sent with the request is what there is.
    const record = buyer.getByRole('checkbox').first();
    if ((await record.count()) > 0) await record.check();
    await buyer.getByRole('button', { name: 'Request refund', exact: true }).click();
    await buyer.waitForTimeout(4_000);
    console.log('claim sent: ' + (await buyer.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 120));
  }

  // ── the shop answers with a dispute ──────────────────────────────────────
  const shop = await open();
  if (!(await reach(shop, enter(shopSite)))) throw new Error('the shop panel is unreachable');
  const orderId = orderPath.split('/').pop() ?? '';
  if (!(await reach(shop, `${shopSite}/orders/${orderId}`))) {
    throw new Error('the shop order page is unreachable');
  }
  await shop.waitForTimeout(1_500);

  const dispute = shop.getByRole('button', { name: 'Dispute' }).first();
  if ((await dispute.count()) === 0) {
    console.log('shop order page: ' + (await shop.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 200));
    throw new Error('no Dispute button on the shop order page');
  }
  await dispute.click();
  const form = shop.getByRole('dialog').first();
  await form.waitFor({ timeout: 30_000 });
  await form.getByLabel(/Amount you would accept/).fill('0.00');
  await form
    .getByLabel('What happened')
    .fill(
      'The revision on the accepted specification is the one we built. Our records show revision C was current when the quote was accepted and the change to D reached us after the panels were pressed. We have attached the accepted specification and the assembly drawing we worked from, and we would rather agree a rework than argue about whose drawing was current.',
    );
  await form.getByRole('button', { name: /Submit dispute/ }).click();
  await form.waitFor({ state: 'detached', timeout: 40_000 }).catch(() => {});
  await shop.waitForTimeout(4_000);

  // ── what the shop sees now ───────────────────────────────────────────────
  await reach(shop, `${shopSite}/dashboard`);
  await shop.waitForTimeout(1_200);
  const dash = (await shop.locator('main').innerText()).replace(/\s+/g, ' ');
  console.log('dashboard: ' + (/dispute is open|disputes are open/i.test(dash) ? 'banner shown' : 'NO BANNER'));
  await shop.screenshot({ path: `${process.argv[3]}/live-dis-dashboard.png`, fullPage: true });

  await reach(shop, `${shopSite}/orders?status=disputed`);
  await shop.waitForTimeout(1_200);
  const list = (await shop.locator('tbody').innerText().catch(() => '')).replace(/\s+/g, ' ');
  console.log('orders filtered by Disputed: ' + (await shop.locator('tbody tr').count()) + ' rows');
  console.log('row says: ' + (/Dispute open/.test(list) ? 'Dispute open' : 'no badge'));
  await shop.screenshot({ path: `${process.argv[3]}/live-dis-orders.png`, fullPage: true });

  await reach(shop, `${shopSite}/settings`);
  await shop.getByRole('button', { name: 'Dispute', exact: true }).click();
  await shop.waitForTimeout(900);
  const pane = (await shop.locator('main').innerText()).replace(/\s+/g, ' ');
  console.log('settings: ' + pane.slice(pane.indexOf('Open disputes'), pane.indexOf('Open disputes') + 90));
  await shop.screenshot({ path: `${process.argv[3]}/live-dis-settings.png`, fullPage: true });
} catch (error) {
  console.log('FAILED: ' + String(error).split('\n')[0]);
}

await browser.close();
