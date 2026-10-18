/* Verification for the rotating science login backdrop + frosted card. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8322;
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = path.join(__dirname, 'shots-login');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png' };

function serve() {
    return new Promise(res => {
        const srv = http.createServer((req, r) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            const f = path.normalize(path.join(ROOT, p));
            if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end('x'); return; }
            r.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
            fs.createReadStream(f).pipe(r);
        });
        srv.listen(PORT, '127.0.0.1', () => res(srv));
    });
}

const results = [];
const shot = n => path.join(SHOTS, n + '.png');
function check(label, ok, detail) {
    results.push({ label, ok: !!ok, detail: detail || '' });
    if (!ok) console.log('  FAIL  ' + label + (detail ? '  [' + detail + ']' : ''));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function setPrefs(page, { design, accent, mode }) {
    await page.evaluate(({ design, accent, mode }) => {
        localStorage.clear();
        if (design) localStorage.setItem('sbte_design', design);
        if (accent) localStorage.setItem('sbte_accent', accent);
        if (mode) localStorage.setItem('sbte_theme', mode);
    }, { design, accent, mode });
    for (let i = 0; i < 3; i++) {
        try {
            await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
            break;
        } catch (e) {
            if (i === 2) throw e;
            await sleep(600);
        }
    }
    await sleep(350);
}

const snapshot = page => page.evaluate(() => {
    const overlay = document.getElementById('loginOverlay');
    const card = document.querySelector('.login-card');
    const cs = getComputedStyle(card);
    const onLayer = overlay.querySelector('.sci-layer.on');
    return {
        scene: overlay.getAttribute('data-scene'),
        onLayer: onLayer ? onLayer.getAttribute('data-scene') : null,
        onCount: overlay.querySelectorAll('.sci-layer.on').length,
        layerCount: overlay.querySelectorAll('.sci-layer').length,
        itemCount: overlay.querySelectorAll('.sci-item').length,
        figCount: overlay.querySelectorAll('.sci-fig').length,
        dotCount: overlay.querySelectorAll('.sci-dot').length,
        dots: [...overlay.querySelectorAll('.sci-dot')].map(d => d.getAttribute('aria-pressed')),
        label: (overlay.querySelector('.sci-label') || {}).textContent,
        subjects: (document.querySelector('.login-subjects') || {}).textContent,
        cardBg: cs.backgroundColor,
        cardBorder: cs.borderTopColor,
        blur: cs.backdropFilter || cs.webkitBackdropFilter || '',
        navVisible: !!document.querySelector('.sci-nav') && getComputedStyle(document.querySelector('.sci-nav')).display !== 'none',
        navBorder: getComputedStyle(document.querySelector('.sci-nav')).borderTopColor,
        navBg: getComputedStyle(document.querySelector('.sci-nav')).backgroundColor,
        subjectsColor: getComputedStyle(document.querySelector('.login-subjects')).color
    };
});

function alphaOf(col) {
    const s = String(col);
    // Chromium may serialise colour-mix as "color(srgb r g b / a)"
    let m = s.match(/\/\s*([\d.]+)\s*\)/);
    if (m) return parseFloat(m[1]);
    m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return 1;
    const parts = m[1].split(',').map(x => parseFloat(x));
    return parts.length > 3 ? parts[3] : 1;
}

async function main() {
    fs.mkdirSync(SHOTS, { recursive: true });
    const srv = await serve();
    const browser = await puppeteer.launch({
        executablePath: EDGE, headless: 'new',
        userDataDir: path.join(require('os').tmpdir(), 'sbte-verify-profile'),
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    const consoleErrors = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });

    /* ---------- 1. markup + card blend across every design and mode ---------- */
    console.log('== backdrop + frosted card per design/mode ==');
    for (const design of ['classic', 'minimal', 'neumorphic', 'glass', 'brutalist']) {
        for (const mode of ['light', 'dark']) {
            await setPrefs(page, { design, accent: 'blue', mode });
            const s = await snapshot(page);
            const tag = `${design}/${mode}`;
            check(tag + ' has 3 science layers', s.layerCount === 3, String(s.layerCount));
            check(tag + ' exactly one layer visible', s.onCount === 1 && s.onLayer === s.scene, JSON.stringify({ on: s.onLayer, scene: s.scene }));
            check(tag + ' formulas + figures present', s.itemCount >= 6 && s.figCount >= 3, `items=${s.itemCount} figs=${s.figCount}`);
            check(tag + ' card is translucent (blends with backdrop)', alphaOf(s.cardBg) < 0.95, s.cardBg);
            check(tag + ' card is frosted (backdrop blur)', /blur/.test(s.blur), s.blur);
            check(tag + ' scene switch nav visible with 3 dots', s.navVisible && s.dotCount === 3, JSON.stringify({ nav: s.navVisible, dots: s.dotCount }));
            check(tag + ' subject caption lists all three sciences',
                /Mathematics/i.test(s.subjects) && /Physics/i.test(s.subjects) && /Chemistry/i.test(s.subjects), s.subjects);
            check(tag + ' caption is scene-tinted', s.subjectsColor !== 'rgb(15, 23, 42)' && s.subjectsColor !== 'rgb(241, 245, 249)', s.subjectsColor);
        }
    }

    /* ---------- 2. auto-rotation every 5s ---------- */
    console.log('== 5s auto-rotation ==');
    await setPrefs(page, { design: 'neumorphic', accent: 'blue', mode: 'light' });
    const t0 = await snapshot(page);
    check('starts on Mathematics', t0.scene === 'math' && t0.label === 'Mathematics', JSON.stringify({ s: t0.scene, l: t0.label }));
    check('dot 1 pressed initially', t0.dots[0] === 'true' && t0.dots[1] === 'false' && t0.dots[2] === 'false');
    check('only the active layer is shown', t0.onCount === 1 && t0.onLayer === 'math', JSON.stringify({ on: t0.onLayer }));

    // poll the scene for ~17s and record when it changes (robust to timer jitter)
    const changes = [];
    let prevScene = t0.scene;
    const start = Date.now();
    let physicsShot = false;
    while (Date.now() - start < 17000) {
        await sleep(200);
        const cur = await page.evaluate(() => document.getElementById('loginOverlay').getAttribute('data-scene'));
        if (cur !== prevScene) {
            changes.push({ scene: cur, at: Date.now() - start });
            prevScene = cur;
            if (cur === 'physics' && !physicsShot) { physicsShot = true; await page.screenshot({ path: shot('rotate_physics_neumorphic_light') }); }
        }
    }
    const seq = changes.map(c => c.scene);
    check('scene changes roughly every 5s', changes.length >= 3 && changes.every(c => c.at > 4200) && changes.length <= 4,
        JSON.stringify(changes));
    check('scene advances without repeats', seq.length >= 3 && seq.every((s, i) => i === 0 || s !== seq[i - 1]), seq.join('>'));
    check('all three scenes appear', ['math', 'physics', 'chem'].every(s => seq.includes(s)), seq.join('>'));
    const t1 = await snapshot(page);
    check('label follows the active scene',
        t1.label === ({ math: 'Mathematics', physics: 'Physics', chem: 'Chemistry' })[t1.scene], t1.label);
    check('pressed dot follows the active scene',
        t1.dots[['math', 'physics', 'chem'].indexOf(t1.scene)] === 'true', JSON.stringify({ scene: t1.scene, dots: t1.dots }));
    await page.evaluate(() => document.querySelector('.sci-dot[data-scene="chem"]').click());
    await sleep(500);
    await page.screenshot({ path: shot('rotate_chem_neumorphic_light') });

    /* ---------- 3. card tints itself to match the scene ---------- */
    console.log('== card matches scene colour ==');
    const perScene = {};
    for (const sc of ['math', 'physics', 'chem']) {
        await page.evaluate(s => document.querySelector(`.sci-dot[data-scene="${s}"]`).click(), sc);
        await sleep(650);   // let the 380ms colour transition settle
        perScene[sc] = await snapshot(page);
        check(`clicking dot switches to ${sc}`, perScene[sc].scene === sc && perScene[sc].onLayer === sc, perScene[sc].scene);
    }
    check('card border changes with the scene',
        perScene.math.cardBorder !== perScene.physics.cardBorder && perScene.physics.cardBorder !== perScene.chem.cardBorder,
        JSON.stringify({ math: perScene.math.cardBorder, phys: perScene.physics.cardBorder, chem: perScene.chem.cardBorder }));
    check('caption colour changes with the scene',
        perScene.math.subjectsColor !== perScene.physics.subjectsColor && perScene.physics.subjectsColor !== perScene.chem.subjectsColor,
        JSON.stringify({ math: perScene.math.subjectsColor, phys: perScene.physics.subjectsColor, chem: perScene.chem.subjectsColor }));
    check('nav pill border changes with the scene',
        perScene.math.navBorder !== perScene.physics.navBorder && perScene.physics.navBorder !== perScene.chem.navBorder,
        JSON.stringify({ math: perScene.math.navBorder, phys: perScene.physics.navBorder, chem: perScene.chem.navBorder }));

    /* ---------- 4. technical-drawing screenshots for eyeballing ---------- */
    console.log('== screenshots ==');
    const SCENES = ['math', 'physics', 'chem'];
    for (const design of ['classic', 'minimal', 'neumorphic', 'glass', 'brutalist']) {
        for (const mode of ['light', 'dark']) {
            await setPrefs(page, { design, accent: 'blue', mode });
            for (const sc of SCENES) {
                await page.evaluate(s => document.querySelector(`.sci-dot[data-scene="${s}"]`).click(), sc);
                await sleep(500);
                await page.screenshot({ path: shot(`login_${design}_${mode}_${sc}`) });
            }
        }
    }
    // mobile + accent variants
    await page.setViewport({ width: 390, height: 800 });
    await setPrefs(page, { design: 'neumorphic', accent: 'pink', mode: 'light' });
    await sleep(400);
    await page.screenshot({ path: shot('login_mobile_math') });
    await page.evaluate(() => document.querySelector('.sci-dot[data-scene="chem"]').click());
    await sleep(500);
    await page.screenshot({ path: shot('login_mobile_chem') });
    await page.setViewport({ width: 1440, height: 900 });

    /* ---------- 5. sign-in still works and rotation stops ---------- */
    console.log('== sign-in still works ==');
    await setPrefs(page, { design: 'neumorphic', accent: 'blue', mode: 'light' });
    await page.type('#adminUser', 'admin');
    await page.type('#adminPass', '123');
    await page.click('#adminLoginBtn');
    await page.waitForSelector('#app', { visible: true });
    await sleep(400);
    const authed = await page.evaluate(() => ({
        authed: document.documentElement.classList.contains('is-authed'),
        overlayHidden: getComputedStyle(document.getElementById('loginOverlay')).display === 'none'
    }));
    check('admin signs in', authed.authed);
    check('login overlay hidden after sign-in', authed.overlayHidden);

    /* ---------- 6. console health ---------- */
    const realErrors = consoleErrors.filter(e =>
        !/localhost:3000|127\.0\.0\.1:3000|ERR_CONNECTION_REFUSED|net::ERR|Failed to load resource|fonts\.googleapis|fonts\.gstatic|unpkg|gstatic/i.test(e));
    check('no JS console errors (offline noise filtered)', realErrors.length === 0, realErrors.slice(0, 5).join(' | '));

    await browser.close();
    srv.close();

    const failed = results.filter(r => !r.ok);
    console.log('\n========================================');
    console.log(`TOTAL: ${results.length} checks, FAILED: ${failed.length}`);
    failed.forEach(f => console.log('  - ' + f.label + '  [' + f.detail + ']'));
    console.log('Screenshots: ' + fs.readdirSync(SHOTS).length + ' in verify/shots-login');
    process.exit(failed.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
