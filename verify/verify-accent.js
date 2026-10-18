/* Headless verification of the theme-colour (accent) feature.
   Serves the app over a tiny static server, drives Edge via puppeteer-core
   and checks every design x accent x mode combination (60), the picker UI,
   persistence, reset-to-blue, "must not change" colours and console health.
   Screenshots land in verify/shots/. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8321;
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = path.join(__dirname, 'shots');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

function serve() {
    return new Promise(res => {
        const srv = http.createServer((req, r) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            const f = path.normalize(path.join(ROOT, p));
            if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end('not found'); return; }
            r.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
            fs.createReadStream(f).pipe(r);
        });
        srv.listen(PORT, '127.0.0.1', () => res(srv));
    });
}

/* Blue expectations are per design: each design owns its blue palette
   (that is its identity), so the sweep records each design's blue baseline
   and asserts the five non-blue accents against the exact block values. */
const EXPECT_NONBLUE = {
    light: {
        red: { sky: '#e5484d', skyDark: '#d13438', on: '#ffffff' },
        yellow: { sky: '#ca8a04', skyDark: '#a16207', on: '#1f1400' },
        green: { sky: '#2fa36b', skyDark: '#1b7d51', on: '#ffffff' },
        pink: { sky: '#ec4899', skyDark: '#db2777', on: '#ffffff' },
        brown: { sky: '#a47148', skyDark: '#8b5a2b', on: '#ffffff' }
    },
    dark: {
        red: { sky: '#f1575c', skyDark: '#d9363b', on: '#ffffff' },
        yellow: { sky: '#facc15', skyDark: '#eab308', on: '#1f1400' },
        green: { sky: '#4cc38a', skyDark: '#2fa36b', on: '#04210e' },
        pink: { sky: '#ee63a8', skyDark: '#db2777', on: '#ffffff' },
        brown: { sky: '#be9062', skyDark: '#9a6b3f', on: '#ffffff' }
    }
};

const DESIGNS = ['classic', 'minimal', 'neumorphic', 'glass', 'brutalist'];
const ACCENTS = ['blue', 'red', 'yellow', 'green', 'pink', 'brown'];
const MODES = ['light', 'dark'];

const results = [];
const shot = (name) => path.join(SHOTS, name.replace(/[^\w.-]+/g, '_') + '.png');

function check(label, ok, detail) {
    results.push({ label, ok: !!ok, detail: detail || '' });
    if (!ok) console.log('  FAIL  ' + label + (detail ? '  [' + detail + ']' : ''));
    return !!ok;
}

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
            await new Promise(r => setTimeout(r, 500));
        }
    }
    await new Promise(r => setTimeout(r, 250));
}

function tokens(page) {
    return page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        const g = n => (cs.getPropertyValue(n) || '').trim().toLowerCase();
        const hex = v => {
            let m = v.match(/^#([0-9a-f]{3})$/);
            if (m) return '#' + m[1].split('').map(c => c + c).join('');
            m = v.match(/^#([0-9a-f]{6})$/);
            if (m) return '#' + m[1];
            return v;
        };
        return {
            accent: document.documentElement.getAttribute('data-accent'),
            design: document.documentElement.getAttribute('data-design'),
            theme: document.documentElement.getAttribute('data-theme'),
            sky: hex(g('--sky')),
            skyDark: hex(g('--sky-dark')),
            on: hex(g('--on-accent')),
            ruleBlue: g('--rule-blue')
        };
    });
}

async function reloadSafe(page) {
    try { await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }); }
    catch (e) { await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); }
    await new Promise(r => setTimeout(r, 350));
}

async function main() {
    fs.mkdirSync(SHOTS, { recursive: true });
    const srv = await serve();
    const browser = await puppeteer.launch({
        executablePath: EDGE,
        headless: 'new',
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    /* console health: fail only on real JS errors, not on the offline
       API server / Google Fonts / Firebase being unreachable */
    const consoleErrors = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });

    /* ---------- 1. all 60 design x mode x accent combos on the login page ---------- */
    console.log('== 60-combination token sweep (login screen) ==');
    const blueBaseline = {};   // design/mode -> tokens under the blue accent
    for (const design of DESIGNS) {
        for (const mode of MODES) {
            for (const accent of ACCENTS) {
                await setPrefs(page, { design, accent, mode });
                const t = await tokens(page);
                const label = `${design}/${mode}/${accent}`;
                check(label + ' data-accent', t.accent === accent, t.accent);
                if (accent === 'blue') {
                    blueBaseline[design + '/' + mode] = t;   // blue is the design's own identity
                    continue;
                }
                const e = EXPECT_NONBLUE[mode][accent];
                check(label + ' --sky', t.sky === e.sky, `${t.sky} != ${e.sky}`);
                check(label + ' --sky-dark', t.skyDark === e.skyDark, `${t.skyDark} != ${e.skyDark}`);
                check(label + ' --on-accent', t.on === e.on, `${t.on} != ${e.on}`);
                const base = blueBaseline[design + '/' + mode];
                check(label + ' --sky differs from this design\'s blue', !!base && t.sky !== base.sky, t.sky);
            }
        }
    }

    /* ---------- 2. brutalist keeps its ink rule-lines in every accent ---------- */
    console.log('== brutalist rule-blue restoration ==');
    for (const accent of ACCENTS) {
        await setPrefs(page, { design: 'brutalist', accent, mode: 'light' });
        let t = await tokens(page);
        check(`brutalist/light/${accent} rule-blue #111`, t.ruleBlue === '#111111', t.ruleBlue);
        await page.evaluate(() => localStorage.setItem('sbte_theme', 'dark'));
        await page.reload({ waitUntil: 'domcontentloaded' });
        t = await tokens(page);
        check(`brutalist/dark/${accent} rule-blue #f2f2f2`, t.ruleBlue === '#f2f2f2', t.ruleBlue);
    }

    /* ---------- 3. login-page screenshots: every design with the red accent ---------- */
    console.log('== login screenshots ==');
    for (const design of DESIGNS) {
        await setPrefs(page, { design, accent: 'red', mode: 'light' });
        await page.screenshot({ path: shot(`login_${design}_red_light`) });
    }
    await setPrefs(page, { design: 'neumorphic', accent: 'yellow', mode: 'dark' });
    await page.screenshot({ path: shot('login_neumorphic_yellow_dark') });

    /* ---------- 4. picker UI behaviour (as admin) ---------- */
    console.log('== design-dialog picker ==');
    await setPrefs(page, { design: 'neumorphic', accent: 'blue', mode: 'light' });
    await page.type('#adminUser', 'admin');
    await page.type('#adminPass', '123');
    await page.click('#adminLoginBtn');
    await page.waitForSelector('#app', { visible: true });
    await new Promise(r => setTimeout(r, 400));

    await page.click('#designBtn');
    await page.waitForSelector('#designPicker');
    const swatchInfo = await page.evaluate(() => {
        const sw = [...document.querySelectorAll('#designPicker .ac-swatch')];
        return {
            count: sw.length,
            names: sw.map(s => s.getAttribute('aria-label')),
            tags: sw.map(s => s.tagName),
            pressed: sw.map(s => s.getAttribute('aria-pressed'))
        };
    });
    check('picker has 6 swatches', swatchInfo.count === 6, JSON.stringify(swatchInfo.names));
    check('swatches are real buttons', swatchInfo.tags.every(t => t === 'BUTTON'));
    check('blue pressed by default', swatchInfo.pressed[0] === 'true' && swatchInfo.pressed.slice(1).every(p => p === 'false'));

    await page.click('#designPicker .ac-swatch[data-a="pink"]');
    const afterPick = await page.evaluate(() => ({
        accent: document.documentElement.getAttribute('data-accent'),
        stored: localStorage.getItem('sbte_accent'),
        pressed: [...document.querySelectorAll('#designPicker .ac-swatch')].map(s => s.getAttribute('aria-pressed')),
        ring: getComputedStyle(document.querySelector('#designPicker .ac-swatch[data-a="pink"]')).boxShadow
    }));
    check('click sets data-accent', afterPick.accent === 'pink', afterPick.accent);
    check('click stores sbte_accent', afterPick.stored === 'pink', afterPick.stored);
    check('aria-pressed moves to pink', afterPick.pressed[4] === 'true' && afterPick.pressed[0] === 'false', afterPick.pressed.join(','));
    check('selected swatch gets ring', afterPick.ring && afterPick.ring !== 'none', afterPick.ring);
    await page.screenshot({ path: shot('dialog_picker_pink') });

    /* keyboard: swatch reachable by Tab and operable with Enter */
    await page.focus('#designPicker .ac-swatch[data-a="green"]');
    await page.keyboard.press('Enter');
    const kbAccent = await page.evaluate(() => document.documentElement.getAttribute('data-accent'));
    check('keyboard Enter picks accent', kbAccent === 'green', kbAccent);
    await page.keyboard.press('Escape');
    check('Escape closes dialog', await page.evaluate(() => !document.getElementById('designPicker')));

    /* ---------- 5. charts actually re-render with accent colours ---------- */
    console.log('== chart re-render ==');
    await setPrefs(page, { design: 'classic', accent: 'blue', mode: 'light' });
    await page.type('#adminUser', 'admin');
    await page.type('#adminPass', '123');
    await page.click('#adminLoginBtn');
    await new Promise(r => setTimeout(r, 500));
    const blueBar = await page.evaluate(() => ({
        fills: [...document.querySelectorAll('#dashOverview svg rect[fill]')].map(r => r.getAttribute('fill')),
        stops: [...document.querySelectorAll('#dashOverview svg stop[stop-color]')].map(s => s.getAttribute('stop-color'))
    }));
    await page.click('#designBtn');
    await page.waitForSelector('#designPicker');
    await page.click('#designPicker .ac-swatch[data-a="red"]');
    await new Promise(r => setTimeout(r, 250));
    const redBar = await page.evaluate(() => ({
        fills: [...document.querySelectorAll('#dashOverview svg rect[fill]')].map(r => r.getAttribute('fill')),
        stops: [...document.querySelectorAll('#dashOverview svg stop[stop-color]')].map(s => s.getAttribute('stop-color'))
    }));
    check('dashboard chart colours are var(--sky*)',
        blueBar.fills.some(f => /^var\(--sky/.test(f)) || blueBar.stops.some(s => /^var\(--sky/.test(s)),
        JSON.stringify({ fills: blueBar.fills.slice(0, 4), stops: blueBar.stops.slice(0, 4) }));
    const norm = d => ({
        fills: d.fills.map(f => /^url\(/.test(f) ? 'url(#gid)' : f),
        stops: d.stops
    });
    check('chart still var-based after switch (live recolour)',
        JSON.stringify(norm(blueBar)) === JSON.stringify(norm(redBar)),
        JSON.stringify(norm(redBar)));
    await page.keyboard.press('Escape');

    /* ---------- 6. must-not-change colours: sample under blue vs red ---------- */
    console.log('== invariant colours ==');
    const sample = () => page.evaluate(() => {
        const cs = sel => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const s = getComputedStyle(el);
            return { bg: s.backgroundColor, color: s.color, bgi: s.backgroundImage };
        };
        return {
            good: cs('.badge.good'),
            excellent: cs('.badge.excellent'),
            needs: cs('.badge.needs'),
            p: cs('.at-cell.p'),
            t: cs('.at-cell.t'),
            l: cs('.at-cell.l'),
            a: cs('.at-cell.a'),
            danger: cs('.btn.danger'),
            dangerSolid: cs('.btn.danger-solid'),
            room: cs('.st-room'),
            primary: cs('.btn.primary')
        };
    });
    await setPrefs(page, { design: 'classic', accent: 'blue', mode: 'light' });
    await page.type('#adminUser', 'admin');
    await page.type('#adminPass', '123');
    await page.click('#adminLoginBtn');
    await new Promise(r => setTimeout(r, 400));
    // populate report/batch/attendance/seating views
    const views = ['report', 'batch', 'notes', 'simulations', 'seating', 'attendance', 'policy', 'dashboard'];
    for (const v of views) {
        await page.click(`#tabs button[data-view="${v}"]`);
        await new Promise(r => setTimeout(r, 220));
    }
    const ref = await sample();
    await page.evaluate(() => { localStorage.setItem('sbte_accent', 'red'); });
    await reloadSafe(page);
    const alt = await sample();
    for (const key of ['good', 'excellent', 'needs', 'p', 't', 'l', 'a', 'danger', 'dangerSolid', 'room']) {
        if (!ref[key]) { results.push({ label: `invariant ${key}`, ok: true, detail: 'element absent, skipped' }); continue; }
        check(`invariant ${key} unchanged under red accent`,
            JSON.stringify(ref[key]) === JSON.stringify(alt[key]),
            `${JSON.stringify(ref[key])} vs ${JSON.stringify(alt[key])}`);
    }
    if (!ref.primary) results.push({ label: 'primary button changes under accent', ok: true, detail: 'element absent, skipped' });
    else check('primary button DOES change under red accent', JSON.stringify(ref.primary) !== JSON.stringify(alt.primary));

    /* ---------- 7. persistence + reset-to-blue ---------- */
    console.log('== persistence / reset ==');
    const persisted = await tokens(page);
    check('accent persists across reload', persisted.accent === 'red', persisted.accent);
    await page.evaluate(() => localStorage.removeItem('sbte_accent'));
    await reloadSafe(page);
    const reset = await tokens(page);
    check('clearing sbte_accent resets to blue', reset.accent === 'blue', reset.accent);
    check('reset restores default --sky', reset.sky === '#0ea5e9', reset.sky);
    const resetPrimary = await sample();
    check('primary button back to original blue', JSON.stringify(resetPrimary.primary) === JSON.stringify(ref.primary));

    /* ---------- 8. per-design tab screenshots with the red accent (admin) ---------- */
    console.log('== admin tab screenshots ==');
    const adminTabs = ['dashboard', 'report', 'batch', 'notes', 'simulations', 'seating', 'attendance', 'policy'];
    for (const design of DESIGNS) {
        await setPrefs(page, { design, accent: 'red', mode: 'light' });
        await page.type('#adminUser', 'admin');
        await page.type('#adminPass', '123');
        await page.click('#adminLoginBtn');
        await new Promise(r => setTimeout(r, 450));
        for (const v of adminTabs) {
            await page.click(`#tabs button[data-view="${v}"]`);
            await new Promise(r => setTimeout(r, 220));
            await page.screenshot({ path: shot(`admin_${design}_red_${v}`), fullPage: false });
        }
        // one dark-mode pass on the dashboard for contrast eyeballing
        await page.click('#themeToggleBtn');
        await new Promise(r => setTimeout(r, 300));
        await page.click('#tabs button[data-view="dashboard"]');
        await page.screenshot({ path: shot(`admin_${design}_red_dark_dashboard`) });
    }
    // yellow dark dashboard for every design too (worst-case contrast)
    for (const design of DESIGNS) {
        await setPrefs(page, { design, accent: 'yellow', mode: 'dark' });
        await page.type('#adminUser', 'admin');
        await page.type('#adminPass', '123');
        await page.click('#adminLoginBtn');
        await new Promise(r => setTimeout(r, 400));
        await page.screenshot({ path: shot(`admin_${design}_yellow_dark_dashboard`) });
    }

    /* ---------- 9. student sign-in ---------- */
    console.log('== student view ==');
    for (const design of DESIGNS) {
        await setPrefs(page, { design, accent: 'pink', mode: 'light' });
        await page.click('#roleTabStudent');
        await page.type('#stuId', '1534567');
        await page.type('#stuPass', 'Yusra');
        await page.click('#studentLoginBtn');
        await new Promise(r => setTimeout(r, 500));
        const who = await page.evaluate(() => document.getElementById('sessionWho').textContent);
        check(`student ${design} signed in`, /Yusra/i.test(who), who);
        await page.screenshot({ path: shot(`student_${design}_pink_report`) });
    }

    /* ---------- 10. console health ---------- */
    console.log('== console health ==');
    const realErrors = consoleErrors.filter(e =>
        !/localhost:3000|127\.0\.0\.1:3000|ERR_CONNECTION_REFUSED|net::ERR|Failed to load resource|fonts\.googleapis|fonts\.gstatic|unpkg|gstatic/i.test(e));
    check('no JS console errors (offline noise filtered)', realErrors.length === 0, realErrors.slice(0, 5).join(' | '));

    await browser.close();
    srv.close();

    const failed = results.filter(r => !r.ok);
    const skipped = results.filter(r => /skipped/.test(r.detail));
    console.log('\n========================================');
    console.log(`TOTAL: ${results.length} checks, FAILED: ${failed.length}, skipped(absent elements): ${skipped.length}`);
    if (failed.length) {
        console.log('Failures:');
        failed.forEach(f => console.log('  - ' + f.label + '  [' + f.detail + ']'));
    }
    console.log('Screenshots: ' + fs.readdirSync(SHOTS).length + ' files in verify/shots');
    process.exit(failed.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
