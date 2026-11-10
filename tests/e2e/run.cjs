/**
 * End-to-end test of the whole website in a real browser.
 *
 * It builds the site, starts the local stand-in for Supabase (see
 * tests/backend), and then behaves like a guest on a phone and like the
 * couple in the dashboard: opening the invitation, playing music, sending an
 * RSVP, signing in, editing, uploading, saving and publishing, and checking
 * that guests see the result and that outsiders are kept out.
 *
 * Run from the project folder:
 *   npm install --no-save playwright && npx playwright install chromium
 *   (cd tests/backend && npm install)
 *   node tests/e2e/run.cjs
 */
const { chromium, devices } = require('playwright');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const SHOTS = path.join(__dirname, 'screenshots');
const SITE = 'http://127.0.0.1:4174';
const API = 'http://127.0.0.1:54321';
const ADMIN = { email: 'couple@example.com', password: 'a-strong-test-password' };
const STRANGER = { email: 'stranger@example.com', password: 'another-test-password' };

const GRAND_PARIS = 'No. 41/8, Link Rd, Site 4, Sahibabad Industrial Area Site 4, Sahibabad, Ghaziabad, Uttar Pradesh 201010';
const GOLDEN_MOMENTS = 'Convention Hall, Sector 16A, Sector 16, Vasundhara, Ghaziabad, Uttar Pradesh 201012';

const results = [];
let currentGroup = '';

function group(name) {
  currentGroup = name;
  console.log(`\n${name}`);
}

async function check(name, fn) {
  try {
    await fn();
    results.push({ group: currentGroup, name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    results.push({ group: currentGroup, name, ok: false, error: String(error.message || error).split('\n')[0] });
    console.log(`  ✗ ${name}\n      ${String(error.message || error).split('\n').slice(0, 3).join('\n      ')}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function equal(actual, wanted, label) {
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) throw new Error(`${label}: expected ${JSON.stringify(wanted)} but found ${JSON.stringify(actual)}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(fn, message, timeout = 8000) {
  const start = Date.now();
  for (;;) {
    try {
      const value = await fn();
      if (value) return value;
    } catch {
      /* try again */
    }
    if (Date.now() - start > timeout) throw new Error(`Timed out: ${message}`);
    await sleep(120);
  }
}

/** Records every audio element the page creates, so the test can see what is really playing. */
const AUDIO_SPY = () => {
  const Original = window.Audio;
  window.__audio = [];
  window.Audio = function PatchedAudio(...args) {
    const element = new Original(...args);
    window.__audio.push(element);
    return element;
  };
  window.Audio.prototype = Original.prototype;
};

const audioState = (page) =>
  page.evaluate(() => {
    const audio = window.__audio && window.__audio[0];
    if (!audio) return null;
    return { paused: audio.paused, muted: audio.muted, volume: audio.volume, loop: audio.loop, time: audio.currentTime, duration: audio.duration, src: audio.currentSrc, error: audio.error ? audio.error.code : null };
  });

async function openInvitation(page, url = SITE) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByTestId('open-invitation').click();
  await page.getByTestId('cover').waitFor({ state: 'detached', timeout: 6000 });
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const { startEmulator, ANON_KEY } = await import(path.join(ROOT, 'tests/backend/emulator.mjs'));

  if (!process.env.SKIP_BUILD) {
    console.log('Building the website for the test...');
    execFileSync('npx', ['vite', 'build', '--outDir', 'dist-e2e'], {
      cwd: ROOT,
      stdio: 'ignore',
      env: { ...process.env, VITE_SUPABASE_URL: API, VITE_SUPABASE_PUBLISHABLE_KEY: ANON_KEY, VITE_SUPABASE_ANON_KEY: '', VITE_SITE_URL: 'https://shaifali-nitin.example' },
    });
  }

  const emulator = await startEmulator({ port: 54321 });
  await emulator.createAdmin(ADMIN.email, ADMIN.password);
  await emulator.createUser(STRANGER.email, STRANGER.password);
  const db = emulator.db;
  const rows = async (sql, params = []) => (await db.query(sql, params)).rows;

  const server = spawn('npx', ['vite', 'preview', '--outDir', 'dist-e2e', '--port', '4174', '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  await until(async () => (await fetch(SITE)).ok, 'the test web server did not start', 20000);

  const browser = await chromium.launch({ args: ['--autoplay-policy=document-user-activation-required'] });
  const pageErrors = [];
  const watch = (page, label) => {
    page.on('pageerror', (error) => pageErrors.push(`${label}: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) pageErrors.push(`${label}: ${message.text()}`);
    });
  };
  const guestContext = async (options = {}) => {
    const context = await browser.newContext({ ...devices['Pixel 7'], acceptDownloads: true, ...options });
    await context.addInitScript(AUDIO_SPY);
    return context;
  };

  /* ================================================================== */
  group('1. Opening invitation');
  let context = await guestContext();
  let page = await context.newPage();
  watch(page, 'guest');
  await page.goto(SITE, { waitUntil: 'networkidle' });

  await check('the cover shows the invocation, heading, both names, message and button', async () => {
    const text = await page.getByTestId('cover').innerText();
    for (const wanted of ['श्री गणेशाय नमः', 'Together with their families', 'Shaifali Singh', 'Nitin Kaushik', 'cordially invite you', 'OPEN INVITATION']) {
      expect(text.toLowerCase().includes(wanted.toLowerCase()), `the cover does not show "${wanted}"`);
    }
    expect(!/Shashank|Manasi/i.test(await page.content()), 'the reference couple\'s names appear in the page');
  });
  await check('the page behind the cover cannot be scrolled and no music has started', async () => {
    expect(await page.evaluate(() => document.body.classList.contains('is-locked')), 'the page is not locked');
    expect((await audioState(page)) === null, 'audio was created before the guest tapped anything');
    expect((await page.getByTestId('music-control').count()) === 0, 'the music control is visible before opening');
  });
  await check('the whole cover fits on a small phone without scrolling (360 by 640)', async () => {
    const small = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await small.newPage();
    await p.goto(SITE, { waitUntil: 'networkidle' });
    const box = await p.getByTestId('open-invitation').boundingBox();
    expect(box && box.y >= 0 && box.y + box.height <= 640, `the button is outside the screen: ${JSON.stringify(box)}`);
    const top = await p.locator('.cover-content svg, .cover-content img').first().boundingBox();
    expect(top && top.y >= 0, 'the top of the cover is cut off');
    await p.screenshot({ path: path.join(SHOTS, 'cover-360x640.png') });
    await small.close();
  });
  await page.screenshot({ path: path.join(SHOTS, '01-cover.png') });

  await check('tapping "Open Invitation" opens the doors and reveals the website', async () => {
    await page.getByTestId('open-invitation').click();
    await page.waitForSelector('.cover.is-opening', { timeout: 1500 });
    await sleep(650);
    await page.screenshot({ path: path.join(SHOTS, '02-doors-opening.png') });
    await page.getByTestId('cover').waitFor({ state: 'detached', timeout: 6000 });
    expect(!(await page.evaluate(() => document.body.classList.contains('is-locked'))), 'the page is still locked after opening');
    expect(await page.locator('#welcome').isVisible(), 'the welcome section is not visible');
  });
  await page.screenshot({ path: path.join(SHOTS, '03-welcome.png') });

  /* ================================================================== */
  group('2. Animations');
  await check('petals fall once after opening and then stop', async () => {
    expect((await page.locator('.petal').count()) > 8, 'no petals after opening');
    await until(async () => (await page.locator('.petal').count()) === 0, 'the petals never stopped', 16000);
  });
  await check('sections fade in as they are scrolled into view', async () => {
    const hiddenBefore = await page.evaluate(() => {
      const el = document.querySelector('#rsvp [data-reveal]');
      return el ? getComputedStyle(el).opacity : null;
    });
    expect(hiddenBefore === '0', `the RSVP block should start hidden, opacity was ${hiddenBefore}`);
    await page.locator('#rsvp').scrollIntoViewIfNeeded();
    await until(() => page.evaluate(() => getComputedStyle(document.querySelector('#rsvp [data-reveal]')).opacity === '1'), 'the RSVP block never faded in');
    await page.evaluate(() => window.scrollTo(0, 0));
  });
  await check('guests who ask for reduced motion get the content without movement', async () => {
    const calm = await browser.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
    const p = await calm.newPage();
    await p.goto(SITE, { waitUntil: 'networkidle' });
    await p.getByTestId('open-invitation').click();
    await p.getByTestId('cover').waitFor({ state: 'detached', timeout: 6000 });
    const opacity = await p.evaluate(() => getComputedStyle(document.querySelector('#rsvp [data-reveal]')).opacity);
    expect(opacity === '1', 'content is hidden for reduced-motion guests');
    expect(await p.evaluate(() => getComputedStyle(document.querySelector('.petal') || document.body).display !== 'block' || !document.querySelector('.petal')), 'petals are shown despite reduced motion');
    await calm.close();
  });

  /* ================================================================== */
  group('3. Music controls');
  await check('music really starts after the tap: a real audio file is playing', async () => {
    const state = await until(async () => {
      const s = await audioState(page);
      return s && !s.paused && s.time > 0.3 ? s : null;
    }, 'the audio never started playing', 10000);
    expect(state.src.endsWith('/media/audio/saxophone-serenade.mp3'), `unexpected audio source ${state.src}`);
    expect(state.duration > 120 && state.duration < 150, `unexpected track length ${state.duration}`);
    expect(state.loop === true, 'the track is not set to loop');
    equal(await page.getByTestId('music-control').getAttribute('data-status'), 'playing', 'status shown by the control');
  });
  await check('the track keeps advancing while the guest moves between sections', async () => {
    const before = (await audioState(page)).time;
    await page.locator('nav a[href="#gallery"]').click();
    await sleep(900);
    await page.locator('nav a[href="#rsvp"]').click();
    await sleep(900);
    const after = await audioState(page);
    expect(!after.paused && after.time > before + 1, `the music stopped during navigation (${before} -> ${after.time})`);
  });
  await check('the on/off button pauses and resumes the music', async () => {
    await page.getByTestId('music-toggle').click();
    await until(async () => (await audioState(page)).paused, 'the music did not pause');
    await until(async () => (await page.getByTestId('music-control').getAttribute('data-status')) === 'paused', 'the control never showed paused');
    await page.getByTestId('music-toggle').click();
    await until(async () => !(await audioState(page)).paused, 'the music did not resume');
    await until(async () => (await page.getByTestId('music-control').getAttribute('data-status')) === 'playing', 'the control never showed playing again');
  });
  await check('mute and unmute work', async () => {
    await page.getByTestId('music-settings').click();
    await page.getByTestId('music-mute').click();
    expect((await audioState(page)).muted === true, 'mute did not mute the audio');
    equal(await page.getByTestId('music-status').innerText(), 'Playing, muted', 'status text while muted');
    await page.getByTestId('music-mute').click();
    expect((await audioState(page)).muted === false, 'unmute did not unmute the audio');
  });
  await check('the volume slider changes the real volume', async () => {
    const slider = page.getByTestId('music-volume');
    await slider.fill('25');
    await until(async () => Math.abs((await audioState(page)).volume - 0.25) < 0.01, 'volume did not become 25%');
    await slider.fill('80');
    await until(async () => Math.abs((await audioState(page)).volume - 0.8) < 0.01, 'volume did not become 80%');
    await page.screenshot({ path: path.join(SHOTS, '04-music-panel.png') });
    await page.keyboard.press('Escape');
  });
  await check('the track loops smoothly when it reaches the end', async () => {
    await page.evaluate(() => {
      const audio = window.__audio[0];
      audio.currentTime = audio.duration - 1.2;
    });
    await sleep(2600);
    const state = await audioState(page);
    expect(!state.paused && state.time < 6, `the track did not restart (time ${state.time}, paused ${state.paused})`);
  });
  await check('the music pauses when the guest leaves the tab and resumes on return', async () => {
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await until(async () => (await audioState(page)).paused, 'the music kept playing in the background');
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await until(async () => !(await audioState(page)).paused, 'the music did not resume');
  });
  await check('if the audio file cannot be loaded, the site says so instead of pretending', async () => {
    const broken = await guestContext();
    await broken.route('**/media/audio/**', (route) => route.abort());
    const p = await broken.newPage();
    await openInvitation(p);
    await until(async () => (await p.getByTestId('music-control').getAttribute('data-status')) === 'error', 'the control did not report the failure');
    expect(await p.getByTestId('music-toggle').isDisabled(), 'the play button should be disabled when there is no audio');
    await broken.close();
  });

  /* ================================================================== */
  group('4. Sagai event');
  const eventText = async (id) => (await page.getByTestId(`event-${id}`).innerText()).replace(/\s+/g, ' ');
  await check('shows the name, date, day, schedule, theme, venue and full address', async () => {
    const text = await eventText('sagai');
    for (const wanted of ['Sagai', 'SATURDAY', 'NOV', '21', '2026', 'AT 11 AM', 'Sagai 11:00 AM', 'Ring Exchange 12:30 PM', 'Lunch 1:00 PM', 'Theme: Pastel', 'The Grand Paris Banquets', GRAND_PARIS]) {
      expect(text.toLowerCase().includes(wanted.toLowerCase()), `Sagai does not show "${wanted}"`);
    }
  });
  await check('uses the pastel design', async () => {
    expect(await page.getByTestId('event-sagai').evaluate((el) => el.classList.contains('event--pastel')), 'Sagai is not using the pastel style');
  });

  group('5. Sangeet event');
  await check('shows the date, the venue and the 6 PM start', async () => {
    const text = await eventText('sangeet');
    for (const wanted of ['Sangeet', 'THURSDAY', 'DEC', '3', '2026', 'AT 6 PM', 'Sangeet 6:00 PM', 'The Grand Paris Banquets', GRAND_PARIS]) {
      expect(text.toLowerCase().includes(wanted.toLowerCase()), `Sangeet does not show "${wanted}"`);
    }
    expect(!/Timing to be announced/i.test(text), 'Sangeet still says the timing is to be announced');
  });
  await check('uses the festive design with moving lights and equaliser', async () => {
    const sangeet = page.getByTestId('event-sangeet');
    expect(await sangeet.evaluate((el) => el.classList.contains('event--festive')), 'Sangeet is not using the festive style');
    expect((await sangeet.locator('.equalizer span').count()) >= 5 && (await sangeet.locator('.bulb').count()) >= 8, 'festive decorations are missing');
  });

  group('6. Wedding event');
  await check('shows the name, date, day, the baraat note and all four schedule entries', async () => {
    const text = await eventText('wedding');
    for (const wanted of ['Wedding', 'SATURDAY', 'DEC', '5', '2026', 'AT 8:30 AM', 'Sehrabandi 8:30 AM', 'Ghurchari 9:00 AM', 'Departure of Baraat 9:30 AM', 'Lunch 12:30 PM', 'C-704, Mayur Dhwaj Apartment', 'Patparganj, Delhi 110092']) {
      expect(text.toLowerCase().includes(wanted.toLowerCase()), `Wedding does not show "${wanted}"`);
    }
    expect(await page.getByTestId('event-wedding').evaluate((el) => el.classList.contains('event--royal')), 'Wedding is not using the royal style');
  });
  await check('is at Golden Moments with its own address, never the Grand Paris address', async () => {
    const text = await eventText('wedding');
    expect(text.includes('Golden Moments Banquet') && text.includes(GOLDEN_MOMENTS), 'the Golden Moments address is missing');
    expect(!/Grand Paris|Sahibabad|201010/.test(text), 'the Grand Paris address appears in the Wedding');
    expect(!(await eventText('sagai')).includes('Golden Moments') && !(await eventText('sangeet')).includes('Golden Moments'), 'Golden Moments appears in another event');
  });
  await page.getByTestId('event-sagai').scrollIntoViewIfNeeded();
  await sleep(500);
  await page.screenshot({ path: path.join(SHOTS, '05-sagai.png') });
  await page.getByTestId('event-sangeet').scrollIntoViewIfNeeded();
  await sleep(500);
  await page.screenshot({ path: path.join(SHOTS, '06-sangeet.png') });
  await page.getByTestId('event-wedding').scrollIntoViewIfNeeded();
  await sleep(500);
  await page.screenshot({ path: path.join(SHOTS, '07-wedding.png') });

  /* ================================================================== */
  group('7. Dates and countdown');
  await check('the countdown matches the time left until 10:00 AM IST on 5 December 2026', async () => {
    const target = Date.parse('2026-12-05T04:30:00Z');
    const label = await page.locator('[role="timer"]').getAttribute('aria-label');
    const shownDays = Number(/(\d+) days?/.exec(label)[1]);
    const realDays = Math.floor((target - Date.now()) / 86_400_000);
    expect(Math.abs(shownDays - realDays) <= 0, `countdown shows ${shownDays} days, expected ${realDays}`);
    const first = await page.getByTestId('countdown').innerText();
    await sleep(1300);
    expect((await page.getByTestId('countdown').innerText()) !== first, 'the countdown is not ticking');
  });
  await check('a guest in another time zone sees the same Indian dates and the same countdown', async () => {
    const abroad = await browser.newContext({ ...devices['Pixel 7'], timezoneId: 'America/Los_Angeles', locale: 'en-US' });
    const p = await abroad.newPage();
    await openInvitation(p);
    const text = (await p.getByTestId('event-wedding').innerText()).replace(/\s+/g, ' ');
    expect(/SATURDAY/i.test(text) && text.includes('8:30 AM') && /DEC 5 2026/i.test(text.replace(/SATURDAY|AT 8:30 AM/gi, '').replace(/\s+/g, ' ')), 'the wedding date changed for a guest abroad');
    const here = Number(/(\d+) days?/.exec(await page.locator('[role="timer"]').getAttribute('aria-label'))[1]);
    const there = Number(/(\d+) days?/.exec(await p.locator('[role="timer"]').getAttribute('aria-label'))[1]);
    equal(there, here, 'days left for a guest abroad');
    await abroad.close();
  });
  await check('at the wedding moment the countdown gives way to the celebration message', async () => {
    const future = await browser.newContext({ ...devices['Pixel 7'] });
    const p = await future.newPage();
    await p.clock.install({ time: new Date('2026-12-05T02:59:55Z') }); // 8:29:55 AM IST
    await p.goto(`${SITE}/?skipCover`, { waitUntil: 'load' });
    await p.getByTestId('countdown').waitFor({ timeout: 6000 });
    await p.clock.runFor(8000);
    await p.getByTestId('countdown-done').waitFor({ timeout: 4000 });
    await future.close();
  });

  /* ================================================================== */
  group('8. Venue addresses, maps and calendar');
  const href = (id, testId) => page.getByTestId(`event-${id}`).getByTestId(testId).getAttribute('href');
  await check('"Get Directions" opens Google Maps directions to the right venue for each event', async () => {
    const sagai = new URL(await href('sagai', 'directions'));
    const sangeet = new URL(await href('sangeet', 'directions'));
    const wedding = new URL(await href('wedding', 'directions'));
    for (const url of [sagai, sangeet, wedding]) {
      equal(url.origin + url.pathname, 'https://www.google.com/maps/dir/', 'maps address');
      equal(url.searchParams.get('api'), '1', 'maps api parameter');
    }
    expect(/Grand Paris/.test(sagai.searchParams.get('destination')) && /Grand Paris/.test(sangeet.searchParams.get('destination')), 'Sagai or Sangeet does not point to The Grand Paris');
    expect(/Golden Moments/.test(wedding.searchParams.get('destination')), 'Wedding does not point to Golden Moments');
    expect(sagai.searchParams.get('destination_place_id') !== wedding.searchParams.get('destination_place_id'), 'both venues share one map place');
    equal(await page.getByTestId('event-wedding').getByTestId('directions').getAttribute('target'), '_blank', 'directions open in a new tab');
  });
  await check('"Add to Google Calendar" carries the right date and time for each event', async () => {
    const dates = async (id) => new URL(await href(id, 'google-calendar')).searchParams.get('dates');
    equal(await dates('sagai'), '20261121T053000Z/20261121T083000Z', 'Sagai (11:00 AM to 2:00 PM IST)');
    equal(await dates('sangeet'), '20261203T123000Z/20261203T153000Z', 'Sangeet (6:00 PM to 9:00 PM IST)');
    equal(await dates('wedding'), '20261205T030000Z/20261205T080000Z', 'Wedding (8:30 AM to 1:30 PM IST)');
    const wedding = new URL(await href('wedding', 'google-calendar'));
    expect(wedding.searchParams.get('location').includes(GOLDEN_MOMENTS), 'calendar location is wrong');
    equal(wedding.searchParams.get('ctz'), 'Asia/Kolkata', 'calendar time zone');
  });
  await check('"Download Calendar File" saves a valid .ics file', async () => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('event-wedding').getByTestId('download-ics').click()]);
    equal(download.suggestedFilename(), 'wedding.ics', 'file name');
    const text = fs.readFileSync(await download.path(), 'utf8');
    for (const wanted of ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'DTSTART:20261205T030000Z', 'DTEND:20261205T080000Z', 'SUMMARY:Wedding | Nitin Kaushik & Shaifali Singh', 'END:VCALENDAR']) {
      expect(text.includes(wanted), `the calendar file lacks ${wanted}`);
    }
    const [second] = await Promise.all([page.waitForEvent('download'), page.getByTestId('event-sangeet').getByTestId('download-ics').click()]);
    expect(fs.readFileSync(await second.path(), 'utf8').includes('DTSTART:20261203T123000Z'), 'the Sangeet calendar file should start at 6 PM IST');
  });
  await check('"Copy address" copies the venue and address', async () => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: SITE });
    await page.getByTestId('event-wedding').getByRole('button', { name: /copy address/i }).click();
    equal(await page.evaluate(() => navigator.clipboard.readText()), `Golden Moments Banquet, ${GOLDEN_MOMENTS}`, 'copied text');
  });

  /* ================================================================== */
  group('Gallery');
  await check('shows the nine photographs from the card, each loading correctly', async () => {
    await page.locator('#gallery').scrollIntoViewIfNeeded();
    equal(await page.getByTestId('gallery-photo').count(), 9, 'number of photographs');
    for (let i = 0; i < 9; i += 1) await page.getByTestId('gallery-photo').nth(i).scrollIntoViewIfNeeded();
    await until(() => page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="gallery-photo"] img')).every((img) => img.complete && img.naturalWidth > 600)), 'some photographs did not load');
    await page.locator('#gallery').scrollIntoViewIfNeeded();
    await sleep(600);
    await page.screenshot({ path: path.join(SHOTS, '08-gallery.png') });
  });
  await check('a photograph opens full screen, and can be swiped, stepped and closed', async () => {
    await page.getByTestId('gallery-photo').first().click();
    const box = page.getByTestId('lightbox');
    await box.waitFor();
    expect((await box.innerText()).includes('1 / 9'), 'the viewer does not show its position');
    await page.getByTestId('lightbox-next').click();
    await until(async () => (await box.innerText()).includes('2 / 9'), 'the next button did not work');
    await page.keyboard.press('ArrowRight');
    await until(async () => (await box.innerText()).includes('3 / 9'), 'the arrow key did not work');
    const image = await box.locator('img').boundingBox();
    await page.mouse.move(image.x + image.width * 0.3, image.y + image.height / 2);
    await page.mouse.down();
    await page.mouse.move(image.x + image.width * 0.3 + 140, image.y + image.height / 2, { steps: 6 });
    await page.mouse.up();
    await until(async () => (await box.innerText()).includes('2 / 9'), 'swiping did not go back');
    await page.screenshot({ path: path.join(SHOTS, '09-lightbox.png') });
    await page.keyboard.press('Escape');
    await box.waitFor({ state: 'detached' });
  });

  /* ================================================================== */
  group('9. RSVP form');
  await check('has the heading and all requested fields', async () => {
    const text = await page.locator('#rsvp').innerText();
    for (const wanted of ['Will You Be There To Celebrate With Us?', 'GUEST NAME', 'MOBILE NUMBER', 'NUMBER OF GUESTS', 'EVENTS ATTENDING', 'Sagai', 'Sangeet', 'Wedding', 'PERSONAL MESSAGE']) {
      expect(text.toLowerCase().includes(wanted.toLowerCase()), `the RSVP form lacks "${wanted}"`);
    }
  });
  await check('an incomplete form is not sent and explains what is missing', async () => {
    await page.getByTestId('rsvp-submit').click();
    const text = await page.locator('#rsvp').innerText();
    for (const wanted of ['Please enter your name.', 'Please enter a valid mobile number.', 'Please choose at least one event.']) expect(text.includes(wanted), `missing message: ${wanted}`);
    equal((await rows('select count(*)::int as n from public.rsvps'))[0].n, 0, 'responses saved from an empty form');
  });
  await check('a complete response is saved in the database and a thank-you message appears', async () => {
    await page.fill('#rsvp-name', 'Asha Verma');
    await page.fill('#rsvp-mobile', '98765 43210');
    await page.getByTestId('guest-plus').click();
    await page.getByTestId('guest-plus').click();
    await page.locator('#rsvp label', { hasText: 'Sagai' }).click();
    await page.locator('#rsvp label', { hasText: 'Wedding' }).click();
    await page.fill('#rsvp-message', 'Many congratulations to you both!');
    await page.screenshot({ path: path.join(SHOTS, '10-rsvp-filled.png') });
    await page.getByTestId('rsvp-submit').click();
    await page.getByTestId('rsvp-success').waitFor({ timeout: 8000 });
    const success = await page.getByTestId('rsvp-success').innerText();
    expect(success.includes('Thank You!') && success.includes('3 guests') && success.includes('Sagai, Wedding'), `unexpected confirmation: ${success}`);
    await page.screenshot({ path: path.join(SHOTS, '11-rsvp-thank-you.png') });
    const saved = await rows('select guest_name, mobile, guest_count, events, message from public.rsvps');
    equal(saved, [{ guest_name: 'Asha Verma', mobile: '9876543210', guest_count: 3, events: [{ id: 'sagai', name: 'Sagai' }, { id: 'wedding', name: 'Wedding' }], message: 'Many congratulations to you both!' }], 'saved response');
  });
  await check('a guest can say that they cannot attend', async () => {
    await page.getByRole('button', { name: /send another response/i }).click();
    await page.fill('#rsvp-name', 'Ravi Kumar');
    await page.fill('#rsvp-mobile', '+91 90000 11111');
    await page.getByTestId('rsvp-decline').check();
    await page.getByTestId('rsvp-submit').click();
    await page.getByTestId('rsvp-success').waitFor({ timeout: 8000 });
    equal(await rows(`select guest_count, events from public.rsvps where guest_name = 'Ravi Kumar'`), [{ guest_count: 0, events: [] }], 'declined response');
  });
  await check('a returning guest is told that their response was received', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByTestId('open-invitation').click();
    await page.getByTestId('cover').waitFor({ state: 'detached', timeout: 6000 });
    expect((await page.getByTestId('rsvp-saved-note').innerText()).includes('Ravi Kumar'), 'the returning guest note is missing');
  });
  await check('guests cannot read the guest list through the website\'s public key', async () => {
    const headers = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };
    const list = await fetch(`${API}/rest/v1/rsvps?select=*`, { headers });
    expect(list.status === 401 || list.status === 403, `reading RSVPs returned ${list.status}`);
    const sneaky = await fetch(`${API}/rest/v1/rsvps`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ guest_name: 'Spy Guest', mobile: '9111111111', guest_count: 1, events: [] }) });
    expect(sneaky.status === 401 || sneaky.status === 403, `inserting and reading back returned ${sneaky.status}`);
    equal((await rows(`select count(*)::int as n from public.rsvps where guest_name = 'Spy Guest'`))[0].n, 0, 'rows saved by a read-back attempt');
  });
  await context.close();

  /* ================================================================== */
  group('10. Admin authentication');
  const adminContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await adminContext.addInitScript(AUDIO_SPY);
  const admin = await adminContext.newPage();
  watch(admin, 'admin');
  const signIn = async (p, who) => {
    await p.fill('#admin-email', who.email);
    await p.fill('#admin-password', who.password);
    await p.getByTestId('sign-in-submit').click();
  };
  await check('/admin shows a sign-in page, not the dashboard and not the invitation', async () => {
    await admin.goto(`${SITE}/admin`, { waitUntil: 'networkidle' });
    await admin.getByTestId('sign-in-form').waitFor();
    expect((await admin.getByTestId('dashboard').count()) === 0 && (await admin.getByTestId('cover').count()) === 0, 'something other than the sign-in page is shown');
    await admin.screenshot({ path: path.join(SHOTS, '12-admin-sign-in.png') });
  });
  await check('a wrong password is refused', async () => {
    await signIn(admin, { email: ADMIN.email, password: 'wrong-password' });
    expect((await admin.getByTestId('sign-in-error').innerText()).includes('not correct'), 'no error for a wrong password');
    expect((await admin.getByTestId('dashboard').count()) === 0, 'the dashboard opened with a wrong password');
  });
  await check('a signed-in account that is not an administrator is kept out', async () => {
    await signIn(admin, STRANGER);
    await admin.getByTestId('not-admin').waitFor({ timeout: 8000 });
    expect((await admin.getByTestId('dashboard').count()) === 0, 'a non-administrator reached the dashboard');
    await admin.getByTestId('not-admin-sign-out').click();
    await admin.getByTestId('sign-in-form').waitFor();
  });
  await check('the administrator can sign in and reaches the dashboard', async () => {
    await signIn(admin, ADMIN);
    await admin.getByTestId('dashboard').waitFor({ timeout: 10000 });
    equal(await admin.getByTestId('status').getAttribute('data-state'), 'unpublished', 'status on first sign-in');
    await admin.screenshot({ path: path.join(SHOTS, '13-admin-overview.png') });
  });
  await check('the session survives a reload, and signing out returns to the sign-in page', async () => {
    await admin.reload({ waitUntil: 'networkidle' });
    await admin.getByTestId('dashboard').waitFor({ timeout: 10000 });
    await admin.getByTestId('sign-out').click();
    await admin.getByTestId('sign-in-form').waitFor();
    await signIn(admin, ADMIN);
    await admin.getByTestId('dashboard').waitFor({ timeout: 10000 });
  });

  /* ================================================================== */
  group('15a. First publish');
  const publicText = async (selector = 'body', extra = '') => {
    const fresh = await guestContext();
    const p = await fresh.newPage();
    await p.goto(`${SITE}/?skipCover${extra}`, { waitUntil: 'networkidle' });
    const text = await p.locator(selector).innerText();
    await fresh.close();
    return text;
  };
  const field = (p, label) => p.getByLabel(label, { exact: true });
  const toastText = async () => (await admin.getByTestId('toasts').innerText()).trim();
  await check('"Publish" makes the content live and the status turns to Published', async () => {
    await admin.getByTestId('publish').click();
    await until(async () => (await admin.getByTestId('status').getAttribute('data-state')) === 'published', 'the status never became Published');
    expect((await toastText()).includes('Website updated'), 'no success message after publishing');
    equal((await rows(`select id from public.site_content order by id`)).map((r) => r.id), ['draft', 'published'], 'content rows');
  });

  /* ================================================================== */
  group('11. Editing website content');
  await check('typing a change marks the dashboard as having unsaved changes', async () => {
    await admin.getByTestId('nav-welcome').click();
    await field(admin, 'Welcome message').fill('We are overjoyed to invite you to our wedding celebrations in Ghaziabad.');
    equal(await admin.getByTestId('status').getAttribute('data-state'), 'unsaved', 'status after typing');
    expect(await admin.getByTestId('save').isEnabled(), 'Save Changes should be enabled');
  });
  await check('leaving the page with unsaved changes triggers the browser warning', async () => {
    const prevented = await admin.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented, 'no unsaved-changes warning is registered');
  });
  await check('"Discard" undoes unsaved changes after asking', async () => {
    await admin.getByTestId('discard').click();
    await admin.getByTestId('confirm-ok').click();
    await until(async () => (await admin.getByTestId('status').getAttribute('data-state')) === 'published', 'discard did not restore the saved state');
    expect(!(await field(admin, 'Welcome message').inputValue()).includes('overjoyed'), 'the discarded text is still there');
    const prevented = await admin.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(!prevented, 'the warning is still active after discarding');
  });
  await check('names, messages, event details and schedules can all be edited', async () => {
    await field(admin, 'Welcome message').fill('We are overjoyed to invite you to our wedding celebrations in Ghaziabad.');
    await admin.getByTestId('nav-couple').click();
    await field(admin, 'Invitation heading').fill('With the blessings of our elders');
    await field(admin, "Bride's parents (optional)").fill('Daughter of Mr and Mrs Singh');
    await admin.getByTestId('nav-events').click();
    await admin.getByTestId('event-toggle').nth(1).click(); // Sangeet
    await admin.getByTestId('add-timing').click();
    await admin.getByLabel('Time', { exact: true }).last().fill('19:30');
    await admin.getByLabel('What happens', { exact: true }).last().fill('Dance performances');
    await field(admin, 'Dress code or theme').fill('Glitter and glam');
    await field(admin, 'Venue name').fill('The Grand Paris Banquets');
    equal(await admin.getByTestId('status').getAttribute('data-state'), 'unsaved', 'status after editing events');
  });
  await check('events can be added, reordered, hidden and deleted', async () => {
    await admin.getByTestId('add-event').click();
    equal(await admin.getByTestId('event-card').count(), 4, 'events after adding one');
    await field(admin, 'Event name').fill('Haldi');
    await field(admin, 'Date').fill('2026-12-04');
    await admin.getByLabel('Look of this event').selectOption('sunshine');
    await field(admin, 'Venue name').fill('At home');
    await admin.getByRole('button', { name: 'Move Haldi up' }).click();
    const names = await admin.getByTestId('event-card').locator('button[data-testid="event-toggle"] span.font-bold').allInnerTexts();
    equal(names, ['Sagai', 'Sangeet', 'Haldi', 'Wedding'], 'order after moving Haldi up');
    // add one more, hide it, then delete it
    await admin.getByTestId('add-event').click();
    await field(admin, 'Event name').fill('Temporary');
    await admin.getByRole('button', { name: 'Hide Temporary' }).click();
    expect((await admin.getByTestId('event-card').last().innerText()).includes('Hidden'), 'the hidden event is not marked as hidden');
    await admin.getByRole('button', { name: 'Delete Temporary' }).click();
    await admin.getByTestId('confirm-ok').click();
    equal(await admin.getByTestId('event-card').count(), 4, 'events after deleting one');
    await admin.screenshot({ path: path.join(SHOTS, '14-admin-events.png'), fullPage: true });
  });
  await check('sections can be hidden, renamed, added and reordered', async () => {
    await admin.getByTestId('nav-sections').click();
    await admin.getByTestId('add-section').click();
    await field(admin, 'Heading').fill('Getting There');
    await field(admin, 'Text').fill('The venues are close to Vaishali metro station.\n\nParking is available at both venues.');
    await admin.getByLabel('Name in the menu').last().fill('Travel');
    await admin.getByRole('button', { name: 'Move section up' }).last().click(); // above RSVP
    const cards = await admin.getByTestId('section-card').locator('p.font-bold').allInnerTexts();
    equal(cards, ['Welcome and countdown', 'Events', 'Gallery', 'Getting There', 'RSVP form'], 'section order');
  });
  await check('the countdown can be switched off and the footer contacts edited', async () => {
    await admin.getByTestId('nav-welcome').click();
    await admin.getByRole('switch', { name: 'Show the countdown' }).click();
    await admin.getByTestId('nav-footer').click();
    await admin.getByLabel('Name (optional)').first().fill('Nitin');
    await field(admin, 'Heading').fill('Thank You So Much');
  });

  /* ================================================================== */
  group('Live preview');
  await check('the preview shows the unsaved draft, while guests still see the old content', async () => {
    await admin.getByTestId('preview-button').click();
    const frame = admin.frameLocator('[data-testid="preview-frame"]');
    await frame.locator('#welcome').waitFor({ timeout: 10000 });
    await until(async () => (await frame.locator('body').innerText()).includes('overjoyed'), 'the preview does not show the unsaved welcome message');
    const previewText = await frame.locator('body').innerText();
    expect(previewText.includes('Daughter of Mr and Mrs Singh') && previewText.includes('Haldi') && previewText.includes('Getting There'), 'the preview lacks draft changes');
    expect((await frame.getByTestId('countdown').count()) === 0, 'the preview still shows the countdown');
    await admin.screenshot({ path: path.join(SHOTS, '15-admin-preview.png') });
    expect(!(await publicText()).includes('overjoyed'), 'guests can already see unsaved changes');
  });
  await check('the preview can start from the opening screen and never saves an RSVP', async () => {
    await admin.getByTestId('preview-opening').check();
    const frame = admin.frameLocator('[data-testid="preview-frame"]');
    await until(async () => (await frame.getByTestId('cover').innerText()).includes('With the blessings of our elders'), 'the preview cover does not show the edited heading', 10000);
    const before = (await rows('select count(*)::int as n from public.rsvps'))[0].n;
    await frame.getByTestId('open-invitation').click();
    await frame.getByTestId('cover').waitFor({ state: 'detached', timeout: 6000 });
    await frame.locator('#rsvp-name').fill('Preview Person');
    await frame.locator('#rsvp-mobile').fill('9123456780');
    await frame.locator('#rsvp label', { hasText: 'Wedding' }).click();
    await frame.getByTestId('rsvp-submit').click();
    await frame.getByTestId('rsvp-error').waitFor();
    equal((await rows('select count(*)::int as n from public.rsvps'))[0].n, before, 'responses saved from the preview');
    await admin.getByTestId('preview-close').click();
  });

  /* ================================================================== */
  group('12. Uploading images');
  const makeJpeg = async (name, width, height, colour) => {
    const file = path.join(SHOTS, name);
    const p = await adminContext.newPage();
    await p.setViewportSize({ width, height });
    await p.setContent(`<body style="margin:0;background:linear-gradient(135deg, ${colour}, #fff)"><h1 style="font:bold 120px sans-serif;padding:80px">${name}</h1></body>`);
    await p.screenshot({ path: file, type: 'jpeg', quality: 92 });
    await p.close();
    return file;
  };
  const bigPhoto = await makeJpeg('upload-large.jpg', 3000, 2000, '#c2185b');
  const secondPhoto = await makeJpeg('upload-second.jpg', 1200, 1600, '#1565c0');
  await check('photographs can be added to the gallery; large ones are resized before upload', async () => {
    await admin.getByTestId('nav-gallery').click();
    await admin.getByTestId('gallery-input').setInputFiles([bigPhoto, secondPhoto]);
    await until(async () => (await admin.getByTestId('gallery-item').count()) === 11, 'the uploaded photographs did not appear', 20000);
    const stored = await rows(`select name, metadata from storage.objects where bucket_id = 'media' order by created_at`);
    equal(stored.length, 2, 'files in storage');
    expect(stored.every((row) => row.name.startsWith('images/') && row.metadata.mimetype === 'image/jpeg'), 'unexpected stored file type');
    const url = await admin.getByTestId('gallery-item').nth(9).locator('img').getAttribute('src');
    const response = await fetch(url);
    expect(response.ok && response.headers.get('content-type') === 'image/jpeg', `the uploaded picture is not publicly viewable (${response.status})`);
    const dimensions = await admin.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    }, url);
    equal(dimensions, [2000, 1333], 'size of the resized 3000 by 2000 photograph');
  });
  await check('a photograph can be captioned, reframed, replaced, reordered and removed', async () => {
    const item = admin.getByTestId('gallery-item').nth(9);
    await item.getByLabel(/Caption of photograph 10/).fill('Our new favourite');
    await item.getByLabel('Frame').selectOption('gold');
    const srcBefore = await item.locator('img').getAttribute('src');
    await item.getByRole('button', { name: 'Replace' }).click().catch(() => {});
    await admin.getByTestId('gallery-replace-input').setInputFiles(secondPhoto);
    await until(async () => (await admin.getByTestId('gallery-item').nth(9).locator('img').getAttribute('src')) !== srcBefore, 'replace did not change the picture', 15000);
    await admin.getByRole('button', { name: 'Move photograph 10 up' }).click();
    expect((await admin.getByTestId('gallery-item').nth(8).getByLabel(/Caption/).inputValue()) === 'Our new favourite', 'reorder did not move the photograph');
    await admin.getByRole('button', { name: 'Delete photograph 11' }).click();
    await admin.getByTestId('confirm-ok').click();
    equal(await admin.getByTestId('gallery-item').count(), 10, 'photographs after removing one');
  });
  await check('the welcome photograph can be replaced', async () => {
    await admin.getByTestId('nav-welcome').click();
    await admin.getByTestId('image-input').first().setInputFiles(secondPhoto);
    await until(async () => /storage\/v1\/object\/public\/media\/images\//.test((await admin.locator('main img').first().getAttribute('src')) || ''), 'the welcome photograph was not replaced', 15000);
  });
  await check('a file that is not a picture is refused with a clear message', async () => {
    const notImage = path.join(SHOTS, 'not-a-picture.txt');
    fs.writeFileSync(notImage, 'hello');
    await admin.getByTestId('nav-gallery').click();
    const before = await admin.getByTestId('gallery-item').count();
    await admin.getByTestId('gallery-input').setInputFiles(notImage);
    await until(async () => /picture/i.test(await toastText()), 'no message for a non-picture file');
    equal(await admin.getByTestId('gallery-item').count(), before, 'gallery size after a refused file');
  });

  /* ================================================================== */
  group('13. Uploading music');
  const track = path.join(ROOT, 'public/media/audio/saxophone-serenade.mp3');
  await check('an MP3 can be uploaded and becomes the selected track', async () => {
    await admin.getByTestId('nav-music').click();
    await admin.getByTestId('music-input').setInputFiles({ name: 'our-first-dance.mp3', mimeType: 'audio/mpeg', buffer: fs.readFileSync(track) });
    await until(async () => /storage\/v1\/object\/public\/media\/audio\/.+\.mp3$/.test((await admin.getByTestId('music-preview').getAttribute('src')) || ''), 'the uploaded track was not selected', 20000);
    equal(await field(admin, 'Title shown in the music control').inputValue(), 'our first dance', 'title taken from the file name');
    const url = await admin.getByTestId('music-preview').getAttribute('src');
    const response = await fetch(url);
    expect(response.ok && response.headers.get('content-type') === 'audio/mpeg' && Number(response.headers.get('content-length')) === fs.statSync(track).size, 'the uploaded track is not served correctly');
    await admin.screenshot({ path: path.join(SHOTS, '16-admin-music.png'), fullPage: true });
  });
  await check('the uploaded track is playable in the dashboard\'s own player', async () => {
    const duration = await admin.getByTestId('music-preview').evaluate(
      (audio) =>
        new Promise((resolve, reject) => {
          audio.addEventListener('loadedmetadata', () => resolve(audio.duration), { once: true });
          audio.addEventListener('error', () => reject(new Error('audio error')), { once: true });
          audio.preload = 'metadata';
          audio.load();
        }),
    );
    expect(duration > 120, `unexpected duration ${duration}`);
  });
  await check('a file that is not audio is refused', async () => {
    await admin.getByTestId('music-input').setInputFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
    await until(async () => /audio file/i.test(await toastText()), 'no message for a non-audio file');
  });
  await check('an external audio link can be used, and unsafe links are refused', async () => {
    await field(admin, 'Or paste a link to an audio file').fill('javascript:alert(1)');
    await admin.getByRole('button', { name: 'Use this link' }).click();
    await until(async () => /complete web address/i.test(await toastText()), 'an unsafe link was accepted');
    expect(/storage\/v1\/object\/public/.test(await admin.getByTestId('music-preview').getAttribute('src')), 'the track changed after an unsafe link');
  });

  /* ================================================================== */
  group('14. Saving changes');
  await check('"Save Changes" stores the draft and confirms it', async () => {
    await admin.getByTestId('save').click();
    await until(async () => (await admin.getByTestId('status').getAttribute('data-state')) === 'unpublished', 'the status never became "saved, not yet published"');
    expect((await toastText()).includes('Changes saved'), 'no success message after saving');
    const draft = (await rows(`select content from public.site_content where id = 'draft'`))[0].content;
    expect(draft.welcome.message.includes('overjoyed') && draft.events.length === 4 && draft.gallery.photos.length === 10 && draft.music.source === 'custom', 'the saved draft lacks the edits');
  });
  await check('saved changes survive signing out and in again', async () => {
    await admin.getByTestId('sign-out').click();
    await admin.getByTestId('sign-in-form').waitFor();
    await signIn(admin, ADMIN);
    await admin.getByTestId('dashboard').waitFor({ timeout: 10000 });
    equal(await admin.getByTestId('status').getAttribute('data-state'), 'unpublished', 'status after signing in again');
    await admin.getByTestId('nav-welcome').click();
    expect((await field(admin, 'Welcome message').inputValue()).includes('overjoyed'), 'the saved draft was not loaded');
  });
  await check('guests still see the previously published version until Publish is pressed', async () => {
    const text = await publicText();
    expect(!text.includes('overjoyed') && !text.includes('Haldi') && !text.includes('Getting There'), 'guests can see the unpublished draft');
    const headers = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };
    const draft = await (await fetch(`${API}/rest/v1/site_content?id=eq.draft&select=content`, { headers })).json();
    equal(draft, [], 'what a guest gets when asking for the draft');
  });
  await check('if someone else saved in the meantime, the dashboard asks before overwriting', async () => {
    await db.query(`update public.site_content set content = jsonb_set(content, '{footer,closingLine}', '"Changed elsewhere"') where id = 'draft'`);
    await admin.getByTestId('nav-footer').click();
    await field(admin, 'Closing line').fill('With all our love');
    await admin.getByTestId('save').click();
    await admin.getByTestId('confirm-dialog').waitFor({ timeout: 6000 });
    expect((await admin.getByTestId('confirm-dialog').innerText()).includes('changed somewhere else'), 'no conflict warning');
    await admin.getByTestId('confirm-ok').click(); // keep my version
    await until(async () => (await rows(`select content->'footer'->>'closingLine' as line from public.site_content where id = 'draft'`))[0].line === 'With all our love', 'my version was not saved');
  });

  /* ================================================================== */
  group('15. Publishing changes');
  await check('"Update Website" publishes the draft', async () => {
    await admin.getByTestId('publish').click();
    await until(async () => (await admin.getByTestId('status').getAttribute('data-state')) === 'published', 'the status never became Published');
    expect((await toastText()).includes('Guests now see the new version'), 'no success message after publishing');
  });
  let guest;
  await check('a new guest immediately sees every published change', async () => {
    context = await guestContext();
    guest = await context.newPage();
    watch(guest, 'guest-after-publish');
    await guest.goto(SITE, { waitUntil: 'networkidle' });
    expect((await guest.getByTestId('cover').innerText()).includes('With the blessings of our elders'), 'the cover heading was not updated');
    await guest.getByTestId('open-invitation').click();
    await guest.getByTestId('cover').waitFor({ state: 'detached', timeout: 6000 });
    const text = (await guest.locator('body').innerText()).replace(/\s+/g, ' ');
    for (const wanted of ['overjoyed to invite you', 'Daughter of Mr and Mrs Singh', 'Haldi', 'FRIDAY', 'At home', 'Dance performances 7:30 PM', 'Glitter and glam', 'Getting There', 'Vaishali metro station', 'Thank You So Much', 'With all our love', 'Nitin 98100 07038', 'Our new favourite']) {
      expect(text.toLowerCase().includes(wanted.toLowerCase()), `guests do not see "${wanted}"`);
    }
    expect((await guest.getByTestId('countdown').count()) === 0, 'the countdown is still shown');
    equal(await guest.getByTestId('gallery-photo').count(), 10, 'photographs guests see');
    const order = await guest.locator('article.event h3').allInnerTexts();
    equal(order, ['Sagai', 'Sangeet', 'Haldi', 'Wedding'], 'event order guests see');
    equal(await guest.locator('nav[aria-label="Sections of the invitation"] a').allInnerTexts(), ['HOME', 'EVENTS', 'GALLERY', 'TRAVEL', 'RSVP'], 'menu guests see');
    expect(await guest.getByTestId('event-sangeet').getByTestId('time-note').count() === 0, 'Sangeet still says the timing is to be announced');
  });
  await check('guests hear the newly uploaded track', async () => {
    const state = await until(async () => {
      const s = await audioState(guest);
      return s && !s.paused && s.time > 0.3 ? s : null;
    }, 'the uploaded track did not play', 12000);
    expect(/storage\/v1\/object\/public\/media\/audio\/.+\.mp3$/.test(state.src), `guests are hearing ${state.src}`);
    await guest.getByTestId('music-settings').click();
    expect((await guest.getByTestId('music-panel').innerText()).includes('our first dance'), 'the track title was not updated');
    await guest.keyboard.press('Escape');
  });
  await check('the new event gets working directions and calendar links', async () => {
    const haldi = guest.locator('article.event', { hasText: 'Haldi' });
    expect(await haldi.evaluate((el) => el.classList.contains('event--sunshine')), 'Haldi is not using the chosen look');
    const maps = new URL(await haldi.getByTestId('directions').getAttribute('href'));
    equal(maps.searchParams.get('destination'), 'At home', 'directions for the new event');
    equal(new URL(await haldi.getByTestId('google-calendar').getAttribute('href')).searchParams.get('dates'), '20261204/20261205', 'calendar dates for the new event');
    const sangeet = new URL(await guest.getByTestId('event-sangeet').getByTestId('google-calendar').getAttribute('href'));
    equal(sangeet.searchParams.get('dates'), '20261203T123000Z/20261203T150000Z', 'Sangeet calendar after a 7:30 PM timing was added');
  });
  await guest.locator('article.event', { hasText: 'Haldi' }).scrollIntoViewIfNeeded();
  await sleep(500);
  await guest.screenshot({ path: path.join(SHOTS, '17-published-new-event.png') });
  await check('a guest who already had the page open gets the update when they return to it', async () => {
    await db.query(`update public.site_content set content = jsonb_set(content, '{welcome,eyebrow}', '"Save the dates"') where id = 'published'`);
    await guest.evaluate(() => {
      const realNow = Date.now;
      Date.now = () => realNow() + 120000; // two minutes later
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await until(async () => (await guest.locator('#welcome').innerText()).toUpperCase().includes('SAVE THE DATES'), 'the open page did not refresh its content');
  });
  await check('closing RSVPs in the dashboard closes the form for guests and in the database', async () => {
    await admin.getByTestId('nav-rsvp-form').click();
    await admin.getByRole('switch', { name: 'Accept RSVPs' }).click();
    await admin.getByTestId('publish').click();
    await until(async () => (await admin.getByTestId('status').getAttribute('data-state')) === 'published', 'publishing the closed form failed');
    expect((await publicText('#rsvp')).includes('RSVPs are now closed'), 'guests still see the open form');
    const headers = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
    const attempt = await fetch(`${API}/rest/v1/rsvps`, { method: 'POST', headers, body: JSON.stringify({ guest_name: 'Too Late', mobile: '9222222222', guest_count: 1, events: [] }) });
    expect(attempt.status === 401 || attempt.status === 403, `the database accepted an RSVP while closed (${attempt.status})`);
    await admin.getByRole('switch', { name: 'Accept RSVPs' }).click();
    await admin.getByTestId('publish').click();
    await until(async () => (await admin.getByTestId('status').getAttribute('data-state')) === 'published', 'reopening failed');
  });
  await context.close();

  /* ================================================================== */
  group('RSVP responses in the dashboard');
  await check('the administrator sees every response with totals', async () => {
    await admin.getByTestId('nav-responses').click();
    await until(async () => (await admin.getByTestId('rsvp-row').count()) === 2, 'the responses did not load');
    const stats = (await admin.getByTestId('rsvp-stats').innerText()).replace(/\s+/g, ' ');
    expect(/RESPONSES 2/i.test(stats) && /GUESTS EXPECTED 3/i.test(stats) && /WEDDING 3/i.test(stats), `unexpected totals: ${stats}`);
    await admin.screenshot({ path: path.join(SHOTS, '18-admin-responses.png'), fullPage: true });
  });
  await check('responses can be searched and filtered', async () => {
    await admin.getByTestId('rsvp-search').fill('asha');
    equal(await admin.getByTestId('rsvp-row').count(), 1, 'rows matching "asha"');
    await admin.getByTestId('rsvp-search').fill('90000 11111');
    equal(await admin.getByTestId('rsvp-row').count(), 1, 'rows matching a mobile number');
    await admin.getByTestId('rsvp-search').fill('');
    await admin.getByTestId('rsvp-filter').selectOption('declined');
    equal(await admin.getByTestId('rsvp-row').count(), 1, 'rows for "cannot attend"');
    await admin.getByTestId('rsvp-filter').selectOption('event:sangeet');
    equal(await admin.getByTestId('rsvp-row').count(), 0, 'rows attending Sangeet');
    await admin.getByTestId('rsvp-filter').selectOption('all');
  });
  await check('responses export to CSV', async () => {
    const [download] = await Promise.all([admin.waitForEvent('download'), admin.getByTestId('export-csv').click()]);
    expect(/^rsvp-responses-\d{4}-\d{2}-\d{2}\.csv$/.test(download.suggestedFilename()), `unexpected file name ${download.suggestedFilename()}`);
    const csv = fs.readFileSync(await download.path(), 'utf8');
    expect(csv.includes('Name,Mobile,Attending,Guests,Events,Message,Received'), 'CSV header missing');
    expect(csv.includes('Asha Verma,98765 43210,Yes,3,"Sagai, Wedding",Many congratulations to you both!'), 'CSV row missing');
    expect(csv.includes('Ravi Kumar,+91 90000 11111,No,0,,'), 'declined row missing');
  });
  await check('responses export to Excel', async () => {
    const [download] = await Promise.all([admin.waitForEvent('download'), admin.getByTestId('export-xlsx').click()]);
    expect(download.suggestedFilename().endsWith('.xlsx'), 'not an .xlsx file');
    const bytes = fs.readFileSync(await download.path());
    expect(bytes.length > 2000 && bytes[0] === 0x50 && bytes[1] === 0x4b, 'the Excel file is not a valid workbook');
    const copy = path.join(SHOTS, 'export.xlsx');
    fs.writeFileSync(copy, bytes);
    const sheet = execFileSync('unzip', ['-p', copy, 'xl/worksheets/sheet1.xml']).toString();
    const strings = execFileSync('unzip', ['-p', copy, 'xl/sharedStrings.xml']).toString();
    expect(strings.includes('Asha Verma') && strings.includes('98765 43210') && sheet.includes('<v>3</v>'), 'the workbook does not contain the responses');
  });
  await check('a response can be deleted after confirmation', async () => {
    await admin.getByTestId('rsvp-delete').last().click();
    await admin.getByTestId('confirm-ok').click();
    await until(async () => (await admin.getByTestId('rsvp-row').count()) === 1, 'the response was not removed from the list');
    equal((await rows('select count(*)::int as n from public.rsvps'))[0].n, 1, 'responses left in the database');
  });

  /* ================================================================== */
  group('Publishing history and housekeeping');
  await check('an earlier published version can be loaded back into the editor', async () => {
    await admin.getByTestId('nav-settings').click();
    await admin.getByTestId('version-list').waitFor();
    const count = await admin.getByTestId('version-restore').count();
    expect(count >= 4, `expected several versions, found ${count}`);
    await admin.getByTestId('version-restore').last().click(); // the very first publish
    await admin.getByTestId('confirm-ok').click();
    equal(await admin.getByTestId('status').getAttribute('data-state'), 'unsaved', 'status after loading an old version');
    await admin.getByTestId('nav-events').click();
    equal(await admin.getByTestId('event-card').count(), 3, 'events in the restored version');
    await admin.getByTestId('discard').click();
    await admin.getByTestId('confirm-ok').click();
    equal(await admin.getByTestId('event-card').count(), 4, 'events after discarding the restore');
  });
  await check('unused uploads can be found and cleared, without touching files that are in use', async () => {
    await admin.getByTestId('nav-settings').click();
    const before = (await rows(`select count(*)::int as n from storage.objects`))[0].n;
    await admin.getByTestId('scan-files').click();
    await admin.getByTestId('unused-result').waitFor();
    // Two uploads are no longer used: the photograph that was replaced and the one that was removed from the gallery.
    expect((await admin.getByTestId('unused-result').innerText()).startsWith('2 unused files'), `unexpected result: ${await admin.getByTestId('unused-result').innerText()}`);
    await admin.getByTestId('clean-files').click();
    await admin.getByTestId('confirm-ok').click();
    await until(async () => (await rows(`select count(*)::int as n from storage.objects`))[0].n === before - 2, 'the unused files were not deleted');
    const published = (await rows(`select content from public.site_content where id = 'published'`))[0].content;
    for (const photo of published.gallery.photos.filter((p) => p.src.startsWith('http'))) expect((await fetch(photo.src)).ok, 'a photograph that is in use was deleted');
    expect((await fetch(published.music.url)).ok, 'the music that is in use was deleted');
  });
  await check('the password can be changed, and the old one stops working', async () => {
    await field(admin, 'New password').fill('a-brand-new-password');
    await field(admin, 'New password, once more').fill('a-brand-new-password');
    await admin.getByRole('button', { name: 'Change password' }).click();
    await until(async () => /password has been changed/i.test(await toastText()), 'no confirmation of the password change');
    const old = await fetch(`${API}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(ADMIN) });
    equal(old.status, 400, 'signing in with the old password');
    const fresh = await fetch(`${API}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: ADMIN.email, password: 'a-brand-new-password' }) });
    equal(fresh.status, 200, 'signing in with the new password');
  });

  /* ================================================================== */
  group('16. WhatsApp link and preview');
  const html = fs.readFileSync(path.join(ROOT, 'dist-e2e/index.html'), 'utf8');
  const meta = (property) => (new RegExp(`<meta (?:property|name)="${property}" content="([^"]*)"`).exec(html) || [])[1];
  await check('the page carries a proper title, description and absolute thumbnail address', async () => {
    equal(meta('og:title'), 'Nitin Kaushik &amp; Shaifali Singh | Wedding Invitation', 'og:title');
    expect(meta('og:description').includes('Saturday, 5 December 2026'), 'og:description lacks the date');
    equal(meta('og:image'), 'https://shaifali-nitin.example/og-image.jpg', 'og:image');
    equal(meta('og:url'), 'https://shaifali-nitin.example/', 'og:url');
    equal(meta('og:type'), 'website', 'og:type');
    equal(meta('twitter:card'), 'summary_large_image', 'twitter:card');
    expect(/<title>Nitin Kaushik &amp; Shaifali Singh \| Wedding Invitation<\/title>/.test(html), 'the page title is wrong');
  });
  await check('the preview tags are in the page itself, so WhatsApp can read them without running scripts', async () => {
    const raw = await (await fetch(SITE, { headers: { 'User-Agent': 'WhatsApp/2.23.20.0' } })).text();
    expect(raw.includes('property="og:image"') && raw.includes('property="og:title"'), 'the tags are missing from the served page');
  });
  await check('the thumbnail is a 1200 by 630 image under 300 KB and is served', async () => {
    const response = await fetch(`${SITE}/og-image.jpg`);
    expect(response.ok && response.headers.get('content-type') === 'image/jpeg', 'the thumbnail is not served');
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.length < 300 * 1024, `the thumbnail is ${Math.round(bytes.length / 1024)} KB`);
    const p = await adminContext.newPage();
    await p.goto(`${SITE}/og-image.jpg`);
    equal(await p.evaluate(() => [document.images[0].naturalWidth, document.images[0].naturalHeight]), [1200, 630], 'thumbnail size');
    await p.close();
  });
  await check('the share button opens WhatsApp with the message and the invitation link', async () => {
    const fresh = await guestContext();
    const p = await fresh.newPage();
    await p.goto(`${SITE}/?skipCover`, { waitUntil: 'networkidle' });
    const share = new URL(await p.getByTestId('whatsapp-share').getAttribute('href'));
    equal(share.origin + share.pathname, 'https://wa.me/', 'share address');
    const text = share.searchParams.get('text');
    expect(text.includes('We are getting married!') && text.includes('https://shaifali-nitin.example/') && text.includes('Nitin & Shaifali') && !text.includes('{link}'), `unexpected share text: ${text}`);
    await fresh.close();
  });
  await check('the shared link opens the invitation, and a link to #rsvp lands on the RSVP form', async () => {
    const fresh = await guestContext();
    const p = await fresh.newPage();
    await p.goto(`${SITE}/#rsvp`, { waitUntil: 'networkidle' });
    await p.getByTestId('cover').waitFor();
    await p.getByTestId('open-invitation').click();
    await p.getByTestId('cover').waitFor({ state: 'detached', timeout: 6000 });
    await until(async () => {
      const top = await p.locator('#rsvp').evaluate((el) => el.getBoundingClientRect().top);
      return Math.abs(top) < 200;
    }, 'the page did not go to the RSVP section');
    await fresh.close();
  });
  await check('search engines are asked not to list the invitation', async () => {
    equal(meta('robots'), 'noindex, nofollow', 'robots tag');
  });

  /* ================================================================== */
  group('17. Mobile responsiveness');
  const sizes = [
    ['small Android phone', 360, 640],
    ['iPhone SE', 375, 667],
    ['modern phone', 412, 915],
    ['tablet', 768, 1024],
    ['laptop', 1366, 768],
  ];
  for (const [label, width, height] of sizes) {
    await check(`${label} (${width} by ${height}): nothing overflows sideways and every button is easy to tap`, async () => {
      const sized = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: width < 700, hasTouch: width < 1000 });
      const p = await sized.newPage();
      await p.goto(SITE, { waitUntil: 'networkidle' });
      const cover = await p.getByTestId('open-invitation').boundingBox();
      expect(cover.y + cover.height <= height && cover.x >= 0 && cover.x + cover.width <= width, 'the Open Invitation button is not fully on screen');
      await p.getByTestId('open-invitation').click();
      await p.getByTestId('cover').waitFor({ state: 'detached', timeout: 6000 });
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow <= 1, `the page is ${overflow}px wider than the screen`);
      const small = await p.evaluate(() =>
        Array.from(document.querySelectorAll('main a, main button, footer a, footer button, nav a'))
          .filter((el) => el.offsetParent !== null && !el.closest('.sr-only'))
          .map((el) => ({ text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30), h: Math.round(el.getBoundingClientRect().height) }))
          .filter((item) => item.h > 0 && item.h < 24),
      );
      equal(small, [], 'controls that are too small to tap');
      const tiny = await p.evaluate(() =>
        Array.from(document.querySelectorAll('main p, main li, main address, footer p'))
          .filter((el) => el.offsetParent !== null && el.textContent.trim().length > 20)
          .map((el) => parseFloat(getComputedStyle(el).fontSize))
          .filter((size) => size < 12).length,
      );
      equal(tiny, 0, 'paragraphs with text smaller than 12px');
      if (width === 360 || width === 1366) {
        await p.screenshot({ path: path.join(SHOTS, `size-${width}-welcome.png`) });
      }
      await sized.close();
    });
  }
  await check('the dashboard works on a phone: menu, editing and publishing bar', async () => {
    const phone = await browser.newContext({ ...devices['Pixel 7'] });
    const p = await phone.newPage();
    await p.goto(`${SITE}/admin`, { waitUntil: 'networkidle' });
    await signIn(p, { email: ADMIN.email, password: 'a-brand-new-password' });
    await p.getByTestId('dashboard').waitFor({ timeout: 10000 });
    await p.getByTestId('menu-button').click();
    await p.getByRole('dialog', { name: 'Dashboard menu' }).getByTestId('nav-events').click();
    await p.getByTestId('event-toggle').first().click();
    expect(await p.getByLabel('Event name', { exact: true }).isVisible(), 'the event editor is not usable on a phone');
    expect((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1, 'the dashboard overflows sideways on a phone');
    expect(await p.getByTestId('publish').isVisible() && (await p.getByTestId('save').isVisible()), 'the publishing buttons are not reachable on a phone');
    await p.screenshot({ path: path.join(SHOTS, '19-admin-phone.png') });
    await phone.close();
  });

  /* ================================================================== */
  group('18. Security and permissions');
  const anon = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' };
  const tokenFor = async (who) => (await (await fetch(`${API}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(who) })).json()).access_token;
  const strangerToken = await tokenFor(STRANGER);
  const strangerHeaders = { apikey: ANON_KEY, Authorization: `Bearer ${strangerToken}`, 'Content-Type': 'application/json' };
  const publishedBefore = JSON.stringify((await rows(`select content from public.site_content where id = 'published'`))[0].content);

  await check('a guest cannot change or delete website content', async () => {
    const patch = await fetch(`${API}/rest/v1/site_content?id=eq.published`, { method: 'PATCH', headers: { ...anon, Prefer: 'return=representation' }, body: JSON.stringify({ content: { hacked: true } }) });
    expect(patch.status === 401 || patch.status === 403, `changing content returned ${patch.status}`);
    const remove = await fetch(`${API}/rest/v1/site_content?id=eq.published`, { method: 'DELETE', headers: anon });
    expect(remove.status === 401 || remove.status === 403, `deleting content returned ${remove.status}`);
    const publish = await fetch(`${API}/rest/v1/rpc/publish_site`, { method: 'POST', headers: anon, body: '{}' });
    expect(publish.status === 401 || publish.status === 403, `publishing returned ${publish.status}`);
    equal(JSON.stringify((await rows(`select content from public.site_content where id = 'published'`))[0].content), publishedBefore, 'published content after the attempts');
  });
  await check('a guest cannot upload, list or delete files', async () => {
    const upload = await fetch(`${API}/storage/v1/object/media/images/guest.jpg`, { method: 'POST', headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'image/jpeg' }, body: Buffer.from([0xff, 0xd8, 0xff]) });
    expect(upload.status >= 400, `a guest upload returned ${upload.status}`);
    const list = await (await fetch(`${API}/storage/v1/object/list/media`, { method: 'POST', headers: anon, body: JSON.stringify({ prefix: 'images' }) })).json();
    equal(list, [], 'file list a guest receives');
    const before = (await rows('select count(*)::int as n from storage.objects'))[0].n;
    await fetch(`${API}/storage/v1/object/media`, { method: 'DELETE', headers: anon, body: JSON.stringify({ prefixes: (await rows('select name from storage.objects')).map((r) => r.name) }) });
    equal((await rows('select count(*)::int as n from storage.objects'))[0].n, before, 'files after a guest tried to delete them');
  });
  await check('a signed-in account that is not an administrator has no more power than a guest', async () => {
    const draft = await (await fetch(`${API}/rest/v1/site_content?id=eq.draft&select=content`, { headers: strangerHeaders })).json();
    equal(draft, [], 'draft visible to a non-administrator');
    const list = await (await fetch(`${API}/rest/v1/rsvps?select=*`, { headers: strangerHeaders })).json();
    equal(list, [], 'RSVPs visible to a non-administrator');
    const patch = await (await fetch(`${API}/rest/v1/site_content?id=eq.published`, { method: 'PATCH', headers: { ...strangerHeaders, Prefer: 'return=representation' }, body: JSON.stringify({ content: { hacked: true } }) })).json();
    equal(patch, [], 'rows a non-administrator could change');
    const publish = await fetch(`${API}/rest/v1/rpc/publish_site`, { method: 'POST', headers: strangerHeaders, body: '{}' });
    equal(publish.status, 403, 'publishing as a non-administrator');
    const upload = await fetch(`${API}/storage/v1/object/media/images/stranger.jpg`, { method: 'POST', headers: { apikey: ANON_KEY, Authorization: `Bearer ${strangerToken}`, 'Content-Type': 'image/jpeg' }, body: Buffer.from([0xff, 0xd8, 0xff]) });
    expect(upload.status >= 400, `upload as a non-administrator returned ${upload.status}`);
    const grant = await fetch(`${API}/rest/v1/rpc/grant_admin`, { method: 'POST', headers: strangerHeaders, body: JSON.stringify({ admin_email: STRANGER.email }) });
    expect(grant.status === 403 || grant.status === 401, `granting oneself admin returned ${grant.status}`);
    equal((await rows('select count(*)::int as n from public.admins'))[0].n, 1, 'number of administrators');
    equal(JSON.stringify((await rows(`select content from public.site_content where id = 'published'`))[0].content), publishedBefore, 'published content after the attempts');
  });
  await check('requests without the website\'s key, or with a forged token, are refused', async () => {
    equal((await fetch(`${API}/rest/v1/site_content?select=*`)).status, 401, 'request without a key');
    const forged = `${ANON_KEY.split('.').slice(0, 2).join('.')}.forged-signature`;
    equal((await fetch(`${API}/rest/v1/rsvps?select=*`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${forged}` } })).status, 401, 'request with a forged token');
  });
  await check('the built website contains no secret key, password or service credentials', async () => {
    const assets = path.join(ROOT, 'dist-e2e/assets');
    const bundle = fs.readdirSync(assets).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(assets, f), 'utf8')).join('\n') + html;
    for (const forbidden of [emulator.serviceKey, ADMIN.password, 'a-brand-new-password', 'SUPABASE_SERVICE', 'service_role_key']) {
      expect(!bundle.includes(forbidden), `the bundle contains "${forbidden.slice(0, 24)}"`);
    }
    // The code mentions the prefix "sb_secret_" in order to detect such a key; an actual key would have characters after it.
    expect(!/sb_secret_[A-Za-z0-9]{8,}/.test(bundle), 'the bundle contains a Supabase secret key');
    expect(!/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl/.test(bundle), 'the bundle contains a service_role token');
    expect(bundle.includes(ANON_KEY), 'the public key should be in the bundle (that is expected and safe)');
  });
  await check('guests do not download the dashboard code', async () => {
    const fresh = await guestContext();
    const p = await fresh.newPage();
    const scripts = [];
    p.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(request.url());
    });
    await openInvitation(p);
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(800);
    expect(!scripts.some((url) => /AdminApp/.test(url)), 'the dashboard script was loaded for a guest');
    await fresh.close();
  });
  await check('text typed in the dashboard cannot inject scripts into the guest page', async () => {
    const evil = '<img src=x onerror="window.__hacked=1"><script>window.__hacked=1</script>';
    await db.query(
      `update public.site_content set content = jsonb_set(jsonb_set(content, '{welcome,message}', to_jsonb($1::text)), '{footer,socials}', $2::jsonb) where id = 'published'`,
      [evil, JSON.stringify([{ id: 's1', label: 'Bad link', url: 'javascript:window.__hacked=1' }])],
    );
    const fresh = await guestContext();
    const p = await fresh.newPage();
    await p.goto(`${SITE}/?skipCover`, { waitUntil: 'networkidle' });
    expect((await p.locator('#welcome').innerText()).includes('<img src=x'), 'the text should be shown literally');
    equal(await p.evaluate(() => window.__hacked), undefined, 'injected script ran');
    equal(await p.locator('footer a', { hasText: 'Bad link' }).count(), 0, 'unsafe links shown');
    await fresh.close();
    await db.query(`update public.site_content set content = $1::jsonb where id = 'published'`, [publishedBefore]);
  });
  await check('if the database cannot be reached, the invitation still opens with its built-in content', async () => {
    const offline = await guestContext();
    await offline.route(`${API}/**`, (route) => route.abort());
    const p = await offline.newPage();
    await p.goto(SITE, { waitUntil: 'load' });
    await p.getByTestId('open-invitation').waitFor({ timeout: 12000 });
    expect((await p.getByTestId('cover').innerText()).includes('Shaifali Singh'), 'the cover did not render offline');
    await offline.close();
  });

  /* ================================================================== */
  group('Browser health');
  await check('no script errors were raised in the browser at any point in the run', async () => {
    equal([...new Set(pageErrors)], [], 'errors seen in the browser');
  });

  await adminContext.close();
  await browser.close();
  server.kill();
  await emulator.close();

  const failed = results.filter((result) => !result.ok);
  console.log('\n' + '='.repeat(64));
  console.log(`${results.length - failed.length} of ${results.length} checks passed.`);
  if (pageErrors.length) console.log(`Browser errors seen:\n  ${[...new Set(pageErrors)].slice(0, 12).join('\n  ')}`);
  if (failed.length) {
    console.log('\nFailed:');
    for (const result of failed) console.log(`  [${result.group}] ${result.name}\n      ${result.error}`);
  }
  fs.writeFileSync(path.join(__dirname, 'last-run.json'), JSON.stringify({ at: new Date().toISOString(), passed: results.length - failed.length, total: results.length, results, pageErrors: [...new Set(pageErrors)] }, null, 2));
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
