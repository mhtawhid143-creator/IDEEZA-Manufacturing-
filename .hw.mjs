import { readFileSync, writeFileSync } from 'node:fs';
const path = 'tools/verify-manufacturer-app.mjs';
let s = readFileSync(path, 'utf8');
const from = `      await page.waitForURL(/\/tutorial\/code-tech\//, { timeout: 20_000 }).catch(() => undefined);
      check('pressing it opens the first lesson', /\/tutorial\/code-tech\//.test(page.url()), page.url());
      check(
        'the lesson is on the page',
        await visible(page.getByRole('heading', { name: 'Introduction', level: 1 })),
      );`;
const to = `      // A category has no page of its own; it redirects to its first lesson,
      // and the App Router does that as a client navigation rather than an
      // HTTP redirect. So the wait is for the lesson's own heading — the thing
      // a reader is actually waiting for — and the address is asserted after.
      const arrived = await page
        .getByRole('heading', { name: 'Introduction', level: 1 })
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => true)
        .catch(() => false);
      check('the lesson is on the page', arrived);
      check(
        'pressing a category opens its first lesson',
        /\/tutorial\/code-tech\//.test(page.url()),
        page.url(),
      );`;
if (!s.includes(from)) throw new Error('anchor missing');
writeFileSync(path, s.replace(from, to));
console.log('harness waits for the words, not the address');
