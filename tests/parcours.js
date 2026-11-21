/*
  Tests de parcours de l'Atelier de planètes, dans un vrai navigateur (Chromium piloté par Playwright).

    npm install          (une fois ; puis « npx playwright install chromium » si aucun Chromium n'est présent)
    npm test             (parcours complet)
    npm run test:rapide  (chargement et vue du système, sans descente)

  Sans carte graphique, le rendu logiciel est lent : le parcours complet (atterrissage, vaisseau, redécollage,
  système, voyage) prend quelques minutes. THREE_JS=/chemin/three.min.js sert three.js r128 depuis un fichier
  local quand le CDN n'est pas joignable.
*/
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(process.env.PAGE_FILE || path.join(__dirname, '..', 'index.html'));
const QUICK = process.argv.includes('--rapide'); // loading and the system view only, without the descent
const LONG = 600000; // a software-rendered descent can take minutes
let failed = 0, passed = 0;

function check(name, ok, detail) {
  if (ok) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  ÉCHEC ' + name + (detail !== undefined ? ' : ' + JSON.stringify(detail) : '')); }
}

async function open(browser, opts) {
  const ctx = await browser.newContext(opts);
  if (process.env.THREE_JS) {
    const body = fs.readFileSync(process.env.THREE_JS);
    await ctx.route('https://cdnjs.cloudflare.com/**', (r) => r.fulfill({ body, contentType: 'application/javascript' }));
  }
  await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(PAGE);
  await page.waitForFunction(() => !document.querySelector('.booting'), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}

const helpKeys = (page) => page.evaluate(() => [...document.querySelectorAll('#help-keys dt')].map((d) => [...d.querySelectorAll('kbd')].map((k) => k.textContent).join(' ')));
const press = (page, code, key) => page.evaluate(([code, key]) => window.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true })), [code, key]);
const release = (page, code, key) => page.evaluate(([code, key]) => window.dispatchEvent(new KeyboardEvent('keyup', { code, key, bubbles: true })), [code, key]);
const shown = (page, id) => page.evaluate((id) => !document.getElementById(id).hidden, id);

async function testLayouts(browser) {
  console.log('Chargement, bureau et téléphone');
  for (const opts of [{ viewport: { width: 1280, height: 800 } }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]) {
    const { ctx, page, errors } = await open(browser, opts);
    const w = opts.viewport.width;
    check(w + ' px : aucune erreur au chargement', errors.length === 0, errors);
    check(w + ' px : la scène est prête', await page.evaluate(() => document.getElementById('fallback').hidden));
    check(w + ' px : pas de défilement horizontal', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    check(w + ' px : titre d\'onglet avec le nom du monde', /Veloria-4/.test(await page.title()));
    await ctx.close();
  }
}

/* the world card must not hide the labels of the other worlds when there is room elsewhere */
async function checkWorldCards(page, tag) {
  await page.click('#b-system');
  await page.waitForFunction(() => !document.getElementById('syslabels').hidden, null, { timeout: LONG });
  // wait for the camera to settle: the labels stop sliding across the screen
  let last = '';
  for (let k = 0; k < 120; k++) {
    await page.waitForTimeout(500);
    const now = await page.evaluate(() => [...document.querySelectorAll('#syslabels button')].map((b) => b.style.transform.replace(/\.\d+/g, '')).join());
    if (now === last) break; last = now;
  }
  const n = await page.locator('#syslabels button').count();
  check(tag + 'six étiquettes dans le système', n === 6, n);
  let worst = 0, most = 0, total = 0;
  for (let i = 0; i < n; i++) {
    // the labels follow their planets, so the pointer goes to where the label is now, as a hand would
    await page.mouse.move(5, 5); await page.waitForTimeout(500);
    const box = await page.locator('#syslabels button').nth(i).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    await page.waitForTimeout(600);
    const r = await page.evaluate((i) => {
      const card = document.getElementById('worldcard').getBoundingClientRect();
      const btns = [...document.querySelectorAll('#syslabels button')];
      const ov = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const others = btns.filter((b, j) => j !== i && b.style.visibility !== 'hidden').map((b) => b.getBoundingClientRect());
      // a label is masked when the card sits on its centre: the pointer would land on the card instead
      const masked = others.filter((b) => { const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2; return cx > card.left && cx < card.right && cy > card.top && cy < card.bottom; }).length;
      return { open: !document.getElementById('worldcard').hidden && document.getElementById('wc-name').textContent === btns[i].querySelector('span').textContent, masked, own: ov(card, btns[i].getBoundingClientRect()) };
    }, i);
    if (!r.open) { check(tag + 'fiche ouverte au survol du monde ' + i, false); continue; }
    worst = Math.max(worst, r.own);
    most = Math.max(most, r.masked); total += r.masked;
  }
  check(tag + 'aucune fiche ne recouvre sa propre étiquette', worst === 0, worst);
  // the card stays beside its label, so in a crowded view it may still sit on one neighbour, never on several
  check(tag + 'aucune fiche ne masque plus d\'une étiquette voisine', most <= 1, { most, total });
  console.log('       (étiquettes masquées, toutes fiches confondues : ' + total + ')');
}

async function testJourney(browser, locale) {
  console.log('Parcours complet (' + locale + ')');
  const { ctx, page, errors } = await open(browser, { viewport: { width: 960, height: 600 }, locale });
  await checkWorldCards(page, 'système : ');
  await page.click('#sysback');
  await page.waitForFunction(() => !document.getElementById('controls').hidden, null, { timeout: LONG });

  // landing
  await page.click('#land');
  await page.waitForFunction(() => !document.getElementById('surface').hidden, null, { timeout: LONG });
  check('posé au sol : réglages masqués, carte de surface affichée', !(await shown(page, 'controls')) && await shown(page, 'surface'));

  // the help names the movement keys of the keyboard the viewer actually types on
  await page.keyboard.press('?');
  check('aide ouverte au sol', await shown(page, 'help'));
  const first = await helpKeys(page);
  check('l\'aide au sol liste avancer et pas de côté', first.some((k) => /↑ ↓/.test(k)) && first.length >= 6, first);
  await press(page, 'KeyW', 'z'); await press(page, 'KeyA', 'q'); await release(page, 'KeyW', 'z'); await release(page, 'KeyA', 'q');
  let keys = await helpKeys(page);
  check('clavier AZERTY : l\'aide montre Z S et Q D', keys.includes('↑ ↓ Z S') && keys.includes('Q D'), keys);
  check('clavier AZERTY : la consigne dit ZQSD', /ZQSD/.test(await page.textContent('#how')));
  await press(page, 'KeyW', 'w'); await press(page, 'KeyA', 'a'); await release(page, 'KeyW', 'w'); await release(page, 'KeyA', 'a');
  keys = await helpKeys(page);
  check('clavier QWERTY : l\'aide montre W S et A D', keys.includes('↑ ↓ W S') && keys.includes('A D'), keys);
  check('clavier QWERTY : la consigne dit WASD', /WASD/.test(await page.textContent('#how')));
  await page.keyboard.press('Escape');
  check('Échap ferme l\'aide', !(await shown(page, 'help')));

  // walk, fly, take off
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowUp');
  await page.click('#fly');
  await page.waitForTimeout(1500);
  check('en vaisseau : le bouton devient Turbo', (await page.textContent('#boost')) === 'Turbo');
  check('en vaisseau : vitesse affichée', await shown(page, 'i-speedbox'));
  await page.click('#takeoff');
  await page.waitForFunction(() => !document.getElementById('controls').hidden, null, { timeout: LONG });
  check('redécollé : retour en orbite', true);

  // travel to another world
  await page.click('#b-system');
  await page.waitForFunction(() => !document.getElementById('syslabels').hidden, null, { timeout: LONG });
  await page.waitForTimeout(2500);
  const before = await page.textContent('#pname');
  const target = page.locator('#syslabels button:not(.here)').first();
  await target.click(); await page.waitForTimeout(400);
  await page.click('#wc-go');
  await page.waitForFunction(() => !document.getElementById('controls').hidden, null, { timeout: LONG });
  const after = await page.textContent('#pname');
  check('voyage : un autre monde est chargé', after !== before, [before, after]);
  check('aucune erreur pendant le parcours', errors.length === 0, errors);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    await testLayouts(browser);
    if (QUICK) {
      console.log('Système (rapide)');
      const { ctx, page, errors } = await open(browser, { viewport: { width: 960, height: 600 } });
      await checkWorldCards(page, 'système : ');
      check('aucune erreur dans le système', errors.length === 0, errors);
      await ctx.close();
    } else await testJourney(browser, 'fr-FR');
  } catch (e) {
    failed++; console.log('  ÉCHEC exception : ' + e.message.split('\n')[0]);
  } finally {
    await browser.close();
  }
  console.log('\n' + passed + ' réussis, ' + failed + ' en échec');
  process.exit(failed ? 1 : 0);
})();
