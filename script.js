

        /* ============ LAYOUT SETTINGS (defaults, load, apply) ============ */
        const LAYOUT_KEY = 'sbte_layout_v1';
        const LAYOUT_DEFAULT = {
            fs: 100, maxw: 1280, gap: 16,
            dash: { order: ['kpi', 'charts', 'filters', 'table'], w: { kpi: 100, charts: 100, filters: 100, table: 100 }, h: { kpi: 0, charts: 0, filters: 0, table: 0 } },
            charts: { order: ['dist', 'batch', 'month'], w: { dist: 'auto', batch: 'auto', month: 'auto' }, hp: { dist: 0, batch: 0, month: 0 } },
            rep: { side: 'right', main: 58, g: 100, gh: 100 }
        };
        const LAYOUT_SEL = { kpi: '#dashOverview>.kpi-strip', charts: '#dashOverview>.dash-charts', filters: '#view-dashboard>.dash-filters', table: '#view-dashboard>.table-wrap' };
        function mergeLayout(src) {
            const d = JSON.parse(JSON.stringify(LAYOUT_DEFAULT));
            if (!src || typeof src !== 'object') return d;
            const num = (v, lo, hi, def) => { v = Number(v); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def; };
            d.fs = num(src.fs, 80, 170, 100); d.maxw = num(src.maxw, 0, 3000, 1280); d.gap = num(src.gap, 6, 40, 16);
            ['dash', 'charts'].forEach(g => {
                const sg = src[g] || {};
                if (Array.isArray(sg.order) && sg.order.length === d[g].order.length && d[g].order.every(k => sg.order.includes(k))) d[g].order = sg.order.slice();
                Object.keys(d[g].w).forEach(k => {
                    const v = sg.w && sg.w[k];
                    if (v === 'auto' && g === 'charts') d[g].w[k] = 'auto';
                    else if (isFinite(Number(v)) && Number(v) >= 20 && Number(v) <= 100) d[g].w[k] = Math.round(Number(v));
                });
            });
            if (src.charts && src.charts.hp) Object.keys(d.charts.hp).forEach(k => { const v = num(src.charts.hp[k], 0, 1200, 0); d.charts.hp[k] = v > 0 ? Math.max(100, v) : 0; });
            if (src.dash) { const sh = src.dash.h || { table: src.dash.th }; Object.keys(d.dash.h).forEach(k => { const v = num(sh[k], 0, 2000, 0); d.dash.h[k] = v > 0 ? Math.max(60, v) : 0; }); }
            if (src.rep) {
                d.rep.side = ['right', 'left', 'below'].includes(src.rep.side) ? src.rep.side : 'right';
                d.rep.main = num(src.rep.main, 40, 80, 58); d.rep.g = num(src.rep.g, 50, 100, 100); d.rep.gh = num(src.rep.gh, 50, 250, 100);
            }
            return d;
        }
        let LAYOUT = mergeLayout(null);
        try { LAYOUT = mergeLayout(JSON.parse(localStorage.getItem(LAYOUT_KEY))); } catch (e) { }
        function layoutBasis(w) { return w >= 100 ? '100%' : `calc(${w}% - var(--lg) * ${(1 - w / 100).toFixed(3)})`; }
        function applyLayout() {
            const L = LAYOUT, c = [], d = [], e = [];
            c.push(`:root{--fs:${L.fs / 100};--lg:${L.gap}px;--maxw:${L.maxw ? L.maxw + 'px' : 'none'}}`);
            L.dash.order.forEach((k, i) => { c.push(`${LAYOUT_SEL[k]}{order:${i}}`); d.push(`${LAYOUT_SEL[k]}{flex-basis:${layoutBasis(L.dash.w[k])}}`); });
            L.charts.order.forEach((k, i) => {
                c.push(`#dashOverview .cc-${k}{order:${i}}`);
                if (L.charts.w[k] !== 'auto') d.push(`#dashOverview .cc-${k}{flex:0 0 ${layoutBasis(L.charts.w[k])}}`);
            });
            c.push(`@media(min-width:901px){${d.join('')}}`);
            const dh = L.dash.h;
            if (dh.kpi > 0) c.push(`#dashOverview>.kpi-strip{min-height:${dh.kpi}px}`);
            if (dh.filters > 0) c.push(`#view-dashboard>.dash-filters{min-height:${dh.filters}px}`);
            if (dh.table > 0) c.push(`#view-dashboard>.table-wrap{max-height:${dh.table}px;overflow-y:auto}`);
            const r = L.rep, m = r.main, sd = 100 - m;
            if (r.side === 'below') e.push('.report-layout,.batch-layout{grid-template-columns:minmax(0,1fr)}');
            else if (r.side === 'left') e.push(`.report-layout,.batch-layout{grid-template-columns:minmax(0,${sd}fr) minmax(0,${m}fr)}.report-col-side:first-child,.batch-col-side:first-child{order:2}`);
            else e.push(`.report-layout,.batch-layout{grid-template-columns:minmax(0,${m}fr) minmax(0,${sd}fr)}`);
            if (r.g < 100) e.push(`.report-col-side:last-child svg,.batch-col-side:last-child svg{width:${r.g}%;margin-left:auto;margin-right:auto;display:block}`);
            c.push(`@media(min-width:1001px){${e.join('')}}`);
            let st = document.getElementById('layoutStyle');
            if (!st) { st = document.createElement('style'); st.id = 'layoutStyle'; document.head.appendChild(st); }
            st.textContent = c.join('\n');
            scheduleFit();
        }
        /* Graphs are redrawn at the exact pixel size of their box, so dragging a corner changes their real shape */
        var CHDATA = null, fitRaf = 0;
        function scheduleFit() { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fitCharts); }
        function fitCharts() {
            if (!CHDATA) return;
            document.querySelectorAll('#dashOverview .cslot').forEach(slot => {
                const k = slot.dataset.c, d = CHDATA[k], w = Math.floor(slot.clientWidth);
                if (!d || w < 120) return;
                const hp = LAYOUT.charts.hp[k];
                if (d.type === 'v') {
                    slot.innerHTML = svgVerticalBars(d.items, { width: w, height: hp > 0 ? hp : Math.max(140, Math.round(w * 180 / 520)), maxHeight: 100, aria: d.aria });
                } else {
                    const n = d.items.length, gap = n > 14 ? 4 : 8;
                    const rowH = hp > 0 ? Math.max(8, Math.min(70, Math.floor((hp - 12 + gap) / n - gap))) : undefined;
                    slot.innerHTML = svgHorizontalBars(d.items, { width: w, rowH, max: 100, aria: d.aria });
                }
            });
        }
        addEventListener('resize', scheduleFit);
        document.addEventListener('click', e => { if (e.target.closest && e.target.closest('nav.tabs button')) setTimeout(scheduleFit, 60); });
        applyLayout();
        /* ============ DATA (baked in from the uploaded workbook) ============ */
        const RECORDS = [{ "id": 1534567, "name": "Yusra", "month": "September", "batch": "SBTE-202606C", "test": [14.5, 15.0, 13.5, 14.5, 13.5], "testTotal": 71.0, "testW": 28.4, "pres": 88.0, "presW": 8.8, "assign": 75.0, "assignW": 7.5, "reg": 66.0, "regW": 13.2, "event": 90.0, "eventW": 9.0, "sw": 92.0, "swW": 9.2, "final": 76.1 }, { "id": 1534568, "name": "Zunaira", "month": "September", "batch": "SBTE-202602E", "test": [12.5, 12.0, 11.5, 16.5, 12.5], "testTotal": 65.0, "testW": 26.0, "pres": 93.0, "presW": 9.3, "assign": 86.0, "assignW": 8.6, "reg": 73.0, "regW": 14.6, "event": 99.0, "eventW": 9.9, "sw": 78.0, "swW": 7.8, "final": 76.2 }, { "id": 1534569, "name": "Mukarram", "month": "September", "batch": "SBTE-202606C", "test": [15.0, 12.0, 16.5, 13.0, 18.5], "testTotal": 75.0, "testW": 30.0, "pres": 99.0, "presW": 9.9, "assign": 93.0, "assignW": 9.3, "reg": 61.0, "regW": 12.2, "event": 92.0, "eventW": 9.2, "sw": 78.0, "swW": 7.8, "final": 78.4 }, { "id": 1534570, "name": "Danish", "month": "September", "batch": "SBTE-202602E", "test": [14.5, 15.5, 14.5, 11.5, 16.0], "testTotal": 72.0, "testW": 28.8, "pres": 88.0, "presW": 8.8, "assign": 83.0, "assignW": 8.3, "reg": 85.0, "regW": 17.0, "event": 98.0, "eventW": 9.8, "sw": 62.0, "swW": 6.2, "final": 78.9 }, { "id": 1534571, "name": "Kabeer", "month": "September", "batch": "SBTE-202602E", "test": [15.0, 13.0, 14.0, 14.5, 20.0], "testTotal": 76.5, "testW": 30.6, "pres": 90.0, "presW": 9.0, "assign": 73.0, "assignW": 7.3, "reg": 91.0, "regW": 18.2, "event": 64.0, "eventW": 6.4, "sw": 64.0, "swW": 6.4, "final": 77.9 }, { "id": 1534572, "name": "Ibrahim", "month": "September", "batch": "SBTE-202606C", "test": [11.0, 17.0, 20.0, 15.5, 17.0], "testTotal": 80.5, "testW": 32.2, "pres": 80.0, "presW": 8.0, "assign": 96.0, "assignW": 9.6, "reg": 100.0, "regW": 20.0, "event": 63.0, "eventW": 6.3, "sw": 94.0, "swW": 9.4, "final": 85.5 }, { "id": 1534573, "name": "Riya", "month": "September", "batch": "SBTE-202602E", "test": [16.5, 15.0, 13.0, 15.0, 16.5], "testTotal": 76.0, "testW": 30.4, "pres": 100.0, "presW": 10.0, "assign": 74.0, "assignW": 7.4, "reg": 63.0, "regW": 12.6, "event": 96.0, "eventW": 9.6, "sw": 76.0, "swW": 7.6, "final": 77.6 }, { "id": 1534574, "name": "Ahmed", "month": "September", "batch": "SBTE-202602E", "test": [16.5, 11.0, 13.0, 13.0, 10.0], "testTotal": 63.5, "testW": 25.4, "pres": 82.0, "presW": 8.2, "assign": 65.0, "assignW": 6.5, "reg": 74.0, "regW": 14.8, "event": 77.0, "eventW": 7.7, "sw": 66.0, "swW": 6.6, "final": 69.2 }, { "id": 1534575, "name": "Hammad", "month": "September", "batch": "SBTE-202602E", "test": [12.0, 15.5, 13.5, 17.5, 15.0], "testTotal": 73.5, "testW": 29.4, "pres": 72.0, "presW": 7.2, "assign": 69.0, "assignW": 6.9, "reg": 96.0, "regW": 19.2, "event": 99.0, "eventW": 9.9, "sw": 83.0, "swW": 8.3, "final": 80.9 }, { "id": 1534576, "name": "Omer", "month": "September", "batch": "SBTE-202602E", "test": [16.5, 18.0, 13.5, 13.5, 16.0], "testTotal": 77.5, "testW": 31.0, "pres": 80.0, "presW": 8.0, "assign": 61.0, "assignW": 6.1, "reg": 77.0, "regW": 15.4, "event": 74.0, "eventW": 7.4, "sw": 83.0, "swW": 8.3, "final": 76.2 }, { "id": 1534577, "name": "Anas", "month": "September", "batch": "SBTE-202606C", "test": [17.0, 17.0, 13.5, 10.5, 13.0], "testTotal": 71.0, "testW": 28.4, "pres": 69.0, "presW": 6.9, "assign": 70.0, "assignW": 7.0, "reg": 90.0, "regW": 18.0, "event": 72.0, "eventW": 7.2, "sw": 95.0, "swW": 9.5, "final": 77.0 }, { "id": 1534578, "name": "Astle", "month": "September", "batch": "SBTE-202602E", "test": [14.5, 12.5, 15.5, 18.0, 18.5], "testTotal": 79.0, "testW": 31.6, "pres": 82.0, "presW": 8.2, "assign": 94.0, "assignW": 9.4, "reg": 92.0, "regW": 18.4, "event": 73.0, "eventW": 7.3, "sw": 93.0, "swW": 9.3, "final": 84.2 }, { "id": 1534579, "name": "Sarib", "month": "September", "batch": "SBTE-202602E", "test": [13.0, 15.0, 16.5, 12.0, 14.5], "testTotal": 71.0, "testW": 28.4, "pres": 61.0, "presW": 6.1, "assign": 69.0, "assignW": 6.9, "reg": 88.0, "regW": 17.6, "event": 64.0, "eventW": 6.4, "sw": 67.0, "swW": 6.7, "final": 72.1 }, { "id": 1534580, "name": "Khizar", "month": "September", "batch": "SBTE-202602E", "test": [16.0, 15.0, 13.5, 14.0, 15.0], "testTotal": 73.5, "testW": 29.4, "pres": 91.0, "presW": 9.1, "assign": 93.0, "assignW": 9.3, "reg": 82.0, "regW": 16.4, "event": 99.0, "eventW": 9.9, "sw": 73.0, "swW": 7.3, "final": 81.4 }, { "id": 1534581, "name": "Himesh", "month": "September", "batch": "SBTE-202606C", "test": [16.5, 15.0, 15.0, 13.5, 14.0], "testTotal": 74.0, "testW": 29.6, "pres": 74.0, "presW": 7.4, "assign": 72.0, "assignW": 7.2, "reg": 78.0, "regW": 15.6, "event": 94.0, "eventW": 9.4, "sw": 100.0, "swW": 10.0, "final": 79.2 }, { "id": 1534582, "name": "Abdul Wasay", "month": "September", "batch": "SBTE-202606C", "test": [12.5, 17.0, 16.0, 19.5, 15.0], "testTotal": 80.0, "testW": 32.0, "pres": 68.0, "presW": 6.8, "assign": 97.0, "assignW": 9.7, "reg": 61.0, "regW": 12.2, "event": 79.0, "eventW": 7.9, "sw": 64.0, "swW": 6.4, "final": 75.0 }, { "id": 1534583, "name": "Harmain", "month": "September", "batch": "SBTE-202602E", "test": [14.0, 18.0, 19.5, 18.5, 15.5], "testTotal": 85.5, "testW": 34.2, "pres": 80.0, "presW": 8.0, "assign": 75.0, "assignW": 7.5, "reg": 80.0, "regW": 16.0, "event": 83.0, "eventW": 8.3, "sw": 71.0, "swW": 7.1, "final": 81.1 }, { "id": 1534584, "name": "Muntaha", "month": "September", "batch": "SBTE-202606C", "test": [13.5, 14.0, 13.5, 13.5, 12.0], "testTotal": 66.5, "testW": 26.6, "pres": 93.0, "presW": 9.3, "assign": 82.0, "assignW": 8.2, "reg": 100.0, "regW": 20.0, "event": 60.0, "eventW": 6.0, "sw": 90.0, "swW": 9.0, "final": 79.1 }, { "id": 1534585, "name": "Abraham", "month": "September", "batch": "SBTE-202602E", "test": [19.0, 19.5, 18.0, 17.0, 16.0], "testTotal": 89.5, "testW": 35.8, "pres": 98.0, "presW": 9.8, "assign": 90.0, "assignW": 9.0, "reg": 92.0, "regW": 18.4, "event": 62.0, "eventW": 6.2, "sw": 91.0, "swW": 9.1, "final": 88.3 }, { "id": 1534586, "name": "Hasin", "month": "September", "batch": "SBTE-202606C", "test": [17.0, 11.5, 13.0, 15.0, 13.0], "testTotal": 69.5, "testW": 27.8, "pres": 93.0, "presW": 9.3, "assign": 71.0, "assignW": 7.1, "reg": 79.0, "regW": 15.8, "event": 70.0, "eventW": 7.0, "sw": 100.0, "swW": 10.0, "final": 77.0 }, { "id": 1534587, "name": "Talha", "month": "September", "batch": "SBTE-202606C", "test": [16.5, 13.5, 15.5, 15.0, 14.5], "testTotal": 75.0, "testW": 30.0, "pres": 85.0, "presW": 8.5, "assign": 76.0, "assignW": 7.6, "reg": 95.0, "regW": 19.0, "event": 62.0, "eventW": 6.2, "sw": 97.0, "swW": 9.7, "final": 81.0 }, { "id": 1534588, "name": "Ekrash", "month": "September", "batch": "SBTE-202602E", "test": [13.5, 16.5, 16.0, 15.0, 15.5], "testTotal": 76.5, "testW": 30.6, "pres": 74.0, "presW": 7.4, "assign": 100.0, "assignW": 10.0, "reg": 67.0, "regW": 13.4, "event": 86.0, "eventW": 8.6, "sw": 74.0, "swW": 7.4, "final": 77.4 }, { "id": 1534589, "name": "Hassan", "month": "September", "batch": "SBTE-202602E", "test": [18.5, 15.0, 15.5, 13.0, 14.0], "testTotal": 76.0, "testW": 30.4, "pres": 75.0, "presW": 7.5, "assign": 83.0, "assignW": 8.3, "reg": 66.0, "regW": 13.2, "event": 98.0, "eventW": 9.8, "sw": 70.0, "swW": 7.0, "final": 76.2 }, { "id": 1534590, "name": "Alishba", "month": "September", "batch": "SBTE-202606C", "test": [16.5, 14.5, 17.5, 14.0, 16.0], "testTotal": 78.5, "testW": 31.4, "pres": 77.0, "presW": 7.7, "assign": 90.0, "assignW": 9.0, "reg": 69.0, "regW": 13.8, "event": 93.0, "eventW": 9.3, "sw": 90.0, "swW": 9.0, "final": 80.2 }, { "id": 1534591, "name": "Ali Ahsan", "month": "September", "batch": "SBTE-202602E", "test": [14.5, 17.0, 13.5, 14.5, 14.0], "testTotal": 73.5, "testW": 29.4, "pres": 98.0, "presW": 9.8, "assign": 83.0, "assignW": 8.3, "reg": 75.0, "regW": 15.0, "event": 94.0, "eventW": 9.4, "sw": 98.0, "swW": 9.8, "final": 81.7 }, { "id": 1534592, "name": "Ali Jawad", "month": "September", "batch": "SBTE-202606C", "test": [13.0, 14.5, 16.5, 15.5, 15.0], "testTotal": 74.5, "testW": 29.8, "pres": 67.0, "presW": 6.7, "assign": 94.0, "assignW": 9.4, "reg": 89.0, "regW": 17.8, "event": 90.0, "eventW": 9.0, "sw": 96.0, "swW": 9.6, "final": 82.3 }, { "id": 1534593, "name": "Abdul Hanan", "month": "September", "batch": "SBTE-202606C", "test": [13.5, 13.5, 18.5, 10.5, 13.0], "testTotal": 69.0, "testW": 27.6, "pres": 68.0, "presW": 6.8, "assign": 94.0, "assignW": 9.4, "reg": 93.0, "regW": 18.6, "event": 62.0, "eventW": 6.2, "sw": 93.0, "swW": 9.3, "final": 77.9 }, { "id": 1534594, "name": "Taha", "month": "September", "batch": "SBTE-202606C", "test": [16.5, 13.0, 15.0, 11.5, 16.0], "testTotal": 72.0, "testW": 28.8, "pres": 81.0, "presW": 8.1, "assign": 96.0, "assignW": 9.6, "reg": 72.0, "regW": 14.4, "event": 72.0, "eventW": 7.2, "sw": 66.0, "swW": 6.6, "final": 74.7 }, { "id": 1534595, "name": "Rehan", "month": "September", "batch": "SBTE-202602E", "test": [16.5, 15.5, 11.5, 18.0, 11.5], "testTotal": 73.0, "testW": 29.2, "pres": 72.0, "presW": 7.2, "assign": 72.0, "assignW": 7.2, "reg": 90.0, "regW": 18.0, "event": 76.0, "eventW": 7.6, "sw": 75.0, "swW": 7.5, "final": 76.7 }, { "id": 1534596, "name": "Yusra", "month": "October", "batch": "SBTE-202602E", "test": [13.0, 11.5, 13.0, 12.0, 14.5], "testTotal": 64.0, "testW": 25.6, "pres": 98.0, "presW": 9.8, "assign": 95.0, "assignW": 9.5, "reg": 66.0, "regW": 13.2, "event": 70.0, "eventW": 7.0, "sw": 95.0, "swW": 9.5, "final": 74.6 }, { "id": 1534597, "name": "Zunaira", "month": "October", "batch": "SBTE-202602E", "test": [14.0, 15.5, 18.0, 14.5, 15.0], "testTotal": 77.0, "testW": 30.8, "pres": 93.0, "presW": 9.3, "assign": 70.0, "assignW": 7.0, "reg": 98.0, "regW": 19.6, "event": 61.0, "eventW": 6.1, "sw": 81.0, "swW": 8.1, "final": 80.9 }, { "id": 1534598, "name": "Mukarram", "month": "October", "batch": "SBTE-202602E", "test": [18.0, 17.0, 13.5, 15.5, 17.0], "testTotal": 81.0, "testW": 32.4, "pres": 76.0, "presW": 7.6, "assign": 95.0, "assignW": 9.5, "reg": 84.0, "regW": 16.8, "event": 67.0, "eventW": 6.7, "sw": 77.0, "swW": 7.7, "final": 80.7 }, { "id": 1534599, "name": "Danish", "month": "October", "batch": "SBTE-202606C", "test": [17.0, 12.5, 12.5, 14.5, 16.0], "testTotal": 72.5, "testW": 29.0, "pres": 89.0, "presW": 8.9, "assign": 69.0, "assignW": 6.9, "reg": 82.0, "regW": 16.4, "event": 98.0, "eventW": 9.8, "sw": 69.0, "swW": 6.9, "final": 77.9 }, { "id": 1534600, "name": "Kabeer", "month": "October", "batch": "SBTE-202602E", "test": [15.5, 15.0, 16.0, 18.0, 18.5], "testTotal": 83.0, "testW": 33.2, "pres": 92.0, "presW": 9.2, "assign": 68.0, "assignW": 6.8, "reg": 71.0, "regW": 14.2, "event": 95.0, "eventW": 9.5, "sw": 60.0, "swW": 6.0, "final": 78.9 }, { "id": 1534601, "name": "Ibrahim", "month": "October", "batch": "SBTE-202602E", "test": [11.5, 16.0, 16.5, 19.5, 17.5], "testTotal": 81.0, "testW": 32.4, "pres": 76.0, "presW": 7.6, "assign": 81.0, "assignW": 8.1, "reg": 86.0, "regW": 17.2, "event": 80.0, "eventW": 8.0, "sw": 84.0, "swW": 8.4, "final": 81.7 }, { "id": 1534602, "name": "Riya", "month": "October", "batch": "SBTE-202602E", "test": [18.0, 16.5, 15.0, 17.5, 15.0], "testTotal": 82.0, "testW": 32.8, "pres": 64.0, "presW": 6.4, "assign": 86.0, "assignW": 8.6, "reg": 92.0, "regW": 18.4, "event": 74.0, "eventW": 7.4, "sw": 98.0, "swW": 9.8, "final": 83.4 }, { "id": 1534603, "name": "Ahmed", "month": "October", "batch": "SBTE-202602E", "test": [13.5, 16.5, 16.5, 16.0, 16.5], "testTotal": 79.0, "testW": 31.6, "pres": 90.0, "presW": 9.0, "assign": 64.0, "assignW": 6.4, "reg": 75.0, "regW": 15.0, "event": 90.0, "eventW": 9.0, "sw": 70.0, "swW": 7.0, "final": 78.0 }, { "id": 1534604, "name": "Hammad", "month": "October", "batch": "SBTE-202602E", "test": [16.0, 13.5, 12.5, 15.5, 18.5], "testTotal": 76.0, "testW": 30.4, "pres": 69.0, "presW": 6.9, "assign": 75.0, "assignW": 7.5, "reg": 83.0, "regW": 16.6, "event": 76.0, "eventW": 7.6, "sw": 81.0, "swW": 8.1, "final": 77.1 }, { "id": 1534605, "name": "Omer", "month": "October", "batch": "SBTE-202602E", "test": [14.5, 10.5, 11.0, 14.5, 13.5], "testTotal": 64.0, "testW": 25.6, "pres": 81.0, "presW": 8.1, "assign": 81.0, "assignW": 8.1, "reg": 80.0, "regW": 16.0, "event": 95.0, "eventW": 9.5, "sw": 100.0, "swW": 10.0, "final": 77.3 }, { "id": 1534606, "name": "Anas", "month": "October", "batch": "SBTE-202602E", "test": [19.0, 18.5, 13.5, 13.0, 19.0], "testTotal": 83.0, "testW": 33.2, "pres": 78.0, "presW": 7.8, "assign": 84.0, "assignW": 8.4, "reg": 85.0, "regW": 17.0, "event": 72.0, "eventW": 7.2, "sw": 74.0, "swW": 7.4, "final": 81.0 }, { "id": 1534607, "name": "Astle", "month": "October", "batch": "SBTE-202606C", "test": [15.5, 16.5, 10.5, 15.0, 18.5], "testTotal": 76.0, "testW": 30.4, "pres": 97.0, "presW": 9.7, "assign": 100.0, "assignW": 10.0, "reg": 77.0, "regW": 15.4, "event": 66.0, "eventW": 6.6, "sw": 66.0, "swW": 6.6, "final": 78.7 }, { "id": 1534608, "name": "Sarib", "month": "October", "batch": "SBTE-202606C", "test": [18.5, 11.5, 12.5, 17.0, 12.0], "testTotal": 71.5, "testW": 28.6, "pres": 97.0, "presW": 9.7, "assign": 80.0, "assignW": 8.0, "reg": 74.0, "regW": 14.8, "event": 76.0, "eventW": 7.6, "sw": 96.0, "swW": 9.6, "final": 78.3 }, { "id": 1534609, "name": "Khizar", "month": "October", "batch": "SBTE-202602E", "test": [14.0, 11.5, 17.0, 16.5, 18.5], "testTotal": 77.5, "testW": 31.0, "pres": 65.0, "presW": 6.5, "assign": 60.0, "assignW": 6.0, "reg": 89.0, "regW": 17.8, "event": 91.0, "eventW": 9.1, "sw": 68.0, "swW": 6.8, "final": 77.2 }, { "id": 1534610, "name": "Himesh", "month": "October", "batch": "SBTE-202602E", "test": [16.5, 11.5, 14.5, 16.5, 19.5], "testTotal": 78.5, "testW": 31.4, "pres": 83.0, "presW": 8.3, "assign": 65.0, "assignW": 6.5, "reg": 93.0, "regW": 18.6, "event": 75.0, "eventW": 7.5, "sw": 68.0, "swW": 6.8, "final": 79.1 }, { "id": 1534611, "name": "Abdul Wasay", "month": "October", "batch": "SBTE-202602E", "test": [13.5, 18.0, 12.5, 13.5, 12.0], "testTotal": 69.5, "testW": 27.8, "pres": 98.0, "presW": 9.8, "assign": 85.0, "assignW": 8.5, "reg": 93.0, "regW": 18.6, "event": 77.0, "eventW": 7.7, "sw": 84.0, "swW": 8.4, "final": 80.8 }, { "id": 1534612, "name": "Harmain", "month": "October", "batch": "SBTE-202606C", "test": [17.5, 14.0, 14.5, 16.5, 14.0], "testTotal": 76.5, "testW": 30.6, "pres": 96.0, "presW": 9.6, "assign": 88.0, "assignW": 8.8, "reg": 90.0, "regW": 18.0, "event": 67.0, "eventW": 6.7, "sw": 88.0, "swW": 8.8, "final": 82.5 }, { "id": 1534613, "name": "Muntaha", "month": "October", "batch": "SBTE-202606C", "test": [16.0, 15.5, 13.5, 13.5, 14.0], "testTotal": 72.5, "testW": 29.0, "pres": 72.0, "presW": 7.2, "assign": 71.0, "assignW": 7.1, "reg": 65.0, "regW": 13.0, "event": 83.0, "eventW": 8.3, "sw": 62.0, "swW": 6.2, "final": 70.8 }, { "id": 1534614, "name": "Abraham", "month": "October", "batch": "SBTE-202602E", "test": [15.5, 17.5, 14.5, 15.5, 14.5], "testTotal": 77.5, "testW": 31.0, "pres": 75.0, "presW": 7.5, "assign": 75.0, "assignW": 7.5, "reg": 95.0, "regW": 19.0, "event": 97.0, "eventW": 9.7, "sw": 75.0, "swW": 7.5, "final": 82.2 }, { "id": 1534615, "name": "Hasin", "month": "October", "batch": "SBTE-202606C", "test": [19.5, 13.5, 17.0, 16.0, 20.0], "testTotal": 86.0, "testW": 34.4, "pres": 86.0, "presW": 8.6, "assign": 95.0, "assignW": 9.5, "reg": 96.0, "regW": 19.2, "event": 72.0, "eventW": 7.2, "sw": 64.0, "swW": 6.4, "final": 85.3 }, { "id": 1534616, "name": "Talha", "month": "October", "batch": "SBTE-202602E", "test": [14.0, 13.5, 17.0, 13.0, 16.0], "testTotal": 73.5, "testW": 29.4, "pres": 85.0, "presW": 8.5, "assign": 67.0, "assignW": 6.7, "reg": 92.0, "regW": 18.4, "event": 74.0, "eventW": 7.4, "sw": 70.0, "swW": 7.0, "final": 77.4 }, { "id": 1534617, "name": "Ekrash", "month": "October", "batch": "SBTE-202606C", "test": [14.5, 14.5, 12.0, 13.0, 19.5], "testTotal": 73.5, "testW": 29.4, "pres": 76.0, "presW": 7.6, "assign": 74.0, "assignW": 7.4, "reg": 61.0, "regW": 12.2, "event": 77.0, "eventW": 7.7, "sw": 89.0, "swW": 8.9, "final": 73.2 }, { "id": 1534618, "name": "Hassan", "month": "October", "batch": "SBTE-202606C", "test": [16.0, 18.0, 19.5, 16.5, 12.5], "testTotal": 82.5, "testW": 33.0, "pres": 99.0, "presW": 9.9, "assign": 71.0, "assignW": 7.1, "reg": 62.0, "regW": 12.4, "event": 83.0, "eventW": 8.3, "sw": 64.0, "swW": 6.4, "final": 77.1 }, { "id": 1534619, "name": "Alishba", "month": "October", "batch": "SBTE-202602E", "test": [15.5, 16.5, 12.0, 14.0, 19.5], "testTotal": 77.5, "testW": 31.0, "pres": 64.0, "presW": 6.4, "assign": 68.0, "assignW": 6.8, "reg": 67.0, "regW": 13.4, "event": 61.0, "eventW": 6.1, "sw": 82.0, "swW": 8.2, "final": 71.9 }, { "id": 1534620, "name": "Ali Ahsan", "month": "October", "batch": "SBTE-202602E", "test": [18.0, 14.5, 16.5, 13.0, 12.0], "testTotal": 74.0, "testW": 29.6, "pres": 61.0, "presW": 6.1, "assign": 100.0, "assignW": 10.0, "reg": 63.0, "regW": 12.6, "event": 74.0, "eventW": 7.4, "sw": 95.0, "swW": 9.5, "final": 75.2 }, { "id": 1534621, "name": "Ali Jawad", "month": "October", "batch": "SBTE-202606C", "test": [14.0, 14.0, 16.0, 12.5, 19.0], "testTotal": 75.5, "testW": 30.2, "pres": 90.0, "presW": 9.0, "assign": 70.0, "assignW": 7.0, "reg": 61.0, "regW": 12.2, "event": 76.0, "eventW": 7.6, "sw": 68.0, "swW": 6.8, "final": 72.8 }, { "id": 1534622, "name": "Abdul Hanan", "month": "October", "batch": "SBTE-202602E", "test": [12.5, 14.5, 16.5, 13.5, 14.0], "testTotal": 71.0, "testW": 28.4, "pres": 80.0, "presW": 8.0, "assign": 89.0, "assignW": 8.9, "reg": 95.0, "regW": 19.0, "event": 72.0, "eventW": 7.2, "sw": 86.0, "swW": 8.6, "final": 80.1 }, { "id": 1534623, "name": "Taha", "month": "October", "batch": "SBTE-202606C", "test": [17.0, 15.5, 16.5, 16.5, 16.0], "testTotal": 81.5, "testW": 32.6, "pres": 72.0, "presW": 7.2, "assign": 68.0, "assignW": 6.8, "reg": 69.0, "regW": 13.8, "event": 95.0, "eventW": 9.5, "sw": 95.0, "swW": 9.5, "final": 79.4 }, { "id": 1534624, "name": "Rehan", "month": "October", "batch": "SBTE-202602E", "test": [12.5, 15.5, 14.0, 13.0, 17.0], "testTotal": 72.0, "testW": 28.8, "pres": 66.0, "presW": 6.6, "assign": 84.0, "assignW": 8.4, "reg": 93.0, "regW": 18.6, "event": 84.0, "eventW": 8.4, "sw": 82.0, "swW": 8.2, "final": 79.0 }];

        /* Class Test: 5 tests (T1-T5), /20 each, 40% weight. Older records stored separate Maths and Physics
           tests; they are folded in here by averaging each test pair, which keeps every final score unchanged. */
        function normalizeRecord(r) {
            if (!Array.isArray(r.test) && (Array.isArray(r.math) || Array.isArray(r.phy))) {
                const m = Array.isArray(r.math) ? r.math.map(Number) : [], p = Array.isArray(r.phy) ? r.phy.map(Number) : [];
                r.test = [0, 1, 2, 3, 4].map(i => {
                    const v = [m[i], p[i]].filter(x => isFinite(x));
                    return v.length ? round1(v.reduce((a, b) => a + b, 0) / v.length) : 0;
                });
            }
            if (Array.isArray(r.test)) {
                r.test = [0, 1, 2, 3, 4].map(i => { const v = Number(r.test[i]); return isFinite(v) ? v : 0; });
                r.testTotal = round1(r.test.reduce((a, b) => a + b, 0));
                r.testW = round1(r.testTotal / 100 * 40);
            }
            delete r.math; delete r.mathTotal; delete r.mathW; delete r.phy; delete r.phyTotal; delete r.phyW;
            return r;
        }

        const POLICY = [
            { cat: "Class Test (T1—T5)", weight: "40%", desc: "Five class tests during the month (T1, T2, T3, T4, T5), marked out of 20 each (100 total). The sum of all five is scaled from /100 up to a /40 weighted contribution — the highest-weighted category." },
            { cat: "Presentation", weight: "10%", desc: "One in-class presentation per month, marked out of 100 for content, delivery and clarity, then scaled to a /10 weighted contribution." },
            { cat: "Assignment", weight: "10%", desc: "Assigned coursework for the month, marked out of 100 for completeness and correctness, then scaled to a /10 weighted contribution." },
            { cat: "Regularity and Punctuality", weight: "20%", desc: "Attendance and on-time arrival across the month, marked out of 100, then scaled to a /20 weighted contribution — the single highest-weighted non-academic category." },
            { cat: "Event Participation", weight: "10%", desc: "Participation in institute events, workshops, or co-curricular activity, marked out of 100 then scaled to a /10 weighted contribution." },
            { cat: "Social Work", weight: "10%", desc: "Community or campus service undertaken during the month, marked out of 100 then scaled to a /10 weighted contribution." },
        ];

        const STANDING_BANDS = [
            { label: "Excellent", range: "85 — 100", color: "#2E6B4C", note: "Outstanding, well-rounded performance across nearly every category." },
            { label: "Good", range: "70 — 84.9", color: "#33587A", note: "Solid, consistent performance with only minor gaps." },
            { label: "Satisfactory", range: "60 — 69.9", color: "#A8701F", note: "Meets the baseline but has clear room to improve in one or more areas." },
            { label: "Needs Improvement", range: "Below 60", color: "#A13C3C", note: "Flagged for follow-up — recommend a check-in with the student." },
        ];

        const GRADE_BANDS = [
            { grade: "A+", range: "90 — 100" },
            { grade: "A", range: "85 — 89.9" },
            { grade: "B+", range: "80 — 84.9" },
            { grade: "B", range: "70 — 79.9" },
            { grade: "C", range: "60 — 69.9" },
            { grade: "D", range: "50 — 59.9" },
            { grade: "F", range: "Below 50" },
        ];

        /* ============ Helpers ============ */
        const MONTH_ORDER = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const uniq = arr => [...new Set(arr)];
        const byMonthOrder = (a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b);

        function standing(score) {
            if (score >= 85) return { label: "Excellent", cls: "excellent", color: "#2E6B4C" };
            if (score >= 70) return { label: "Good", cls: "good", color: "#33587A" };
            if (score >= 60) return { label: "Satisfactory", cls: "satisfactory", color: "#A8701F" };
            return { label: "Needs Improvement", cls: "needs", color: "#A13C3C" };
        }
        function round1(n) { return Math.round(n * 10) / 10; }

        function gradeLetter(score) {
            if (score >= 90) return 'A+';
            if (score >= 85) return 'A';
            if (score >= 80) return 'B+';
            if (score >= 70) return 'B';
            if (score >= 60) return 'C';
            if (score >= 50) return 'D';
            return 'F';
        }
        function ordinal(n) {
            const s = ["th", "st", "nd", "rd"], v = n % 100;
            return n + (s[(v - 20) % 10] || s[v] || s[0]);
        }
        const STANDING_COLORS = { Excellent: '#2E6B4C', Good: '#33587A', Satisfactory: '#A8701F', 'Needs Improvement': '#A13C3C' };
        function tierClass(v, max) {
            const pct = v / max;
            if (pct >= 0.75) return 'tier-high';
            if (pct >= 0.5) return 'tier-mid';
            return 'tier-low';
        }

        function reportInsights(r) {
            const cohort = RECORDS.filter(x => x.batch === r.batch && x.month === r.month).slice().sort((a, b) => b.final - a.final);
            const rank = cohort.findIndex(x => x.name === r.name && x.id === r.id) + 1;
            const total = cohort.length;
            const batchAvg = avg(cohort.map(x => x.final));
            const diff = round1(r.final - batchAvg);
            const cats = [
                { label: 'Class Test', w: r.testW, max: 40 },
                { label: 'Presentation', w: r.presW, max: 10 },
                { label: 'Assignment', w: r.assignW, max: 10 },
                { label: 'Regularity', w: r.regW, max: 20 },
                { label: 'Event participation', w: r.eventW, max: 10 },
                { label: 'Social work', w: r.swW, max: 10 },
            ].map(c => ({ ...c, pct: c.max ? round1(c.w / c.max * 100) : 0 }));
            const best = cats.slice().sort((a, b) => b.pct - a.pct)[0];
            const weak = cats.slice().sort((a, b) => a.pct - b.pct)[0];
            const allTests = r.test;
            const highestTest = Math.max(...allTests);
            const lowestTest = Math.min(...allTests);
            return { rank, total, batchAvg, diff, best, weak, highestTest, lowestTest };
        }

        function studentRemark(r, ins) {
            const st = standing(r.final);
            let opener;
            if (st.label === 'Excellent') opener = `${r.name} is performing at an excellent level this month`;
            else if (st.label === 'Good') opener = `${r.name} is showing good, consistent performance this month`;
            else if (st.label === 'Satisfactory') opener = `${r.name}'s performance is satisfactory, with clear room to grow`;
            else opener = `${r.name} needs focused improvement this month`;
            const rankLine = `Ranked ${ordinal(ins.rank)} of ${ins.total} in batch ${r.batch}, ${ins.diff >= 0 ? '+' : ''}${ins.diff} pts vs the batch average.`;
            const catLine = `Strongest in ${ins.best.label} (${ins.best.pct}% of cap); most room to grow in ${ins.weak.label} (${ins.weak.pct}% of cap).`;
            return `${opener}. ${rankLine} ${catLine}`;
        }

/* ============ MongoDB Atlas sync state (via backend API) ============ */
const API_BASE = 'http://localhost:3000/api';
let USING_FIREBASE = false;
let FB = null;

async function apiRequest(path, method = 'GET', body = null) {
    const url = `${API_BASE}/${path}`;
    const opts = { method };
    if (body) {
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`API ${method} ${path} failed: ${res.status}`);
    return res.json();
}

// Firebase-compatible interface backed by MongoDB API
FB = {
    ref: (db, path) => path,
    get: async (path) => {
        try {
            const data = await apiRequest(path, 'GET');
            if (data === null || data === undefined) {
                return { exists: () => false, val: () => null, key: '', forEach: () => {} };
            }
            if (Array.isArray(data)) {
                const obj = {};
                data.forEach(item => { if (item && item.mongoId) obj[item.mongoId] = item; });
                return {
                    exists: () => Object.keys(obj).length > 0,
                    val: () => obj,
                    key: '',
                    forEach: (cb) => Object.entries(obj).forEach(([key, val]) => cb({ key, val: () => val }))
                };
            }
            return {
                exists: () => Object.keys(data).length > 0,
                val: () => data,
                key: '',
                forEach: (cb) => Object.entries(data).forEach(([key, val]) => cb({ key, val: () => val }))
            };
        } catch (e) {
            return { exists: () => false, val: () => null, key: '', forEach: () => {} };
        }
    },
    set: async (path, data) => {
        const parts = path.split('/');
        const collection = parts[0];
        const key = parts.slice(1).join('/');
        if (key) {
            await apiRequest(`${collection}/${key}`, 'POST', data);
        } else {
            await apiRequest(collection, 'POST', data);
        }
        return { ok: true };
    },
    remove: async (path) => {
        const parts = path.split('/');
        const collection = parts[0];
        const key = parts.slice(1).join('/');
        await apiRequest(`${collection}/${key}`, 'DELETE');
        return { ok: true };
    },
    update: async (path, data) => {
        return FB.set(path, data);
    }
};

function recKey(r) {
            return String(r.name + '_' + r.month).trim().replace(/[.#$\[\]\/\s]+/g, '_');
        }
        function setCloudStatus(state) {
            const el = document.getElementById('cloudStatus');
            if (!el) return;
            el.textContent = state === 'connected' ? 'Connected' : state === 'connecting' ? 'Connecting…' : 'Offline (local only)';
            el.className = 'cloud-' + state;
        }

        // Retry cloud connection when user clicks the Retry button
        const cloudRetryBtn = document.getElementById('cloudRetryBtn');
        if (cloudRetryBtn) {
            cloudRetryBtn.addEventListener('click', async () => {
                cloudRetryBtn.disabled = true;
                cloudRetryBtn.textContent = 'Retrying…';
                try {
                    await checkMongoDB();
                    cloudRetryBtn.textContent = 'Retry';
                    cloudRetryBtn.disabled = false;
                } catch (err) {
                    cloudRetryBtn.textContent = 'Retry';
                    cloudRetryBtn.disabled = false;
                    console.warn('Retry failed:', err);
                }
            });
        }

        function downloadCsv(filename, rows) {
            const csv = rows.map(row => row.map(cell => {
                const s = String(cell);
                return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
            }).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function downloadJson(filename, obj) {
            const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        /* ---------- Inline SVG chart builders (no external chart library needed) ---------- */
        function svgVerticalBars(items, opts = {}) {
            const w = opts.width || 520, h = opts.height || 190;
            const padL = 34, padR = 14, padT = 18, padB = 30;
            const chartW = w - padL - padR, chartH = h - padT - padB;
            const gap = items.length > 6 ? 10 : 16;
            const barW = Math.max(6, (chartW - gap * (items.length - 1)) / items.length);
            const maxH = opts.maxHeight != null ? opts.maxHeight : 100;
            const gid = 'sg' + Math.random().toString(36).slice(2, 9);
            let bars = '', vlabels = '', xlabels = '';
            items.forEach((it, i) => {
                const x = padL + i * (barW + gap);
                const hVal = Math.max(0, Math.min(maxH, it.height != null ? it.height : it.value));
                const barH = Math.max(2, (hVal / maxH) * chartH);
                const y = padT + chartH - barH;
                bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="5" fill="${it.color || `url(#${gid})`}"/>`;
                vlabels += `<text x="${(x + barW / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="10.5" font-family="Inter,sans-serif" font-weight="700" fill="var(--ink)">${it.value}</text>`;
                xlabels += `<text x="${(x + barW / 2).toFixed(1)}" y="${(padT + chartH + 18).toFixed(1)}" text-anchor="middle" font-size="9.5" font-family="Inter,sans-serif" fill="var(--ink-soft)">${it.label}</text>`;
            });
            return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-height:${h}px;" role="img" aria-label="${opts.aria || 'Bar chart'}">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--sky)"/><stop offset="100%" stop-color="var(--sky-dark)"/></linearGradient></defs>
    <line x1="${padL}" y1="${padT + chartH}" x2="${w - padR}" y2="${padT + chartH}" stroke="var(--rule)" stroke-width="1"/>
    ${bars}${vlabels}${xlabels}
  </svg>`;
        }

        function svgHorizontalBars(items, opts = {}) {
            const w = opts.width || 600;
            const many = items.length > 14;
            const rowH = opts.rowH || (many ? 15 : 22), gap = many ? 4 : 8;
            const fontSize = many ? 9 : 10.5;
            // Size the label gutter to the longest label actually present, instead of
            // a fixed width — short names shouldn't leave a big empty strip on the left.
            const labelChars = items.map(it => Math.min(String(it.label).length, 16));
            const maxLabelChars = Math.max(...labelChars, 3);
            const charW = fontSize * 0.56;
            const padL = opts.padL || Math.round(Math.min(150, Math.max(46, maxLabelChars * charW + 16)));
            const padR = 44, padT = 6;
            const chartW = w - padL - padR;
            const maxVal = opts.max || Math.max(...items.map(i => i.value), 1);
            const h = padT * 2 + items.length * (rowH + gap) - gap;
            let rows = '';
            items.forEach((it, i) => {
                const y = padT + i * (rowH + gap);
                const barW = Math.max(2, (it.value / maxVal) * chartW);
                rows += `
      <text x="${padL - 8}" y="${(y + rowH / 2 + 3.5).toFixed(1)}" text-anchor="end" font-size="${fontSize}" font-family="Inter,sans-serif" fill="var(--ink)">${String(it.label).length > 16 ? String(it.label).slice(0, 15) + '…' : it.label}</text>
      <rect x="${padL}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${rowH}" rx="4" fill="${it.color || 'var(--sky-dark)'}"/>
      <text x="${(padL + barW + 7).toFixed(1)}" y="${(y + rowH / 2 + 3.5).toFixed(1)}" font-size="${fontSize}" font-family="Inter,sans-serif" font-weight="700" fill="var(--ink)">${it.value}</text>
    `;
            });
            return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-height:${Math.min(h, 460)}px;" role="img" aria-label="${opts.aria || 'Bar chart'}">${rows}</svg>`;
        }

        // Radar / spider chart: each item is {label, value, max}. Plots value/max
        // as a fraction of each spoke's length, so categories with different caps
        // (e.g. /20 vs /10) compare fairly on the same shape.
        function svgRadar(items, opts = {}) {
            const size = opts.size || 300;
            const cx = size / 2, cy = size / 2 - 6;
            const rMax = (opts.radius || size * 0.34);
            const n = items.length;
            const angleFor = i => (Math.PI * 2 * i / n) - Math.PI / 2;
            const gid = 'rg' + Math.random().toString(36).slice(2, 9);

            let rings = '';
            [0.25, 0.5, 0.75, 1].forEach(f => {
                const pts = items.map((_, i) => {
                    const a = angleFor(i);
                    return `${(cx + Math.cos(a) * rMax * f).toFixed(1)},${(cy + Math.sin(a) * rMax * f).toFixed(1)}`;
                }).join(' ');
                rings += `<polygon points="${pts}" fill="none" stroke="var(--rule)" stroke-width="1"/>`;
            });

            let spokes = '', labels = '';
            items.forEach((it, i) => {
                const a = angleFor(i);
                const x = cx + Math.cos(a) * rMax, y = cy + Math.sin(a) * rMax;
                spokes += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--rule)" stroke-width="1"/>`;
                const lx = cx + Math.cos(a) * (rMax + 22), ly = cy + Math.sin(a) * (rMax + 22);
                const anchor = Math.abs(Math.cos(a)) < 0.2 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
                labels += `<text x="${lx.toFixed(1)}" y="${(ly + 3.5).toFixed(1)}" text-anchor="${anchor}" font-size="10" font-family="Inter,sans-serif" fill="var(--ink-soft)">${it.label}</text>`;
            });

            const shapePts = items.map((it, i) => {
                const a = angleFor(i);
                const f = Math.max(0, Math.min(1, it.value / (it.max || 100)));
                return `${(cx + Math.cos(a) * rMax * f).toFixed(1)},${(cy + Math.sin(a) * rMax * f).toFixed(1)}`;
            }).join(' ');

            const dots = items.map((it, i) => {
                const a = angleFor(i);
                const f = Math.max(0, Math.min(1, it.value / (it.max || 100)));
                const x = cx + Math.cos(a) * rMax * f, y = cy + Math.sin(a) * rMax * f;
                return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#fff" stroke="${opts.stroke || 'var(--sky-dark)'}" stroke-width="2"/>`;
            }).join('');

            return `<svg viewBox="0 0 ${size} ${size}" width="100%" style="max-height:${size}px;" role="img" aria-label="${opts.aria || 'Radar chart'}">
    <defs><radialGradient id="${gid}"><stop offset="0%" stop-color="${opts.fill || 'var(--sky)'}" stop-opacity="0.55"/><stop offset="100%" stop-color="${opts.fill || 'var(--sky-dark)'}" stop-opacity="0.18"/></radialGradient></defs>
    ${rings}${spokes}
    <polygon points="${shapePts}" fill="url(#${gid})" stroke="${opts.stroke || 'var(--sky-dark)'}" stroke-width="2" stroke-linejoin="round"/>
    ${dots}
    ${labels}
  </svg>`;
        }

        // Donut chart: items are {label, value, color}. Draws a ring of arcs with
        // an optional centered total/label in the middle.
        function svgDonut(items, opts = {}) {
            const size = opts.size || 220;
            const cx = size / 2, cy = size / 2;
            const rOuter = opts.rOuter || size * 0.42;
            const rInner = opts.rInner || rOuter * 0.6;
            const total = items.reduce((s, it) => s + it.value, 0) || 1;
            const palette = opts.palette || ['var(--sky-dark)', 'var(--sky)', '#0F172A', '#33587A', '#A8701F', '#2E6B4C', '#A13C3C'];

            let angle = -Math.PI / 2;
            let arcs = '';
            items.forEach((it, i) => {
                const frac = it.value / total;
                const a0 = angle;
                const a1 = angle + frac * Math.PI * 2;
                angle = a1;
                if (frac <= 0) return;
                const large = (a1 - a0) > Math.PI ? 1 : 0;
                const x0o = cx + Math.cos(a0) * rOuter, y0o = cy + Math.sin(a0) * rOuter;
                const x1o = cx + Math.cos(a1) * rOuter, y1o = cy + Math.sin(a1) * rOuter;
                const x0i = cx + Math.cos(a1) * rInner, y0i = cy + Math.sin(a1) * rInner;
                const x1i = cx + Math.cos(a0) * rInner, y1i = cy + Math.sin(a0) * rInner;
                const color = it.color || palette[i % palette.length];
                // full circle (single-category 100%) needs two half-arcs, a plain path won't render a closed loop
                if (frac >= 0.999) {
                    arcs += `<circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="${color}"/><circle cx="${cx}" cy="${cy}" r="${rInner}" fill="var(--card)"/>`;
                } else {
                    arcs += `<path d="M${x0o.toFixed(1)},${y0o.toFixed(1)} A${rOuter},${rOuter} 0 ${large} 1 ${x1o.toFixed(1)},${y1o.toFixed(1)} L${x0i.toFixed(1)},${y0i.toFixed(1)} A${rInner},${rInner} 0 ${large} 0 ${x1i.toFixed(1)},${y1i.toFixed(1)} Z" fill="${color}" stroke="var(--card)" stroke-width="1.5"/>`;
                }
            });

            const centerText = opts.centerValue != null ? `
    <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="20" font-weight="800" font-family="Inter,sans-serif" fill="var(--navy)">${opts.centerValue}</text>
    <text x="${cx}" y="${cy + 15}" text-anchor="middle" font-size="9.5" font-family="Inter,sans-serif" fill="var(--ink-soft)">${opts.centerLabel || ''}</text>
  ` : '';

            return `<svg viewBox="0 0 ${size} ${size}" width="100%" style="max-height:${size}px;" role="img" aria-label="${opts.aria || 'Donut chart'}">
    ${arcs}${centerText}
  </svg>`;
        }


        function rebuildSelectors() {
            document.getElementById('metaCount').textContent = uniq(RECORDS.map(r => r.id)).length;
            document.getElementById('metaBatches').textContent = uniq(RECORDS.map(r => r.batch)).sort().join(', ');

            const rebuildSelect = (sel, values, allLabel) => {
                const cur = sel.value;
                sel.innerHTML = allLabel ? `<option value="">${allLabel}</option>` : '';
                values.forEach(v => {
                    const o = document.createElement('option'); o.value = v; o.textContent = v;
                    sel.appendChild(o);
                });
                if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
            };

            rebuildSelect(dashBatch, uniq(RECORDS.map(r => r.batch)).sort(), 'All batches');
            rebuildSelect(repStudent, uniq(RECORDS.map(r => r.name)).sort(), null);
            rebuildSelect(batchSelect, uniq(RECORDS.map(r => r.batch)).sort(), null);
            if (typeof refreshNoteBatchSelects === 'function') refreshNoteBatchSelects();
            if (typeof refreshSimBatchSelects === 'function') refreshSimBatchSelects();
        }

        /* ============ Header meta ============ */
        document.getElementById('metaCount').textContent = uniq(RECORDS.map(r => r.id)).length;
        document.getElementById('metaBatches').textContent = uniq(RECORDS.map(r => r.batch)).sort().join(', ');

        /* ============ USER SESSION & ACTIVE VIEW PERSISTENCE ============ */
        const SESSION_KEY = 'sbte_session_v1';
        const ACTIVE_VIEW_KEY = 'sbte_active_view_v1';
        const ACTIVE_REPORT_KEY = 'sbte_active_report_v1';
        const ACTIVE_BATCH_KEY = 'sbte_active_batch_v1';

        function saveSession(user) {
            try {
                localStorage.setItem(SESSION_KEY, JSON.stringify(user));
            } catch (e) { }
        }

        function getSavedSession() {
            try {
                const s = localStorage.getItem(SESSION_KEY);
                return s ? JSON.parse(s) : null;
            } catch (e) {
                return null;
            }
        }

        function clearSession() {
            try {
                localStorage.removeItem(SESSION_KEY);
                localStorage.removeItem(ACTIVE_VIEW_KEY);
                localStorage.removeItem(ACTIVE_REPORT_KEY);
                localStorage.removeItem(ACTIVE_BATCH_KEY);
            } catch (e) { }
        }

        /* ============ Tabs & View Switching ============ */
        const tabBtns = document.querySelectorAll('nav.tabs button');

        function switchView(viewName) {
            if (!viewName) return;
            const targetView = document.getElementById('view-' + viewName);
            if (!targetView) return;

            tabBtns.forEach(b => b.classList.toggle('active', b.dataset.view === viewName));
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            targetView.classList.add('active');

            try {
                localStorage.setItem(ACTIVE_VIEW_KEY, viewName);
            } catch (e) { }

            if (viewName === 'notes' && typeof renderNotes === 'function') renderNotes();
            if (viewName === 'simulations' && typeof renderSims === 'function') renderSims();
            if (viewName === 'seating' && typeof renderSeating === 'function') renderSeating();
            if (viewName === 'attendance' && typeof renderAttendance === 'function') renderAttendance();
            if (typeof scheduleFit === 'function') setTimeout(scheduleFit, 60);
        }

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                switchView(btn.dataset.view);
            });
        });

        /* ============ DASHBOARD ============ */
        const dashSearch = document.getElementById('dashSearch');
        const dashBatch = document.getElementById('dashBatch');
        const dashMonth = document.getElementById('dashMonth');
        const dashBody = document.getElementById('dashBody');
        const dashEmpty = document.getElementById('dashEmpty');
        const dashCount = document.getElementById('dashCount');

        uniq(RECORDS.map(r => r.batch)).sort().forEach(b => {
            const o = document.createElement('option'); o.value = b; o.textContent = b;
            dashBatch.appendChild(o);
        });
        uniq(RECORDS.map(r => r.month)).sort(byMonthOrder).forEach(m => {
            const o = document.createElement('option'); o.value = m; o.textContent = m;
            dashMonth.appendChild(o);
        });

        let sortKey = 'name', sortDir = 1;

        function filteredRecords() {
            const q = dashSearch.value.trim().toLowerCase();
            const b = dashBatch.value;
            const m = dashMonth.value;
            return RECORDS.filter(r => {
                if (b && r.batch !== b) return false;
                if (m && r.month !== m) return false;
                if (q && !(r.name.toLowerCase().includes(q) || String(r.id).includes(q))) return false;
                return true;
            });
        }

        function renderDashboardOverview() {
            const el = document.getElementById('dashOverview');
            if (!el || !RECORDS.length) return;

            const totalStudents = uniq(RECORDS.map(r => r.name)).length;
            const totalRecords = RECORDS.length;
            const avgFinal = avg(RECORDS.map(r => r.final));
            const excellentPct = round1(RECORDS.filter(r => standing(r.final).label === 'Excellent').length / RECORDS.length * 100);

            const batches = uniq(RECORDS.map(r => r.batch)).sort();
            const batchAvgs = batches.map(b => ({ label: b, value: avg(RECORDS.filter(r => r.batch === b).map(r => r.final)) }));
            const topBatch = batchAvgs.slice().sort((a, b) => b.value - a.value)[0];
            const batchItems = batchAvgs.map(b => ({ ...b, color: topBatch && b.label === topBatch.label ? 'var(--sky-dark)' : 'var(--sky)' }));

            const buckets = [
                { label: '0-59', min: 0, max: 59 },
                { label: '60-69', min: 60, max: 69 },
                { label: '70-79', min: 70, max: 79 },
                { label: '80-89', min: 80, max: 89 },
                { label: '90-100', min: 90, max: 100 },
            ];
            const distCounts = buckets.map(b => ({ label: b.label, value: RECORDS.filter(r => r.final >= b.min && r.final <= b.max).length }));
            const maxDist = Math.max(...distCounts.map(d => d.value), 1);
            const distChartItems = distCounts.map(d => ({ ...d, height: d.value / maxDist * 100 }));

            const months = uniq(RECORDS.map(r => r.month)).sort(byMonthOrder);
            const monthAvgs = months.map(m => ({ label: m.slice(0, 3), value: avg(RECORDS.filter(r => r.month === m).map(r => r.final)), height: avg(RECORDS.filter(r => r.month === m).map(r => r.final)), color: 'var(--sky-dark)' }));

            el.innerHTML = `
    <div class="kpi-strip">
      <div class="kpi-card"><div class="kpi-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></div><div class="kpi-label">Students</div><div class="kpi-value">${totalStudents}</div></div>
      <div class="kpi-card"><div class="kpi-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="3" x2="8" y2="17"></line><line x1="12" y1="3" x2="12" y2="17"></line><line x1="16" y1="3" x2="16" y2="17"></line></svg></div><div class="kpi-label">Records On File</div><div class="kpi-value">${totalRecords}</div></div>
      <div class="kpi-card"><div class="kpi-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="9"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg></div><div class="kpi-label">Avg Final Score</div><div class="kpi-value">${avgFinal}</div></div>
      <div class="kpi-card"><div class="kpi-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></div><div class="kpi-label">Excellent Standing</div><div class="kpi-value">${excellentPct}%</div></div>
      <div class="kpi-card"><div class="kpi-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 9 7 4 10 9"></polyline><polyline points="3 22 10 22 19 16 12 22 16 14 21 8 12 8 3 15 12 22"></polyline></svg></div><div class="kpi-label">Top Batch</div><div class="kpi-value" style="font-size:calc(15px * var(--fs, 1));">${topBatch ? topBatch.label : '—'}</div><div class="kpi-sub">${topBatch ? topBatch.value + ' avg final' : ''}</div></div>
    </div>
    <div class="dash-charts">
      <div class="chart-card cc-dist">
        <div class="chart-block">
          <div class="chart-title">Score Distribution (All Records)</div>
          <div class="cslot" data-c="dist">${svgVerticalBars(distChartItems, { height: 180, maxHeight: 100, aria: 'Score distribution across all records' })}</div>
        </div>
      </div>
      <div class="chart-card cc-batch">
        <div class="chart-block">
          <div class="chart-title">Average Final Score By Batch</div>
          <div class="cslot" data-c="batch">${svgHorizontalBars(batchItems, { max: 100, aria: 'Average final score by batch' })}</div>
        </div>
      </div>
      ${months.length > 1 ? `
      <div class="chart-card cc-month">
        <div class="chart-block">
          <div class="chart-title">Average Final Score By Month</div>
          <div class="cslot" data-c="month">${svgVerticalBars(monthAvgs, { height: 180, maxHeight: 100, aria: 'Average final score by month' })}</div>
        </div>
      </div>` : ''}
    </div>
  `;
            CHDATA = {
                dist: { type: 'v', items: distChartItems, aria: 'Score distribution across all records' },
                batch: { type: 'h', items: batchItems, aria: 'Average final score by batch' },
                month: { type: 'v', items: monthAvgs, aria: 'Average final score by month' }
            };
            scheduleFit();
        }

        function renderDashboard() {
            let rows = filteredRecords();
            rows = rows.slice().sort((a, b) => {
                let av = a[sortKey], bv = b[sortKey];
                if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
                if (av < bv) return -1 * sortDir;
                if (av > bv) return 1 * sortDir;
                return 0;
            });
            dashBody.innerHTML = '';
            dashEmpty.style.display = rows.length ? 'none' : 'block';
            dashCount.textContent = rows.length + (rows.length === 1 ? ' record' : ' records');

            rows.forEach(r => {
                const st = standing(r.final);
                const tr = document.createElement('tr');
                tr.innerHTML = `
      <td class="name-cell" data-label="Student">${r.name}</td>
      <td class="id-cell" data-label="ID">${r.id}</td>
      <td data-label="Month">${r.month}</td>
      <td data-label="Batch">${r.batch}</td>
      <td data-label="Class Test /100">${r.testTotal}</td>
      <td data-label="Regularity">${r.reg}</td>
      <td data-label="Final"><strong>${r.final}</strong></td>
      <td data-label="Standing"><span class="badge ${st.cls}">${st.label}</span></td>
      <td class="admin-only td-action" data-label="Action">
        <button type="button" class="tbl-del-btn" title="Delete this entry from master sheet" aria-label="Delete entry"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
      </td>
    `;
                tr.addEventListener('click', (e) => {
                    if (e.target.closest('.tbl-del-btn')) return;
                    openReportFor(r);
                });
                const delBtn = tr.querySelector('.tbl-del-btn');
                if (delBtn) {
                    delBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        confirmDeleteRow(r);
                    });
                }
                dashBody.appendChild(tr);
            });

            renderDashboardOverview();
        }

        document.querySelectorAll('thead th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.dataset.sort;
                if (sortKey === key) sortDir *= -1; else { sortKey = key; sortDir = 1; }
                document.querySelectorAll('thead .arrow').forEach(a => a.textContent = '');
                th.querySelector('.arrow').textContent = sortDir === 1 ? 'â–²' : 'â–¼';
                renderDashboard();
            });
        });

        document.querySelectorAll('nav.tabs button').forEach(btn => {
            btn.addEventListener('click', () => {
                try { btn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); } catch (e) { }
            });
        });

        [dashSearch, dashBatch, dashMonth].forEach(el => el.addEventListener('input', renderDashboard));

        document.getElementById('dashSort').addEventListener('change', e => {
            const [k, d] = e.target.value.split(':');
            sortKey = k; sortDir = parseInt(d, 10);
            document.querySelectorAll('thead .arrow').forEach(a => a.textContent = '');
            const th = document.querySelector('thead th[data-sort="' + k + '"]');
            if (th) th.querySelector('.arrow').textContent = sortDir === 1 ? 'â–²' : 'â–¼';
            renderDashboard();
        });

        document.getElementById('dashDownloadCsv').addEventListener('click', () => {
            const rows = filteredRecords();
            const headers = ["Name", "ID", "Month", "Batch", "ClassTestTotal", "Presentation", "Assignment", "Regularity", "Event", "SocialWork", "FinalScore", "Standing"];
            const body = rows.map(r => [r.name, r.id, r.month, r.batch, r.testTotal, r.pres, r.assign, r.reg, r.event, r.sw, r.final, standing(r.final).label]);
            downloadCsv('sbte_register_filtered.csv', [headers, ...body]);
        });

        document.getElementById('dashDownloadAll').addEventListener('click', () => {
            downloadJson('sbte_full_dataset.json', RECORDS);
        });

        /* ============ REPORT CARD ============ */
        const repStudent = document.getElementById('repStudent');
        const repMonth = document.getElementById('repMonth');
        const reportOutput = document.getElementById('reportOutput');

        uniq(RECORDS.map(r => r.name)).sort().forEach(n => {
            const o = document.createElement('option'); o.value = n; o.textContent = n;
            repStudent.appendChild(o);
        });

        function refreshReportMonths() {
            const name = repStudent.value;
            const months = uniq(RECORDS.filter(r => r.name === name).map(r => r.month)).sort(byMonthOrder);
            repMonth.innerHTML = '';
            months.forEach(m => {
                const o = document.createElement('option'); o.value = m; o.textContent = m;
                repMonth.appendChild(o);
            });
        }
        refreshReportMonths();

        let reportEditMode = false;
        const editReportBtn = document.getElementById('editReportBtn');
        const saveReportBtn = document.getElementById('saveReportBtn');
        const cancelReportBtn = document.getElementById('cancelReportBtn');
        const printReportBtn = document.getElementById('printReportBtn');
        const downloadReportBtn = document.getElementById('downloadReportBtn');

        function metricRow(label, raw, rawMax, weighted, weightedMax) {
            const pct = Math.min(100, (weighted / weightedMax) * 100);
            return `
    <div class="metric-row">
      <div>
        <div>${label}</div>
        <div class="bar-track bar"><div class="bar-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="raw">${raw} / ${rawMax}</div>
      <div class="wt">${weighted}</div>
      <div></div>
    </div>`;
        }

        function metricRowEdit(label, id, val, maxVal) {
            return `
    <div class="metric-row">
      <div>${label}</div>
      <div class="raw"><input class="edit-input" type="number" min="0" max="${maxVal}" step="1" id="${id}" value="${val}"> /${maxVal}</div>
      <div></div>
      <div></div>
    </div>`;
        }

        function renderReport(r) {
            if (!r) { reportOutput.innerHTML = '<div class="empty-state">No record found for this student in that month.</div>'; return; }
            reportEditMode ? renderReportEdit(r) : renderReportView(r);
        }

        function reportCharts(r) {
            const catItems = [
                { label: 'Class Test', value: r.testW, max: 40 },
                { label: 'Present.', value: r.presW, max: 10 },
                { label: 'Assign.', value: r.assignW, max: 10 },
                { label: 'Regular.', value: r.regW, max: 20 },
                { label: 'Event', value: r.eventW, max: 10 },
                { label: 'Soc.Work', value: r.swW, max: 10 },
            ].map(c => ({ ...c, height: c.max ? (c.value / c.max * 100) : 0 }));

            const st = standing(r.final);
            const donutItems = catItems.map(c => ({ label: c.label, value: c.value }));

            const studentMonths = RECORDS.filter(x => x.name === r.name).slice().sort((a, b) => byMonthOrder(a.month, b.month));
            let trendBlock = '';
            if (studentMonths.length > 1) {
                const trendItems = studentMonths.map(m => ({ label: m.month.slice(0, 3), value: m.final, height: m.final, color: m.month === r.month ? 'var(--sky-dark)' : 'var(--sky)' }));
                trendBlock = `
      <div class="chart-block" style="border-top:1px solid var(--rule-soft);">
        <div class="chart-title">Final Score Trend By Month</div>
        ${svgVerticalBars(trendItems, { height: Math.round(170 * LAYOUT.rep.gh / 100), maxHeight: 100, aria: 'Final score trend by month' })}
      </div>`;
            }

            return `
    <div class="report-card">
      <div class="chart-block">
        <div class="chart-title">Category Shape</div>
        ${svgRadar(catItems, { size: 280, aria: 'Category shape radar' })}
      </div>
      <div class="chart-block" style="border-top:1px solid var(--rule-soft);">
        <div class="chart-title">Category Breakdown (Weighted Score vs. Category Cap)</div>
        ${svgVerticalBars(catItems, { height: Math.round(190 * LAYOUT.rep.gh / 100), maxHeight: 100, aria: 'Weighted category scores' })}
      </div>
      <div class="chart-block" style="border-top:1px solid var(--rule-soft);">
        <div class="chart-title">Final Score Composition</div>
        <div class="donut-row">
          ${svgDonut(donutItems, { size: 170, centerValue: r.final, centerLabel: st.label, aria: 'Final score composition by category' })}
          <div class="donut-legend">
            ${donutItems.map((d, i) => `<span class="dl-item"><i style="background:${['var(--sky-dark)', 'var(--sky)', '#0F172A', '#33587A', '#A8701F', '#2E6B4C', '#A13C3C'][i % 7]}"></i>${d.label} <b>${d.value}</b></span>`).join('')}
          </div>
        </div>
      </div>
      ${trendBlock}
    </div>
  `;
        }

        function renderReportView(r) {
            const st = standing(r.final);
            const ins = reportInsights(r);
            reportOutput.innerHTML = `
    <div class="report-layout">
    <div class="report-col-side">
    <div class="report-card">
      <div class="report-head">
        <div>
          <h3>${r.name}</h3>
          <div class="rh-sub">${r.month} — Monthly Evaluation</div>
        </div>
        <div class="final-ring" style="--pct:${r.final}; --ring-color:${st.color};">
          <div class="final-stamp" style="color:${st.color};">
            <div class="num">${r.final}</div>
            <div class="lbl">${st.label.toUpperCase()}</div>
          </div>
        </div>
      </div>
      <div class="report-id-row">
        <div><span>Student ID</span>${r.id}</div>
        <div><span>Batch code</span>${r.batch}</div>
        <div><span>Grade</span>${gradeLetter(r.final)}</div>
      </div>
      <div class="insight-grid">
        <div class="insight-card"><div class="ic-label">Class Rank</div><div class="ic-value">${ordinal(ins.rank)} <small>of ${ins.total}</small></div></div>
        <div class="insight-card"><div class="ic-label">Vs Batch Avg</div><div class="ic-value" style="color:${ins.diff >= 0 ? '#15803D' : '#B91C1C'};">${ins.diff >= 0 ? '+' : ''}${ins.diff}</div></div>
        <div class="insight-card"><div class="ic-label">Strongest Area</div><div class="ic-value">${ins.best.label}</div></div>
        <div class="insight-card"><div class="ic-label">Needs Attention</div><div class="ic-value">${ins.weak.label}</div></div>
        <div class="insight-card"><div class="ic-label">Highest Test</div><div class="ic-value">${ins.highestTest} <small>/20</small></div></div>
        <div class="insight-card"><div class="ic-label">Lowest Test</div><div class="ic-value">${ins.lowestTest} <small>/20</small></div></div>
      </div>
      <div class="metric-row head">
        <div>Category</div><div style="text-align:right;">Raw</div><div style="text-align:right;">Weighted</div><div></div>
      </div>
      ${metricRow("Class Test (T1—T5)", r.testTotal, 100, r.testW, 40)}
      ${metricRow("Presentation", r.pres, 100, r.presW, 10)}
      ${metricRow("Assignment", r.assign, 100, r.assignW, 10)}
      ${metricRow("Regularity &amp; punctuality", r.reg, 100, r.regW, 20)}
      ${metricRow("Event participation", r.event, 100, r.eventW, 10)}
      ${metricRow("Social work", r.sw, 100, r.swW, 10)}
      <div class="report-tests">
        <div class="tt-label">Individual class tests (/20 each)</div>
        ${r.test.map((v, i) => `<span class="chip ${tierClass(v, 20)}">T${i + 1}: ${v}</span>`).join('')}
      </div>
      <div class="remark-box">
        <div class="rb-label">Teacher's Remark</div>
        <div class="rb-text">${studentRemark(r, ins)}</div>
      </div>
      <div class="report-foot">
        <span>Weighted per policy: Class Test 40% · Presentation 10% · Assignment 10% · Regularity 20% · Event 10% · Social work 10%</span>
      </div>
    </div>
    </div>
    <div class="report-col-side">
      ${reportCharts(r)}
    </div>
    </div>
  `;
        }

        function renderReportEdit(r) {
            reportOutput.innerHTML = `
    <div class="report-card">
      <div class="report-head">
        <div>
          <h3>${r.name}</h3>
          <div class="rh-sub">${r.month} — Editing record</div>
        </div>
      </div>
      <div class="edit-identity-grid">
        <div>
          <label class="edit-label" for="editName">Student name</label>
          <input class="edit-input" style="width:100%;text-align:left;" id="editName" value="${r.name}">
        </div>
        <div>
          <label class="edit-label" for="editId">Student ID</label>
          <input class="edit-input" style="width:100%;text-align:left;" id="editId" value="${r.id}">
        </div>
        <div>
          <label class="edit-label" for="editBatch">Batch code</label>
          <input class="edit-input" style="width:100%;text-align:left;" id="editBatch" value="${r.batch}">
        </div>
      </div>
      <div class="report-tests">
        <div class="tt-label">Class tests (/20 each)</div>
        ${r.test.map((v, i) => `<span class="chip">T${i + 1}: <input class="edit-input" style="width:34px;" type="number" min="0" max="20" step="0.5" id="editTest${i}" value="${v}"></span>`).join('')}
      </div>
      ${metricRowEdit("Presentation", "editPres", r.pres, 100)}
      ${metricRowEdit("Assignment", "editAssign", r.assign, 100)}
      ${metricRowEdit("Regularity &amp; punctuality", "editReg", r.reg, 100)}
      ${metricRowEdit("Event participation", "editEvent", r.event, 100)}
      ${metricRowEdit("Social work", "editSw", r.sw, 100)}
      <div class="report-foot">
        <span>Weighted scores and the final score recalculate automatically when you save.</span>
      </div>
    </div>
  `;
        }

        function saveActiveReportState() {
            try {
                localStorage.setItem(ACTIVE_REPORT_KEY, JSON.stringify({
                    student: repStudent.value,
                    month: repMonth.value
                }));
            } catch (e) { }
        }

        function saveActiveBatchState() {
            try {
                localStorage.setItem(ACTIVE_BATCH_KEY, JSON.stringify({
                    batch: batchSelect.value,
                    month: batchMonth.value
                }));
            } catch (e) { }
        }

        function openReportFor(r) {
            repStudent.value = r.name;
            refreshReportMonths();
            repMonth.value = r.month;
            reportEditMode = false;
            toggleEditButtons();
            renderReport(r);
            saveActiveReportState();
            switchView('report');
        }

        function currentReportRecord() {
            return RECORDS.find(r => r.name === repStudent.value && r.month === repMonth.value);
        }

        function toggleEditButtons() {
            editReportBtn.style.display = reportEditMode ? 'none' : '';
            saveReportBtn.style.display = reportEditMode ? '' : 'none';
            cancelReportBtn.style.display = reportEditMode ? '' : 'none';
        }

        editReportBtn.addEventListener('click', () => {
            reportEditMode = true;
            toggleEditButtons();
            renderReport(currentReportRecord());
        });

        cancelReportBtn.addEventListener('click', () => {
            reportEditMode = false;
            toggleEditButtons();
            renderReport(currentReportRecord());
        });

        saveReportBtn.addEventListener('click', () => {
            const r = currentReportRecord();
            if (!r) return;
            const oldKey = recKey(r);
            const num = id => Math.max(0, Number(document.getElementById(id).value) || 0);

            const newName = document.getElementById('editName').value.trim();
            const newId = document.getElementById('editId').value.trim();
            const newBatch = document.getElementById('editBatch').value.trim();
            r.name = newName || r.name;
            r.id = newId || r.id;
            r.batch = newBatch || r.batch;

            r.test = [0, 1, 2, 3, 4].map(i => Math.min(20, num('editTest' + i)));
            r.pres = Math.min(100, num('editPres'));
            r.assign = Math.min(100, num('editAssign'));
            r.reg = Math.min(100, num('editReg'));
            r.event = Math.min(100, num('editEvent'));
            r.sw = Math.min(100, num('editSw'));

            r.testTotal = round1(r.test.reduce((s, v) => s + v, 0));
            r.testW = round1(r.testTotal / 100 * 40);
            r.presW = round1(r.pres / 100 * 10);
            r.assignW = round1(r.assign / 100 * 10);
            r.regW = round1(r.reg / 100 * 20);
            r.eventW = round1(r.event / 100 * 10);
            r.swW = round1(r.sw / 100 * 10);
            r.final = round1(r.testW + r.presW + r.assignW + r.regW + r.eventW + r.swW);

            reportEditMode = false;
            toggleEditButtons();
            rebuildSelectors();
            repStudent.value = r.name;
            refreshReportMonths();
            repMonth.value = r.month;
            refreshBatchMonths();
            renderReport(r);
            renderDashboard();
            renderBatch();

            if (USING_FIREBASE && FB) {
                const newKey = recKey(r);
                const writes = [];
                if (newKey !== oldKey) writes.push(FB.remove(FB.ref(FB.db, 'records/' + oldKey)));
                writes.push(FB.set(FB.ref(FB.db, 'records/' + newKey), r));
                Promise.all(writes).then(() => setCloudStatus('connected')).catch(err => {
                    console.warn('Firebase save failed:', err);
                    setCloudStatus('offline');
                });
            }
        });

        printReportBtn.addEventListener('click', () => window.print());

        downloadReportBtn.addEventListener('click', () => {
            const r = currentReportRecord();
            if (!r) return;
            const headers = ["Name", "ID", "Month", "Batch", "T1", "T2", "T3", "T4", "T5", "ClassTestTotal", "ClassTest(40%)", "Presentation", "Pres(10%)", "Assignment", "Assign(10%)", "Regularity", "Reg(20%)", "Event", "Event(10%)", "SocialWork", "SW(10%)", "FinalScore"];
            const row = [r.name, r.id, r.month, r.batch, ...r.test, r.testTotal, r.testW, r.pres, r.presW, r.assign, r.assignW, r.reg, r.regW, r.event, r.eventW, r.sw, r.swW, r.final];
            downloadCsv(`${r.name}_${r.month}_report.csv`, [headers, row]);
        });

        /* ---- in-page dialogs (browser prompt()/confirm() can be blocked, so they are not used) ---- */
        const escH = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const withTimeout = (pr, ms, msg) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error(msg || 'The cloud database did not respond in time. Check your connection and try again.')), ms))]);
        function showToast(msg) {
            const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
            document.body.appendChild(t); setTimeout(() => t.remove(), 4500);
        }
        function openDialog({ title, body, confirmLabel, danger, typeToConfirm, onConfirm }) {
            const wrap = document.createElement('div'); wrap.className = 'dlg-back';
            wrap.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" aria-label="${escH(title)}" tabindex="-1">
        <h3>${escH(title)}</h3><div class="dlg-body">${body}</div>
        ${typeToConfirm ? `<label class="dlg-type">Type <b>${typeToConfirm}</b> to confirm<input type="text" autocomplete="off"></label>` : ''}
        <div class="dlg-err" role="alert"></div>
        <div class="dlg-btns"><button type="button" class="btn ghost" data-d="cancel">Cancel</button><button type="button" class="btn ${danger ? 'danger-solid' : 'primary'}" data-d="ok">${escH(confirmLabel)}</button></div></div>`;
            document.body.appendChild(wrap);
            const ok = wrap.querySelector('[data-d="ok"]'), inp = wrap.querySelector('input'), err = wrap.querySelector('.dlg-err');
            const close = () => wrap.remove(), armed = () => !inp || inp.value.trim() === typeToConfirm;
            ok.disabled = !armed();
            if (inp) { inp.addEventListener('input', () => { ok.disabled = !armed(); }); inp.focus(); } else ok.focus();
            wrap.addEventListener('click', e => { if (e.target === wrap || e.target.dataset.d === 'cancel') close(); });
            wrap.addEventListener('keydown', e => { if (e.key === 'Escape') close(); if (e.key === 'Enter' && !ok.disabled && e.target !== wrap.querySelector('[data-d="cancel"]')) ok.click(); });
            ok.addEventListener('click', async () => {
                const label = ok.textContent; ok.disabled = true; ok.textContent = 'Working…'; err.textContent = '';
                try { await onConfirm(); close(); }
                catch (e) {
                    const m = (e && e.message) || String(e);
                    err.textContent = /permission/i.test(m) ? 'The cloud database refused the deletion (permission denied). The Firebase rules must allow deleting records.' : m;
                    ok.textContent = label; ok.disabled = !armed();
                }
            });
        }

        /* ============ DELETE STUDENT & RECORD LOGIC (FIXED) ============ */
        async function performDelete(recordsToDelete, studentLabel) {
            if (!recordsToDelete || !recordsToDelete.length) return;
            const count = recordsToDelete.length;

            // 1. Remove from cloud database if Firebase is available
            if (USING_FIREBASE && FB) {
                try {
                    const keysToRemove = new Set(recordsToDelete.map(r => recKey(r)));
                    try {
                        const snap = await Promise.race([
                            FB.get(FB.ref(FB.db, 'records')),
                            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))
                        ]);
                        if (snap && snap.exists()) {
                            snap.forEach(ch => {
                                const v = ch.val();
                                if (v && recordsToDelete.some(r => String(r.name).trim().toLowerCase() === String(v.name).trim().toLowerCase() && String(r.id) === String(v.id) && String(r.month).toLowerCase() === String(v.month).toLowerCase())) {
                                    keysToRemove.add(ch.key);
                                }
                            });
                        }
                    } catch (e) {
                        console.warn('Cloud scan note:', e);
                    }
                    await Promise.allSettled([...keysToRemove].map(k => FB.remove(FB.ref(FB.db, 'records/' + k))));
                } catch (err) {
                    console.warn('Cloud delete warning:', err);
                }
            }

            // 2. Remove from local in-memory RECORDS array
            for (let i = RECORDS.length - 1; i >= 0; i--) {
                if (recordsToDelete.includes(RECORDS[i])) {
                    RECORDS.splice(i, 1);
                }
            }

            // 3. Immediately refresh UI
            reportEditMode = false;
            toggleEditButtons();
            rebuildSelectors();

            if (repStudent.options.length) {
                if (![...repStudent.options].some(o => o.value === repStudent.value)) {
                    repStudent.value = repStudent.options[0].value;
                }
            }
            refreshReportMonths();
            refreshBatchMonths();
            renderDashboard();
            renderDashboardOverview();
            renderReport(currentReportRecord());
            renderBatch();

            showToast(`${studentLabel} deleted successfully (${count} record${count > 1 ? 's' : ''} removed).`);
        }

        function confirmDeleteRow(rec) {
            openDialog({
                title: 'Delete Record from Master Sheet',
                danger: true,
                confirmLabel: 'Delete Entry',
                body: `<p>Are you sure you want to delete the evaluation entry for <b>${escH(rec.name)}</b> (ID: ${escH(rec.id)}) for <b>${escH(rec.month)}</b> (Batch: ${escH(rec.batch)})?</p>
                       <p class="set-hint">This will permanently remove this monthly record from the master sheet.</p>`,
                onConfirm: async () => {
                    await performDelete([rec], `${rec.name} (${rec.month})`);
                }
            });
        }

        document.getElementById('deleteStudentBtn').addEventListener('click', () => {
            const cur = currentReportRecord() || RECORDS.find(r => r.name === repStudent.value);
            if (!cur) { showToast('Select a student first.'); return; }
            const same = r => String(r.name).trim().toLowerCase() === String(cur.name).trim().toLowerCase() && String(r.id) === String(cur.id);
            const mine = RECORDS.filter(same);
            if (!mine.length) { showToast('No records found for this student.'); return; }
            if (uniq(RECORDS.map(r => r.id)).length <= 1) { showToast('At least one student must remain in the master sheet.'); return; }
            openDialog({
                title: 'Delete Student Data',
                danger: true,
                confirmLabel: 'Delete Permanently',
                body: `<p>This will permanently remove <b>${escH(cur.name)}</b> (ID: ${escH(cur.id)}) and all <b>${mine.length}</b> monthly record(s) from the master sheet.</p>
                       <p class="set-hint">All report cards and test records on file for this student will be deleted.</p>`,
                onConfirm: async () => {
                    await performDelete(mine, `${cur.name} (all records)`);
                }
            });
        });

        /* ============ NEW STUDENT DATA ENTRY FEATURE ============ */
        const newStuModal = document.getElementById('newStudentModal');
        const openNewStudentBtn = document.getElementById('openNewStudentBtn');
        const closeNewStudentModalBtn = document.getElementById('closeNewStudentModalBtn');
        const cancelNewStudentBtn = document.getElementById('cancelNewStudentBtn');
        const saveNewStudentBtn = document.getElementById('saveNewStudentBtn');
        const saveAddAnotherBtn = document.getElementById('saveAddAnotherBtn');
        const newStudentErr = document.getElementById('newStudentErr');
        const newStuBatch = document.getElementById('newStuBatch');
        const newStuBatchCustom = document.getElementById('newStuBatchCustom');

        function populateBatchDropdown() {
            const batches = uniq(RECORDS.map(r => r.batch)).sort();
            newStuBatch.innerHTML = '';
            batches.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b;
                opt.textContent = b;
                newStuBatch.appendChild(opt);
            });
            const customOpt = document.createElement('option');
            customOpt.value = '__new__';
            customOpt.textContent = 'âž• Add New Batch...';
            newStuBatch.appendChild(customOpt);
            newStuBatchCustom.style.display = 'none';
            newStuBatchCustom.value = '';
        }

        newStuBatch.addEventListener('change', () => {
            if (newStuBatch.value === '__new__') {
                newStuBatchCustom.style.display = 'block';
                newStuBatchCustom.focus();
            } else {
                newStuBatchCustom.style.display = 'none';
            }
        });

        function calcNewStudentScores() {
            const num = (id, max) => Math.max(0, Math.min(max, Number(document.getElementById(id).value) || 0));
            const test = [0, 1, 2, 3, 4].map(i => num('newTest' + i, 20));
            const reg = num('newReg', 100);
            const pres = num('newPres', 100);
            const assign = num('newAssign', 100);
            const event = num('newEvent', 100);
            const sw = num('newSw', 100);

            const testTotal = round1(test.reduce((a, b) => a + b, 0));
            const testW = round1(testTotal / 100 * 40);
            const presW = round1(pres / 100 * 10);
            const assignW = round1(assign / 100 * 10);
            const regW = round1(reg / 100 * 20);
            const eventW = round1(event / 100 * 10);
            const swW = round1(sw / 100 * 10);
            const finalScore = round1(testW + presW + assignW + regW + eventW + swW);

            document.getElementById('lblTestTotal').textContent = testTotal;
            document.getElementById('lblTestW').textContent = testW.toFixed(1);
            document.getElementById('lblFinalScore').innerHTML = `${finalScore.toFixed(1)} <small>/ 100</small>`;

            const st = standing(finalScore);
            const stEl = document.getElementById('lblStanding');
            stEl.className = 'badge ' + st.cls;
            stEl.textContent = st.label;

            return { test, testTotal, testW, pres, presW, assign, assignW, reg, regW, event, eventW, sw, swW, final: finalScore };
        }

        const scoreInputs = ['newTest0', 'newTest1', 'newTest2', 'newTest3', 'newTest4', 'newReg', 'newPres', 'newAssign', 'newEvent', 'newSw'];
        scoreInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', calcNewStudentScores);
        });

        function getNextStudentId() {
            const ids = RECORDS.map(r => Number(r.id)).filter(n => !isNaN(n) && n > 0);
            return ids.length ? Math.max(...ids) + 1 : 1534600;
        }

        function openNewStudentDialog() {
            populateBatchDropdown();
            document.getElementById('newStuName').value = '';
            document.getElementById('newStuId').value = getNextStudentId();
            newStudentErr.style.display = 'none';
            newStudentErr.textContent = '';
            calcNewStudentScores();
            newStuModal.hidden = false;
            document.getElementById('newStuName').focus();
        }

        function closeNewStudentDialog() {
            newStuModal.hidden = true;
        }

        if (openNewStudentBtn) openNewStudentBtn.addEventListener('click', openNewStudentDialog);
        if (closeNewStudentModalBtn) closeNewStudentModalBtn.addEventListener('click', closeNewStudentDialog);
        if (cancelNewStudentBtn) cancelNewStudentBtn.addEventListener('click', closeNewStudentDialog);
        newStuModal.addEventListener('click', (e) => {
            if (e.target === newStuModal) closeNewStudentDialog();
        });

        async function submitNewStudent(addAnother = false) {
            newStudentErr.style.display = 'none';
            newStudentErr.textContent = '';

            const name = document.getElementById('newStuName').value.trim();
            const idVal = Number(document.getElementById('newStuId').value.trim());
            const month = document.getElementById('newStuMonth').value;
            let batch = newStuBatch.value;
            if (batch === '__new__') {
                batch = newStuBatchCustom.value.trim();
                if (!batch) {
                    newStudentErr.textContent = 'Please enter a name for the new batch.';
                    newStudentErr.style.display = 'block';
                    newStuBatchCustom.focus();
                    return;
                }
            }

            if (!name) {
                newStudentErr.textContent = 'Please enter a student name.';
                newStudentErr.style.display = 'block';
                document.getElementById('newStuName').focus();
                return;
            }
            if (!idVal || isNaN(idVal)) {
                newStudentErr.textContent = 'Please enter a valid numeric Student ID.';
                newStudentErr.style.display = 'block';
                document.getElementById('newStuId').focus();
                return;
            }

            const scores = calcNewStudentScores();
            const newRecord = {
                id: idVal,
                name: name,
                month: month,
                batch: batch,
                test: scores.test,
                testTotal: scores.testTotal,
                testW: scores.testW,
                pres: scores.pres,
                presW: scores.presW,
                assign: scores.assign,
                assignW: scores.assignW,
                reg: scores.reg,
                regW: scores.regW,
                event: scores.event,
                eventW: scores.eventW,
                sw: scores.sw,
                swW: scores.swW,
                final: scores.final
            };

            // Check if student with same name and month already exists
            const existingIdx = RECORDS.findIndex(r => r.name.toLowerCase() === name.toLowerCase() && r.month.toLowerCase() === month.toLowerCase());
            if (existingIdx >= 0) {
                RECORDS[existingIdx] = newRecord;
            } else {
                RECORDS.push(newRecord);
            }

            // Sync to Firebase if connected
            if (USING_FIREBASE && FB) {
                try {
                    await FB.set(FB.ref(FB.db, 'records/' + recKey(newRecord)), newRecord);
                } catch (err) {
                    console.warn('Cloud sync error on adding student:', err);
                }
            }

            // Rebuild UI
            rebuildSelectors();
            refreshReportMonths();
            refreshBatchMonths();
            renderDashboard();
            renderDashboardOverview();
            renderBatch();

            showToast(`Entry for ${name} (${month}) saved to master sheet!`);

            if (addAnother) {
                document.getElementById('newStuName').value = '';
                document.getElementById('newStuId').value = getNextStudentId();
                document.getElementById('newStuName').focus();
            } else {
                closeNewStudentDialog();
                // Select in report card as well
                if ([...repStudent.options].some(o => o.value === name)) {
                    repStudent.value = name;
                    refreshReportMonths();
                    repMonth.value = month;
                    renderReport(currentReportRecord());
                }
            }
        }

        if (saveNewStudentBtn) saveNewStudentBtn.addEventListener('click', () => submitNewStudent(false));
        if (saveAddAnotherBtn) saveAddAnotherBtn.addEventListener('click', () => submitNewStudent(true));

        repStudent.addEventListener('change', () => { reportEditMode = false; toggleEditButtons(); refreshReportMonths(); renderReport(currentReportRecord()); saveActiveReportState(); });
        repMonth.addEventListener('change', () => { reportEditMode = false; toggleEditButtons(); renderReport(currentReportRecord()); saveActiveReportState(); });
        renderReport(currentReportRecord());

        /* ============ BATCH REPORT ============ */
        const batchSelect = document.getElementById('batchSelect');
        const batchMonth = document.getElementById('batchMonth');
        const batchOutput = document.getElementById('batchOutput');

        uniq(RECORDS.map(r => r.batch)).sort().forEach(b => {
            const o = document.createElement('option'); o.value = b; o.textContent = b;
            batchSelect.appendChild(o);
        });
        function refreshBatchMonths() {
            const b = batchSelect.value;
            const months = uniq(RECORDS.filter(r => r.batch === b).map(r => r.month)).sort(byMonthOrder);
            batchMonth.innerHTML = '';
            months.forEach(m => {
                const o = document.createElement('option'); o.value = m; o.textContent = m;
                batchMonth.appendChild(o);
            });
        }
        refreshBatchMonths();

        function avg(arr) { return arr.length ? round1(arr.reduce((s, v) => s + v, 0) / arr.length) : 0; }

        function batchCharts(rows) {
            const catItems = [
                { label: 'Class Test', value: avg(rows.map(r => r.testW)), max: 40 },
                { label: 'Present.', value: avg(rows.map(r => r.presW)), max: 10 },
                { label: 'Assign.', value: avg(rows.map(r => r.assignW)), max: 10 },
                { label: 'Regular.', value: avg(rows.map(r => r.regW)), max: 20 },
                { label: 'Event', value: avg(rows.map(r => r.eventW)), max: 10 },
                { label: 'Soc.Work', value: avg(rows.map(r => r.swW)), max: 10 },
            ].map(c => ({ ...c, height: c.max ? (c.value / c.max * 100) : 0 }));

            const distCounts = { Excellent: 0, Good: 0, Satisfactory: 0, 'Needs Improvement': 0 };
            rows.forEach(r => distCounts[standing(r.final).label]++);
            const distItems = Object.entries(distCounts)
                .filter(([, v]) => v > 0)
                .map(([label, value]) => ({ label, value, color: STANDING_COLORS[label] }));

            return `
    <div class="batch-card">
      <div class="chart-block">
        <div class="chart-title">Average Category Shape</div>
        ${svgRadar(catItems, { size: 280, aria: 'Average category shape radar' })}
      </div>
      <div class="chart-block" style="border-top:1px solid var(--rule-soft);">
        <div class="chart-title">Average Weighted Score By Category</div>
        ${svgVerticalBars(catItems, { height: Math.round(190 * LAYOUT.rep.gh / 100), maxHeight: 100, aria: 'Average weighted score by category' })}
      </div>
      <div class="chart-block" style="border-top:1px solid var(--rule-soft);">
        <div class="chart-title">Standing Distribution</div>
        <div class="donut-row">
          ${svgDonut(distItems, { size: 150, centerValue: rows.length, centerLabel: 'students', aria: 'Standing distribution donut' })}
          <div class="donut-legend">
            ${distItems.map(d => `<span class="dl-item"><i style="background:${d.color};"></i>${d.label} <b>${d.value}</b></span>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
        }

        function renderBatch() {
            const b = batchSelect.value, m = batchMonth.value;
            const rows = RECORDS.filter(r => r.batch === b && r.month === m);
            if (!rows.length) { batchOutput.innerHTML = '<div class="empty-state">No records for that batch and month.</div>'; return; }
            const metrics = [
                ["Avg Class Test /100", avg(rows.map(r => r.testTotal))],
                ["Avg Presentation /100", avg(rows.map(r => r.pres))],
                ["Avg Assignment /100", avg(rows.map(r => r.assign))],
                ["Avg Regularity /100", avg(rows.map(r => r.reg))],
                ["Avg Event Participation /100", avg(rows.map(r => r.event))],
                ["Avg Social Work /100", avg(rows.map(r => r.sw))],
                ["Students counted", rows.length],
            ];
            const finalAvg = avg(rows.map(r => r.final));
            const st = standing(finalAvg);

            const sorted = rows.slice().sort((a, b) => b.final - a.final);
            const top = sorted[0], bottom = sorted[sorted.length - 1];
            const finalsSorted = rows.map(r => r.final).slice().sort((a, b) => a - b);
            const mid = Math.floor(finalsSorted.length / 2);
            const median = finalsSorted.length % 2 ? finalsSorted[mid] : round1((finalsSorted[mid - 1] + finalsSorted[mid]) / 2);
            const passCount = rows.filter(r => r.final >= 60).length;
            const passRate = round1(passCount / rows.length * 100);

            const distCounts = { Excellent: 0, Good: 0, Satisfactory: 0, 'Needs Improvement': 0 };
            rows.forEach(r => distCounts[standing(r.final).label]++);

            batchOutput.innerHTML = `
    <div class="batch-layout">
    <div class="batch-col-side">
    <div class="batch-card">
      <div class="batch-head">
        <div>
          <h3>${b}</h3>
          <div class="rh-sub" style="font-size:calc(13px * var(--fs, 1));color:var(--ink-soft);">${m} — Batch Progress Report</div>
        </div>
        <div class="bh-avg" style="color:${st.color};">${finalAvg}<small>avg final score · ${st.label}</small></div>
      </div>
      <div class="batch-highlight-row">
        <div class="bh-card top">
          <div class="bhc-label">Top Performer</div>
          <div class="bhc-name">${top.name}</div>
          <div class="bhc-score">${top.final}</div>
        </div>
        <div class="bh-card bottom">
          <div class="bhc-label">Lowest Score</div>
          <div class="bhc-name">${bottom.name}</div>
          <div class="bhc-score">${bottom.final}</div>
        </div>
        <div class="bh-card">
          <div class="bhc-label">Median Final</div>
          <div class="bhc-score">${median}</div>
        </div>
        <div class="bh-card">
          <div class="bhc-label">Pass Rate (&ge;60)</div>
          <div class="bhc-score">${passRate}%</div>
        </div>
      </div>
      <div class="batch-grid">
        ${metrics.map(([label, val]) => `
          <div class="batch-metric">
            <div class="bm-label">${label}</div>
            <div class="bm-value">${val}</div>
          </div>`).join('')}
      </div>
      <div class="standing-dist">
        <div class="sd-title">Standing Distribution</div>
        <div class="sd-row">
          ${Object.entries(distCounts).map(([label, count]) => `<span class="sd-chip" style="border-color:${STANDING_COLORS[label]};color:${STANDING_COLORS[label]};">${label}: ${count}</span>`).join('')}
        </div>
      </div>
      <div class="batch-table-wrap">
        <div class="chart-title">Student Rankings</div>
        <div class="rank-table-scroll">
          <table class="rank-table">
            <thead><tr><th>#</th><th>Name</th><th>Student ID</th><th>Final</th><th>Grade</th><th>Standing</th></tr></thead>
            <tbody>
              ${sorted.map((r, i) => {
                const rst = standing(r.final);
                return `<tr>
                  <td>${i + 1}</td>
                  <td>${r.name}</td>
                  <td>${r.id}</td>
                  <td>${r.final}</td>
                  <td>${gradeLetter(r.final)}</td>
                  <td><span class="standing-tag" style="border-color:${STANDING_COLORS[rst.label]};color:${STANDING_COLORS[rst.label]};">${rst.label}</span></td>
                </tr>`;
            }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="batch-foot">Averaged across ${rows.length} student ${rows.length === 1 ? 'record' : 'records'} on file for this batch and month.</div>
    </div>
    </div>
    <div class="batch-col-side">
      ${batchCharts(rows)}
    </div>
    </div>
  `;
        }

        batchSelect.addEventListener('change', () => { refreshBatchMonths(); renderBatch(); saveActiveBatchState(); });
        batchMonth.addEventListener('change', () => { renderBatch(); saveActiveBatchState(); });
        renderBatch();

        document.getElementById('batchDownloadCsv').addEventListener('click', () => {
            const b = batchSelect.value, m = batchMonth.value;
            const rows = RECORDS.filter(r => r.batch === b && r.month === m);
            if (!rows.length) return;
            const headers = ["Batch", "Month", "AvgClassTest", "AvgPresentation", "AvgAssignment", "AvgRegularity", "AvgEvent", "AvgSocialWork", "AvgFinal", "StudentsCounted"];
            const row = [b, m, avg(rows.map(r => r.testTotal)), avg(rows.map(r => r.pres)), avg(rows.map(r => r.assign)), avg(rows.map(r => r.reg)), avg(rows.map(r => r.event)), avg(rows.map(r => r.sw)), avg(rows.map(r => r.final)), rows.length];
            downloadCsv(`${b}_${m}_batch_report.csv`, [headers, row]);
        });

        /* ============ NOTES ============ */
        let NOTES = [];
        const NOTES_LOCAL_KEY = 'sbte_notes_local_v1';
        const NOTE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

        function loadNotesLocal() {
            try { return JSON.parse(localStorage.getItem(NOTES_LOCAL_KEY) || '[]'); }
            catch (e) { return []; }
        }
        function saveNotesLocal() {
            try { localStorage.setItem(NOTES_LOCAL_KEY, JSON.stringify(NOTES)); }
            catch (e) { console.warn('Could not save notes locally (storage full?):', e); }
        }
        function noteId() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
        function formatBytes(n) {
            if (n < 1024) return n + ' B';
            if (n < 1024 * 1024) return round1(n / 1024) + ' KB';
            return round1(n / (1024 * 1024)) + ' MB';
        }
        function isAdminRole() { return document.body.classList.contains('role-admin'); }
        function currentStudentName() {
            return document.body.classList.contains('role-student') ? repStudent.value : null;
        }

        const noteBatch = document.getElementById('noteBatch');
        const notesFilterBatch = document.getElementById('notesFilterBatch');
        const notesList = document.getElementById('notesList');
        const notesCount = document.getElementById('notesCount');
        const noteUploadHint = document.getElementById('noteUploadHint');

        function refreshNoteBatchSelects() {
            const batches = uniq(RECORDS.map(r => r.batch)).sort();
            [noteBatch, notesFilterBatch].forEach(sel => {
                if (!sel) return;
                const cur = sel.value;
                sel.innerHTML = '<option value="">All batches</option>';
                batches.forEach(b => {
                    const o = document.createElement('option'); o.value = b; o.textContent = b;
                    sel.appendChild(o);
                });
                if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
            });
        }
        refreshNoteBatchSelects();

        function visibleNotes() {
            let list = NOTES.slice().sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
            if (isAdminRole()) {
                const f = notesFilterBatch.value;
                if (f) list = list.filter(n => n.batch === f);
            } else {
                const name = currentStudentName();
                const rec = name ? RECORDS.find(r => r.name === name) : null;
                const myBatch = rec ? rec.batch : null;
                list = list.filter(n => !n.batch || n.batch === myBatch);
            }
            return list;
        }

        function renderNotes() {
            if (!notesList) return;
            const list = visibleNotes();
            notesCount.textContent = `${list.length} note${list.length === 1 ? '' : 's'}`;
            if (!list.length) {
                notesList.innerHTML = '<div class="empty-state">No notes uploaded yet' + (isAdminRole() ? '.' : ' for your batch yet.') + '</div>';
                return;
            }
            notesList.innerHTML = list.map(n => `
    <div class="note-item" data-id="${n.id}">
      <div class="note-main">
        <div class="note-title-row">
          <span class="note-title">${escapeHtml(n.title)}</span>
          <span class="note-tag">${n.batch ? escapeHtml(n.batch) : 'All batches'}</span>
        </div>
        ${n.description ? `<div class="note-desc">${escapeHtml(n.description)}</div>` : ''}
        <div class="note-meta">${escapeHtml(n.fileName)} · ${formatBytes(n.fileSize)} · uploaded ${new Date(n.uploadedAt).toLocaleDateString()}</div>
      </div>
      <div class="note-actions">
        <button class="note-btn" data-action="download" data-id="${n.id}">Download</button>
        <button class="note-btn danger admin-only" data-action="delete" data-id="${n.id}">Delete</button>
      </div>
    </div>
  `).join('');
        }

        function escapeHtml(s) {
            return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }

        notesList && notesList.addEventListener('click', (e) => {
            const btn = e.target.closest('.note-btn');
            if (!btn) return;
            const id = btn.dataset.id;
            const n = NOTES.find(x => x.id === id);
            if (!n) return;
            if (btn.dataset.action === 'download') {
                const a = document.createElement('a');
                a.href = n.dataUrl; a.download = n.fileName;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
            } else if (btn.dataset.action === 'delete') {
                if (!isAdminRole()) return;
                if (!confirm(`Delete "${n.title}"? This can't be undone.`)) return;
                NOTES = NOTES.filter(x => x.id !== id);
                if (USING_FIREBASE && FB) {
                    FB.remove(FB.ref(FB.db, 'notes/' + id)).catch(err => console.warn('Note delete failed:', err));
                } else {
                    saveNotesLocal();
                }
                renderNotes();
            }
        });

        notesFilterBatch && notesFilterBatch.addEventListener('change', renderNotes);

        const uploadNoteBtn = document.getElementById('uploadNoteBtn');
        uploadNoteBtn && uploadNoteBtn.addEventListener('click', () => {
            if (!isAdminRole()) return;
            const titleEl = document.getElementById('noteTitle');
            const descEl = document.getElementById('noteDesc');
            const fileEl = document.getElementById('noteFile');
            const title = titleEl.value.trim();
            const desc = descEl.value.trim();
            const batch = noteBatch.value;
            const file = fileEl.files[0];

            if (!title) { alert('Please give the note a title.'); return; }
            if (!file) { alert('Please choose a file to upload.'); return; }
            if (file.size > NOTE_MAX_BYTES) { alert('That file is larger than 5 MB. Please upload a smaller file.'); return; }

            uploadNoteBtn.disabled = true;
            uploadNoteBtn.textContent = 'Uploading…';

            const reader = new FileReader();
            reader.onload = async () => {
                const note = {
                    id: noteId(),
                    title,
                    description: desc,
                    batch,
                    fileName: file.name,
                    fileType: file.type || 'application/octet-stream',
                    fileSize: file.size,
                    dataUrl: reader.result,
                    uploadedAt: new Date().toISOString(),
                };
                try {
                    NOTES.push(note);
                    if (USING_FIREBASE && FB) {
                        await FB.set(FB.ref(FB.db, 'notes/' + note.id), note);
                    } else {
                        saveNotesLocal();
                    }
                    titleEl.value = ''; descEl.value = ''; fileEl.value = '';
                    renderNotes();
                } catch (err) {
                    console.warn('Note upload failed:', err);
                    NOTES = NOTES.filter(x => x.id !== note.id);
                    alert('Upload failed — please try again.');
                } finally {
                    uploadNoteBtn.disabled = false;
                    uploadNoteBtn.textContent = 'Upload note';
                }
            };
            reader.onerror = () => {
                alert('Could not read that file — please try again.');
                uploadNoteBtn.disabled = false;
                uploadNoteBtn.textContent = 'Upload note';
            };
            reader.readAsDataURL(file);
        });

        // Local-only fallback: show notes immediately; Firebase boot (below) will
        // replace NOTES with the cloud copy and re-render once it's ready.
        NOTES = loadNotesLocal();
        renderNotes();

        /* ============ SIMULATIONS ============ */
        let SIMULATIONS = [];
        const SIMS_LOCAL_KEY = 'sbte_sims_local_v1';
        const SIM_MAX_BYTES = 2 * 1024 * 1024; // 2 MB of HTML source

        function loadSimsLocal() {
            try { return JSON.parse(localStorage.getItem(SIMS_LOCAL_KEY) || '[]'); }
            catch (e) { return []; }
        }
        function saveSimsLocal() {
            try { localStorage.setItem(SIMS_LOCAL_KEY, JSON.stringify(SIMULATIONS)); }
            catch (e) { console.warn('Could not save simulations locally (storage full?):', e); }
        }
        function simId() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

        const simBatch = document.getElementById('simBatch');
        const simsFilterBatch = document.getElementById('simsFilterBatch');
        const simsList = document.getElementById('simsList');
        const simsCount = document.getElementById('simsCount');

        function refreshSimBatchSelects() {
            const batches = uniq(RECORDS.map(r => r.batch)).sort();
            [simBatch, simsFilterBatch].forEach(sel => {
                if (!sel) return;
                const cur = sel.value;
                sel.innerHTML = '<option value="">All batches</option>';
                batches.forEach(b => {
                    const o = document.createElement('option'); o.value = b; o.textContent = b;
                    sel.appendChild(o);
                });
                if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
            });
        }
        refreshSimBatchSelects();

        function visibleSims() {
            let list = SIMULATIONS.slice().sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
            if (isAdminRole()) {
                const f = simsFilterBatch.value;
                if (f) list = list.filter(s => s.batch === f);
            } else {
                const name = currentStudentName();
                const rec = name ? RECORDS.find(r => r.name === name) : null;
                const myBatch = rec ? rec.batch : null;
                list = list.filter(s => !s.batch || s.batch === myBatch);
            }
            return list;
        }

        function renderSims() {
            if (!simsList) return;
            const list = visibleSims();
            simsCount.textContent = `${list.length} simulation${list.length === 1 ? '' : 's'}`;
            if (!list.length) {
                simsList.innerHTML = '<div class="empty-state">No simulations uploaded yet' + (isAdminRole() ? '.' : ' for your batch yet.') + '</div>';
                return;
            }
            simsList.innerHTML = list.map(s => `
    <div class="note-item" data-id="${s.id}">
      <div class="note-main">
        <div class="note-title-row">
          <span class="note-title">${escapeHtml(s.title)}</span>
          <span class="note-tag">${s.batch ? escapeHtml(s.batch) : 'All batches'}</span>
        </div>
        ${s.description ? `<div class="note-desc">${escapeHtml(s.description)}</div>` : ''}
        <div class="note-meta">${formatBytes(s.htmlCode.length)} · uploaded ${new Date(s.uploadedAt).toLocaleDateString()}</div>
      </div>
      <div class="note-actions">
        <button class="note-btn primary-ish" data-action="open" data-id="${s.id}">Open simulation â†—</button>
        <button class="note-btn" data-action="download" data-id="${s.id}">Download</button>
        <button class="note-btn danger admin-only" data-action="delete" data-id="${s.id}">Delete</button>
      </div>
    </div>
  `).join('');
        }

        simsList && simsList.addEventListener('click', (e) => {
            const btn = e.target.closest('.note-btn');
            if (!btn) return;
            const id = btn.dataset.id;
            const s = SIMULATIONS.find(x => x.id === id);
            if (!s) return;
            if (btn.dataset.action === 'open') {
                const blob = new Blob([s.htmlCode], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
            } else if (btn.dataset.action === 'download') {
                const url = URL.createObjectURL(new Blob([s.htmlCode], { type: 'text/html' }));
                const a = document.createElement('a');
                a.href = url; a.download = (String(s.title).replace(/[^\w\- ]+/g, '').trim() || 'simulation') + '.html';
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 2000);
            } else if (btn.dataset.action === 'delete') {
                if (!isAdminRole()) return;
                if (!confirm(`Delete "${s.title}"? This can't be undone.`)) return;
                SIMULATIONS = SIMULATIONS.filter(x => x.id !== id);
                if (USING_FIREBASE && FB) {
                    FB.remove(FB.ref(FB.db, 'simulations/' + id)).catch(err => console.warn('Simulation delete failed:', err));
                } else {
                    saveSimsLocal();
                }
                renderSims();
            }
        });

        simsFilterBatch && simsFilterBatch.addEventListener('change', renderSims);

        const uploadSimBtn = document.getElementById('uploadSimBtn');
        function resetSimUploadBtn() {
            uploadSimBtn.disabled = false;
            uploadSimBtn.textContent = 'Upload simulation';
        }
        async function persistSim(sim) {
            try {
                SIMULATIONS.push(sim);
                if (USING_FIREBASE && FB) {
                    await FB.set(FB.ref(FB.db, 'simulations/' + sim.id), sim);
                } else {
                    saveSimsLocal();
                }
                document.getElementById('simTitle').value = '';
                document.getElementById('simDesc').value = '';
                document.getElementById('simFile').value = '';
                document.getElementById('simCode').value = '';
                renderSims();
            } catch (err) {
                console.warn('Simulation upload failed:', err);
                SIMULATIONS = SIMULATIONS.filter(x => x.id !== sim.id);
                alert('Upload failed — please try again.');
            } finally {
                resetSimUploadBtn();
            }
        }

        uploadSimBtn && uploadSimBtn.addEventListener('click', () => {
            if (!isAdminRole()) return;
            const titleEl = document.getElementById('simTitle');
            const descEl = document.getElementById('simDesc');
            const fileEl = document.getElementById('simFile');
            const codeEl = document.getElementById('simCode');
            const title = titleEl.value.trim();
            const pastedCode = codeEl.value;
            const file = fileEl.files[0];

            if (!title) { alert('Please give the simulation a title.'); return; }
            if (!file && !pastedCode.trim()) { alert('Please upload an .html file, or paste the HTML code.'); return; }

            uploadSimBtn.disabled = true;
            uploadSimBtn.textContent = 'Uploading…';

            const finish = (htmlCode) => {
                if (!htmlCode || !htmlCode.trim()) {
                    alert('That file looks empty — please check it and try again.');
                    resetSimUploadBtn();
                    return;
                }
                if (new Blob([htmlCode]).size > SIM_MAX_BYTES) {
                    alert('That simulation is larger than 2 MB. Please trim it down.');
                    resetSimUploadBtn();
                    return;
                }
                const sim = {
                    id: simId(),
                    title,
                    description: descEl.value.trim(),
                    batch: simBatch.value,
                    htmlCode,
                    uploadedAt: new Date().toISOString(),
                };
                persistSim(sim);
            };

            if (file) {
                const reader = new FileReader();
                reader.onload = () => finish(reader.result);
                reader.onerror = () => { alert('Could not read that file — please try again.'); resetSimUploadBtn(); };
                reader.readAsText(file);
            } else {
                finish(pastedCode);
            }
        });

        // Local-only fallback: show simulations immediately; Firebase boot (below)
        // will replace SIMULATIONS with the cloud copy and re-render once ready.
        SIMULATIONS = loadSimsLocal();
        renderSims();

        /* ============ POLICY ============ */
        const policyBody = document.getElementById('policyBody');
        POLICY.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${p.cat}</td><td class="weight-tag">${p.weight}</td><td>${p.desc}</td>`;
            policyBody.appendChild(tr);
        });
        const totalTr = document.createElement('tr');
        totalTr.className = 'total';
        totalTr.innerHTML = `<td>TOTAL</td><td class="weight-tag">100%</td><td>Final Weighted Monthly Score</td>`;
        policyBody.appendChild(totalTr);

        // Weight-distribution donut, built from the same POLICY data as the table above
        const policyDonutPalette = ['var(--sky-dark)', 'var(--sky)', '#0F172A', '#33587A', '#A8701F', '#2E6B4C', '#A13C3C'];
        const policyDonutItems = POLICY.map((p, i) => ({ label: p.cat.split(':').pop().split('(')[0].trim(), value: parseFloat(p.weight), color: policyDonutPalette[i % policyDonutPalette.length] }));
        const policyDonutEl = document.getElementById('policyDonut');
        if (policyDonutEl) {
            policyDonutEl.innerHTML = svgDonut(policyDonutItems, { size: 150, centerValue: '100%', centerLabel: 'total weight', aria: 'Weight distribution across evaluation categories' });
        }
        const policyDonutLegendEl = document.getElementById('policyDonutLegend');
        if (policyDonutLegendEl) {
            policyDonutLegendEl.innerHTML = policyDonutItems.map(d => `<span class="dl-item"><i style="background:${d.color};"></i>${d.label} <b>${d.value}%</b></span>`).join('');
        }

        // Standing bands reference table (same cutoffs as the standing() function)
        const standingBandTable = document.getElementById('standingBandTable');
        if (standingBandTable) {
            standingBandTable.innerHTML = STANDING_BANDS.map(b => `
    <tr>
      <td><span class="band-swatch" style="background:${b.color};"></span><span class="band-label">${b.label}</span><span class="band-note">${b.note}</span></td>
      <td class="band-range">${b.range}</td>
    </tr>
  `).join('');
        }

        // Letter grade scale reference table (same cutoffs as the gradeLetter() function)
        const gradeBandTable = document.getElementById('gradeBandTable');
        if (gradeBandTable) {
            gradeBandTable.innerHTML = GRADE_BANDS.map(g => `
    <tr>
      <td><span class="grade-pill">${g.grade}</span></td>
      <td class="band-range">${g.range}</td>
    </tr>
  `).join('');
        }

        /* ============ Initial render ============ */
        renderDashboard();

        /* ============ STUDENT PASSWORDS ============
           Login = Student ID + password. Default password is the student's name; the admin can set a new one
           per student. Custom passwords are stored only as SHA-256 hashes (cloud: settings/studentPasswords). */
        const STU_PW_KEY = 'sbte_student_pw_v1';
        const STU_PW_PATH = 'settings/studentPasswords';
        let STU_PW = {};
        try { STU_PW = JSON.parse(localStorage.getItem(STU_PW_KEY)) || {}; } catch (e) { }
        let stuPwResolve; const STU_PW_READY = new Promise(r => { stuPwResolve = r; });
        const stuPwLocal = () => { try { localStorage.setItem(STU_PW_KEY, JSON.stringify(STU_PW)); } catch (e) { } };
        async function stuHash(id, pw) {
            const t = 'sbte|' + id + '|' + pw;
            if (window.crypto && crypto.subtle) {
                const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
                return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
            }
            return 'plain:' + pw;
        }
        async function stuCheckPassword(rec, pw) {
            const id = String(rec.id), custom = STU_PW[id];
            if (custom) return custom === await stuHash(id, pw) || custom === 'plain:' + pw;
            return pw.trim().toLowerCase() === String(rec.name).trim().toLowerCase();
        }
        async function stuLoadPasswords() {
            try {
                const ref = FB.ref(null, STU_PW_PATH), snap = await FB.get(ref);
                if (snap.exists()) STU_PW = snap.val() || {};
                else if (isAdminRole() && Object.keys(STU_PW).length) await FB.set(ref, STU_PW);
                else STU_PW = {};
                stuPwLocal();
            } catch (e) { console.warn('Student passwords load failed:', e); }
            finally { stuPwResolve(); }
        }
        // newPw === '' resets the student back to the default (their name)
        async function stuSetPassword(rec, newPw) {
            if (!isAdminRole()) return;
            const id = String(rec.id);
            if (newPw) STU_PW[id] = await stuHash(id, newPw); else delete STU_PW[id];
            stuPwLocal();
            if (USING_FIREBASE && FB) {
                const ref = FB.ref(FB.db, STU_PW_PATH + '/' + id);
                if (newPw) await FB.set(ref, STU_PW[id]); else await FB.remove(ref);
            }
        }
        function openStuPwManager() {
            if (!isAdminRole()) return;
            const wrap = document.createElement('div'); wrap.className = 'dlg-back';
            wrap.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" aria-label="Student passwords" tabindex="-1" style="width:min(640px,94vw);">
        <h3>Student passwords</h3>
        <div class="dlg-body">Students sign in with their <b>Student ID</b> and a password. The default password is the student's name; set a new one here at any time.
        <div class="field" style="margin-top:12px;"><input type="text" id="pwSearch" placeholder="Search by name or ID" autocomplete="off"></div>
        <div class="pw-list" id="pwList"></div></div>
        <div class="dlg-btns"><button type="button" class="btn primary" data-d="close">Done</button></div></div>`;
            document.body.appendChild(wrap);
            const list = wrap.querySelector('#pwList'), search = wrap.querySelector('#pwSearch');
            const students = () => {
                const m = new Map(); RECORDS.forEach(r => { if (!m.has(String(r.id))) m.set(String(r.id), r); });
                return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
            };
            const render = () => {
                const q = search.value.trim().toLowerCase();
                const rows = students().filter(r => !q || r.name.toLowerCase().includes(q) || String(r.id).includes(q));
                list.innerHTML = rows.length ? rows.map(r => {
                    const custom = !!STU_PW[String(r.id)];
                    return `<div class="pw-row"><div><div class="pw-name">${escH(r.name)}</div><div class="pw-sub">ID ${escH(String(r.id))} · ${escH(r.batch)}</div></div>
              <span class="pw-tag ${custom ? 'custom' : ''}">${custom ? 'Custom password' : 'Default (name)'}</span>
              <div class="pw-btns"><button type="button" class="note-btn" data-act="set" data-id="${escH(String(r.id))}">Change</button>${custom ? `<button type="button" class="note-btn" data-act="reset" data-id="${escH(String(r.id))}">Reset</button>` : ''}</div></div>`;
                }).join('') : '<div class="empty-state" style="padding:24px;">No students match.</div>';
            };
            const save = async (rec, pw, msg) => {
                try { await stuSetPassword(rec, pw); showToast(msg); }
                catch (e) { showToast('Saved on this device only — the cloud database refused the write.'); }
                render();
            };
            list.addEventListener('click', e => {
                const b = e.target.closest('button[data-act]'); if (!b) return;
                const rec = students().find(r => String(r.id) === b.dataset.id); if (!rec) return;
                if (b.dataset.act === 'reset') save(rec, '', 'Password reset to the default (name) for ' + rec.name + '.');
                else stPrompt('New password for ' + rec.name, 'New password (at least 4 characters)', '', v => {
                    v = (v || '').trim();
                    if (v.length < 4) { showToast('Password must be at least 4 characters.'); return; }
                    save(rec, v, 'Password updated for ' + rec.name + '.');
                });
            });
            search.addEventListener('input', render);
            wrap.addEventListener('click', e => { if (e.target === wrap || e.target.dataset.d === 'close') wrap.remove(); });
            wrap.addEventListener('keydown', e => { if (e.key === 'Escape') wrap.remove(); });
            render(); search.focus();
        }
        document.getElementById('stuPwBtn').addEventListener('click', openStuPwManager);

        /* ============ Authentication ============ */
        const ADMIN_CREDENTIALS = { username: 'admin', password: '123' };

        const roleTabAdmin = document.getElementById('roleTabAdmin');
        const roleTabStudent = document.getElementById('roleTabStudent');
        const adminLoginForm = document.getElementById('adminLoginForm');
        const studentLoginForm = document.getElementById('studentLoginForm');
        const adminLoginError = document.getElementById('adminLoginError');
        const studentLoginError = document.getElementById('studentLoginError');
        const roleBadge = document.getElementById('roleBadge');
        const sessionWho = document.getElementById('sessionWho');
        const logoutBtn = document.getElementById('logoutBtn');

        roleTabAdmin.addEventListener('click', () => {
            roleTabAdmin.classList.add('active'); roleTabStudent.classList.remove('active');
            adminLoginForm.style.display = ''; studentLoginForm.style.display = 'none';
            adminLoginError.classList.remove('show'); studentLoginError.classList.remove('show');
        });
        roleTabStudent.addEventListener('click', () => {
            roleTabStudent.classList.add('active'); roleTabAdmin.classList.remove('active');
            studentLoginForm.style.display = ''; adminLoginForm.style.display = 'none';
            adminLoginError.classList.remove('show'); studentLoginError.classList.remove('show');
        });

        adminLoginForm.addEventListener('submit', (e) => e.preventDefault());
        studentLoginForm.addEventListener('submit', (e) => e.preventDefault());

        function doAdminLogin() {
            const u = document.getElementById('adminUser').value.trim();
            const p = document.getElementById('adminPass').value.trim();
            if (u === ADMIN_CREDENTIALS.username && p === ADMIN_CREDENTIALS.password) {
                adminLoginError.classList.remove('show');
                logIn({ role: 'admin' });
            } else {
                adminLoginError.classList.add('show');
            }
        }

        async function doStudentLogin() {
            const id = document.getElementById('stuId').value.trim();
            const pw = document.getElementById('stuPass').value;
            // make sure passwords changed by the admin have been fetched from the cloud first
            await Promise.race([STU_PW_READY, new Promise(r => setTimeout(r, 3000))]);
            const rec = RECORDS.find(r => String(r.id) === id);
            if (rec && pw && await stuCheckPassword(rec, pw)) {
                studentLoginError.classList.remove('show');
                logIn({ role: 'student', name: rec.name, id: rec.id });
            } else {
                studentLoginError.classList.add('show');
            }
        }

        document.getElementById('adminLoginBtn').addEventListener('click', doAdminLogin);
        document.getElementById('studentLoginBtn').addEventListener('click', doStudentLogin);

        ['adminUser', 'adminPass'].forEach(id => {
            document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doAdminLogin(); } });
        });
        ['stuId', 'stuPass'].forEach(id => {
            document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doStudentLogin(); } });
        });

        function logIn(user, isRestoring = false) {
            document.body.classList.add('authed');
            document.body.classList.remove('role-admin', 'role-student');
            document.body.classList.add(user.role === 'admin' ? 'role-admin' : 'role-student');
            document.documentElement.classList.add('is-authed');
            document.documentElement.classList.toggle('is-role-admin', user.role === 'admin');
            document.documentElement.classList.toggle('is-role-student', user.role === 'student');

            saveSession(user);

            if (user.role === 'admin') {
                roleBadge.textContent = 'ADMIN';
                sessionWho.textContent = 'Signed in as administrator';

                // Restore active view (defaults to dashboard)
                let savedView = null;
                try { savedView = localStorage.getItem(ACTIVE_VIEW_KEY); } catch (e) { }
                if (savedView && document.getElementById('view-' + savedView)) {
                    switchView(savedView);
                } else {
                    switchView('dashboard');
                }

                // Restore active report card selection if exists
                try {
                    const savedRep = JSON.parse(localStorage.getItem(ACTIVE_REPORT_KEY));
                    if (savedRep && savedRep.student && [...repStudent.options].some(o => o.value === savedRep.student)) {
                        repStudent.value = savedRep.student;
                        refreshReportMonths();
                        if (savedRep.month && [...repMonth.options].some(o => o.value === savedRep.month)) {
                            repMonth.value = savedRep.month;
                        }
                        renderReport(currentReportRecord());
                    }
                } catch (e) { }

                // Restore active batch report selection if exists
                try {
                    const savedBatch = JSON.parse(localStorage.getItem(ACTIVE_BATCH_KEY));
                    if (savedBatch && savedBatch.batch && [...batchSelect.options].some(o => o.value === savedBatch.batch)) {
                        batchSelect.value = savedBatch.batch;
                        refreshBatchMonths();
                        if (savedBatch.month && [...batchMonth.options].some(o => o.value === savedBatch.month)) {
                            batchMonth.value = savedBatch.month;
                        }
                        renderBatch();
                    }
                } catch (e) { }
            } else {
                roleBadge.textContent = 'STUDENT';
                sessionWho.textContent = `Signed in as ${user.name}`;
                // Lock the report card to this student only
                repStudent.innerHTML = '';
                const o = document.createElement('option'); o.value = user.name; o.textContent = user.name;
                repStudent.appendChild(o);
                repStudent.value = user.name;
                repStudent.disabled = true;
                refreshReportMonths();
                reportEditMode = false;
                toggleEditButtons();
                renderReport(currentReportRecord());

                // For student, restore notes or report view
                let savedView = null;
                try { savedView = localStorage.getItem(ACTIVE_VIEW_KEY); } catch (e) { }
                const targetView = (savedView === 'notes' || savedView === 'seating' || savedView === 'attendance') ? savedView : 'report';
                switchView(targetView);
            }
            if (typeof renderNotes === 'function') renderNotes();
            if (typeof renderSims === 'function') renderSims();
            if (typeof renderSeating === 'function') renderSeating();
            if (typeof renderAttendance === 'function') renderAttendance();
        }

        logoutBtn.addEventListener('click', () => {
            clearSession();
            document.documentElement.classList.remove('is-authed', 'is-role-admin', 'is-role-student');
            document.body.classList.remove('authed', 'role-admin', 'role-student');
            window.location.reload();
        });

        /* ============ Atom logo: electron burst across the page ============ */
        const mainAtomLogo = document.getElementById('mainAtomLogo');
        const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let atomBursting = false;

        // Point on a quadratic curve at time t (0..1)
        function bezierPoint(t, p0, p1, p2) { const u = 1 - t; return u * u * p0 + 2 * u * t * p1 + t * t * p2; }
        // Direction of travel along that curve at time t, in degrees
        function bezierAngle(t, x0, cx, x1, y0, cy, y1) {
            const dx = 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx);
            const dy = 2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy);
            return Math.atan2(dy, dx) * 180 / Math.PI;
        }

        // Moves `el` continuously along a curved (bezier) path from (x0,y0) to (x1,y1),
        // bowing through control point (cx,cy), updating every animation frame — a
        // continuous path rather than a straight CSS-transition jump.
        function animateElectronPath(el, x0, y0, cx, cy, x1, y1, duration, opacityAt, onDone) {
            const start = performance.now();
            function frame(now) {
                const t = Math.min(1, (now - start) / duration);
                const px = bezierPoint(t, x0, cx, x1);
                const py = bezierPoint(t, y0, cy, y1);
                const angle = bezierAngle(t, x0, cx, x1, y0, cy, y1);
                const stretch = 1 + Math.sin(t * Math.PI) * 1.5;
                el.style.transform = `translate(${px}px, ${py}px) rotate(${angle}deg) scaleX(${stretch})`;
                el.style.opacity = String(opacityAt(t));
                if (t < 1) { requestAnimationFrame(frame); } else { onDone && onDone(px, py); }
            }
            requestAnimationFrame(frame);
        }

        function burstAtomElectrons() {
            if (!mainAtomLogo || atomBursting) return;
            atomBursting = true;

            mainAtomLogo.classList.add('atom-pulse');
            setTimeout(() => mainAtomLogo.classList.remove('atom-pulse'), 850);

            const rect = mainAtomLogo.getBoundingClientRect();
            const originX = rect.left + rect.width / 2;
            const originY = rect.top + rect.height / 2;
            const COUNT = prefersReducedMotion ? 0 : 48;
            if (COUNT === 0) { atomBursting = false; return; }
            let remaining = COUNT;

            for (let i = 0; i < COUNT; i++) {
                const delay = i * 9 + Math.random() * 16;
                setTimeout(() => {
                    const el = document.createElement('div');
                    el.className = 'flying-electron';
                    document.body.appendChild(el);

                    // spread anywhere across the full page
                    const targetX = Math.random() * window.innerWidth;
                    const targetY = Math.random() * window.innerHeight;

                    // bow the path sideways from a straight line so it arcs like an orbit, not a straight dart
                    const bendCurve = (x0, y0, x1, y1) => {
                        const dx = x1 - x0, dy = y1 - y0;
                        const len = Math.hypot(dx, dy) || 1;
                        const nx = -dy / len, ny = dx / len;
                        const bend = (Math.random() < 0.5 ? -1 : 1) * len * (0.18 + Math.random() * 0.28);
                        return { cx: (x0 + x1) / 2 + nx * bend, cy: (y0 + y1) / 2 + ny * bend };
                    };

                    const out = bendCurve(originX, originY, targetX, targetY);
                    const outDur = 360 + Math.random() * 200;

                    animateElectronPath(
                        el, originX, originY, out.cx, out.cy, targetX, targetY, outDur,
                        t => t < 0.15 ? t / 0.15 : (t > 0.88 ? 1 - (t - 0.88) / 0.12 : 1),
                        (px, py) => {
                            // brief hold out in the page, then curve back along a fresh arc into the atom
                            setTimeout(() => {
                                const back = bendCurve(px, py, originX, originY);
                                const backDur = 330 + Math.random() * 180;
                                animateElectronPath(
                                    el, px, py, back.cx, back.cy, originX, originY, backDur,
                                    t => t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45,
                                    () => {
                                        el.remove();
                                        remaining--;
                                        if (remaining <= 0) atomBursting = false;
                                    }
                                );
                            }, 70 + Math.random() * 90);
                        }
                    );
                }, delay);
            }
        }

        mainAtomLogo && mainAtomLogo.addEventListener('click', burstAtomElectrons);


        /* ============ SETTINGS WINDOW + MOUSE LAYOUT EDITOR ============ */
        const gearBtn = document.getElementById('gearBtn'), pop = document.getElementById('settingsPop');
        const LBL = { kpi: 'Summary boxes', charts: 'Charts area', filters: 'Filters', table: 'Register table', dist: 'Score distribution', batch: 'Average by batch', month: 'Average by month' };
        let layoutTimer = null, editing = false, rafId = 0, op = null;
        const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

        function setLayoutStatus(t) { const el = document.getElementById('setStatus'); if (el) el.textContent = t; }
        function saveLayout() {
            try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(LAYOUT)); } catch (e) { }
            if (FB && FB.set) {
                FB.set(FB.ref(FB.db, 'settings/layout'), LAYOUT)
                    .then(() => setLayoutStatus('Saved and synced for all users'), () => setLayoutStatus('Saved on this device only (cloud sync failed)'));
            } else setLayoutStatus('Saved on this device (offline)');
        }
        function scheduleSave() { clearTimeout(layoutTimer); layoutTimer = setTimeout(saveLayout, 300); }
        function commitLayout(dash, ui) { applyLayout(); scheduleSave(); if (dash) renderDashboard(); if (ui !== false) renderSettings(); }

        function renderSettings() {
            const L = LAYOUT, r = L.rep, body = document.getElementById('settingsBody');
            const mw = [[1000, 'Compact'], [1280, 'Standard'], [1600, 'Wide'], [0, 'Full width']];
            if (editing) {
                body.innerHTML = `<div class="pop-sec"><div class="pop-title">Editing layout</div>
          <p class="set-hint"><b>â ¿ tag</b> = move · <b>corner</b> = resize width &amp; height · <b>double-click corner</b> = reset. On report pages drag the divider. Drag this window by its title bar to move it.</p>
          <button type="button" class="btn primary" data-act="edit" style="width:100%;margin-top:8px;justify-content:center">âœ” Done editing layout</button>
          <span id="setStatus" class="set-hint" role="status"></span></div>`;
                return;
            }
            body.innerHTML = `
      <div class="pop-sec"><div class="pop-title">Text size</div>
        <div class="set-row"><button type="button" class="btn" data-act="fs-" aria-label="Smaller text">Aâˆ’</button>
          <input type="range" min="80" max="170" step="5" value="${L.fs}" data-act="fs" aria-label="Text size">
          <button type="button" class="btn" data-act="fs+" aria-label="Larger text">A+</button><output>${L.fs}%</output></div></div>
      <div class="pop-sec"><div class="pop-title">Page</div>
        <div class="set-row"><label>Width <select data-act="maxw">${mw.map(([v, t]) => `<option value="${v}" ${L.maxw === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label>Box spacing <span class="sl"><input type="range" min="6" max="40" step="2" value="${L.gap}" data-act="gap"><output>${L.gap}px</output></span></label></div></div>
      <div class="pop-sec"><div class="pop-title">Layout</div>
        <button type="button" class="btn ${editing ? 'primary' : ''}" data-act="edit" style="width:100%;margin-top:10px;justify-content:center">${editing ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Done editing layout' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2s6.54-2 10 5.88L22 18.2v-2c0-2.21-3.58-4-8-4-4.42 0-8 1.79-8 4v2c0-2.21-3.58-4-8-4-4.42 0-8 1.79-8 4v2c0-2.21-3.58-4-8-4-4.42 0-8 1.79-8 4v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-1.8c3.46-7.88 10-5.88 10-5.88"></path></svg> Edit layout with mouse'}</button>
        <p class="set-hint">Drag a box by its <b><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg> tag</b> to move it. Drag its <b>bottom-right corner</b> to resize in <b>both directions</b> (width and height). Graphs are redrawn to the exact shape you drag. Double-click a corner to reset. On Report and Batch pages drag the <b>divider</b> between the columns, or press <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 12 16 12"></polyline><path d="M16 12H8M12 8l-4 4 4 4"></path></svg> to swap sides. Resizing needs a screen wider than 900&nbsp;px.</p></div>
      <details class="pop-sec"><summary>Report &amp; Batch pages</summary>
        <div class="set-row"><label>Graph panel <select data-act="side">${[['right', 'Right'], ['left', 'Left'], ['below', 'Below']].map(([v, t]) => `<option value="${v}" ${r.side === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label>Graph size <span class="sl"><input type="range" min="50" max="100" step="5" value="${r.g}" data-act="g"><output>${r.g}%</output></span></label></div></details>
      <div class="set-foot"><button type="button" class="btn ghost" data-act="reset">Reset all</button><span id="setStatus" class="set-hint" style="margin:0" role="status"></span></div>`;
        }

        function placePop() {
            if (editing) { pop.style.right = 'auto'; pop.style.top = 'auto'; pop.style.bottom = '14px'; pop.style.left = '14px'; }
            else if (innerWidth > 640) { const r = gearBtn.getBoundingClientRect(); pop.style.right = 'auto'; pop.style.bottom = 'auto'; pop.style.top = (r.bottom + 8) + 'px'; pop.style.left = Math.max(10, Math.min(r.left - 20, innerWidth - pop.offsetWidth - 10)) + 'px'; }
        }
        function openPop() { pop.hidden = false; gearBtn.setAttribute('aria-expanded', 'true'); renderSettings(); placePop(); }
        function closePop() { setEditing(false); pop.hidden = true; gearBtn.setAttribute('aria-expanded', 'false'); }
        gearBtn.addEventListener('click', () => (pop.hidden ? openPop() : closePop()));
        document.getElementById('popClose').addEventListener('click', closePop);
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) closePop(); });
        pop.querySelector('.pop-head').addEventListener('pointerdown', e => {
            if (e.target.closest('button')) return;
            const r = pop.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
            const mv = ev => { pop.style.right = 'auto'; pop.style.bottom = 'auto'; pop.style.left = clamp(ev.clientX - dx, 0, innerWidth - r.width) + 'px'; pop.style.top = clamp(ev.clientY - dy, 0, innerHeight - 40) + 'px'; };
            const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
            addEventListener('pointermove', mv); addEventListener('pointerup', up);
        });

        pop.addEventListener('click', e => {
            const b = e.target.closest('button[data-act]'); if (!b) return; const a = b.dataset.act;
            if (a === 'fs-' || a === 'fs+') { LAYOUT.fs = clamp(LAYOUT.fs + (a === 'fs+' ? 5 : -5), 80, 170); commitLayout(false); }
            else if (a === 'edit') setEditing(!editing);
            else if (a === 'reset') openDialog({ title: 'Reset layout', body: '<p>Reset all layout and text-size settings to their defaults?</p>', confirmLabel: 'Reset', onConfirm: async () => { LAYOUT = mergeLayout(null); commitLayout(true); } });
        });
        pop.addEventListener('input', e => {
            const t = e.target, a = t.dataset.act, v = Number(t.value); if (t.type !== 'range') return;
            if (a === 'fs') LAYOUT.fs = v; else if (a === 'gap') LAYOUT.gap = v; else if (a === 'g') LAYOUT.rep.g = v; else return;
            const o = t.parentElement.querySelector('output'); if (o) o.textContent = v + (a === 'gap' ? 'px' : '%');
            commitLayout(false, false);
        });
        pop.addEventListener('change', e => {
            const t = e.target, a = t.dataset.act;
            if (a === 'maxw') { LAYOUT.maxw = Number(t.value); commitLayout(false); }
            else if (a === 'side') { LAYOUT.rep.side = t.value; commitLayout(false); }
        });

        /* ---- mouse layout editor: overlay handles that follow the real boxes ---- */
        const ov = document.createElement('div'); ov.id = 'layoutOverlay';
        const ind = document.createElement('div'); ind.className = 'lay-ind';
        const dv = document.createElement('div'); dv.className = 'lay-divider'; dv.innerHTML = '<button type="button" class="lay-swap" title="Swap sides">â‡„</button>';
        ov.append(ind, dv); document.body.appendChild(ov);

        const dashBox = () => document.getElementById('view-dashboard');
        const repLayout = () => document.querySelector('#view-report.active .report-layout, #view-batch.active .batch-layout');
        const rerenderRep = () => { if (document.getElementById('view-report').classList.contains('active')) renderReport(currentReportRecord()); else renderBatch(); };
        const blocks = () => {
            const out = [], L = repLayout();
            if (dashBox().classList.contains('active')) out.push(
                ...LAYOUT.dash.order.map(k => ({ g: 'dash', k, el: document.querySelector(LAYOUT_SEL[k]) })),
                ...LAYOUT.charts.order.map(k => ({ g: 'charts', k, el: document.querySelector('#dashOverview .cc-' + k) })));
            if (L && L.children.length === 2) L.children[1].querySelectorAll('.chart-block').forEach((el, i) => out.push({ g: 'rep', k: String(i), el }));
            return out.filter(b => b.el && b.el.getClientRects().length);
        };

        function frameFor(b) {
            const id = b.g + ':' + b.k; let f = ov.querySelector(`.lay-frame[data-id="${id}"]`);
            if (!f) {
                f = document.createElement('div'); f.className = 'lay-frame lay-' + b.g; f.dataset.id = id; f.dataset.g = b.g; f.dataset.k = b.k;
                f.innerHTML = (b.g === 'rep' ? '' : `<span class="lay-tag" title="Drag to move">â ¿ ${LBL[b.k]}</span>`) + '<span class="lay-corner" title="Drag to resize (both directions) · double-click to reset"></span><span class="lay-info"></span>';
                ov.appendChild(f);
            }
            return f;
        }
        function syncOverlay() {
            if (!editing) return;
            const seen = new Set();
            blocks().forEach(b => {
                const f = frameFor(b), r = b.el.getBoundingClientRect(), pad = b.g === 'dash' ? 4 : b.g === 'rep' ? -2 : -10;
                seen.add(f); f.style.display = 'block';
                f.style.left = (r.left + scrollX - pad) + 'px'; f.style.top = (r.top + scrollY - pad) + 'px';
                f.style.width = (r.width + 2 * pad) + 'px'; f.style.height = (r.height + 2 * pad) + 'px';
            });
            ov.querySelectorAll('.lay-frame').forEach(f => { if (!seen.has(f)) f.style.display = 'none'; });
            const L = repLayout();
            if (L && innerWidth > 1000 && LAYOUT.rep.side !== 'below' && L.children.length === 2) {
                const a = L.children[0].getBoundingClientRect(), c = L.children[1].getBoundingClientRect(), lr = L.getBoundingClientRect();
                const left = a.left < c.left ? a : c, right = a.left < c.left ? c : a;
                dv.style.display = 'block'; dv.style.left = ((left.right + right.left) / 2 + scrollX - 7) + 'px'; dv.style.top = (lr.top + scrollY) + 'px'; dv.style.height = lr.height + 'px';
            } else dv.style.display = 'none';
            rafId = requestAnimationFrame(syncOverlay);
        }
        function setEditing(on) {
            editing = on; document.body.classList.toggle('layout-editing', on); ov.style.display = on ? 'block' : 'none';
            cancelAnimationFrame(rafId);
            if (on) {
                const t = document.querySelector('nav.tabs [data-view="dashboard"]');
                if (t && !dashBox().classList.contains('active') && !repLayout()) t.click();
                syncOverlay();
            }
            if (!pop.hidden) { renderSettings(); placePop(); }
        }

        ov.addEventListener('pointerdown', e => {
            if (e.target.closest('.lay-swap')) { LAYOUT.rep.side = LAYOUT.rep.side === 'left' ? 'right' : 'left'; commitLayout(false); return; }
            const f = e.target.closest('.lay-frame');
            if (e.target.closest('.lay-divider')) { const L = repLayout(); if (!L) return; op = { t: 'div', L }; }
            else if (f && e.target.classList.contains('lay-tag')) { op = { t: 'move', g: f.dataset.g, k: f.dataset.k, f }; f.classList.add('lay-dragging'); }
            else if (f && e.target.classList.contains('lay-corner')) {
                const b = blocks().find(x => x.g === f.dataset.g && x.k === f.dataset.k); if (!b) return;
                const r = b.el.getBoundingClientRect();
                if (b.g === 'rep') { const sv = b.el.querySelector('svg'); op = { t: 'size', g: 'rep', k: b.k, f, x0: e.clientX, y0: e.clientY, w0: sv ? sv.getBoundingClientRect().width : r.width, pw: b.el.clientWidth, h0: LAYOUT.rep.gh }; }
                else {
                    const slot = b.g === 'charts' ? b.el.querySelector('.cslot') : null;
                    op = { t: 'size', g: b.g, k: b.k, f, x0: e.clientX, y0: e.clientY, w0: r.width, pw: (b.g === 'dash' ? dashBox() : b.el.parentElement).clientWidth, hpx: r.height, sh: slot ? slot.getBoundingClientRect().height : 0 };
                    if (b.g === 'dash' && b.k === 'charts') op.starts = [...document.querySelectorAll('#dashOverview .cslot')].map(sl => [sl.dataset.c, sl.getBoundingClientRect().height]);
                }
                f.classList.add('lay-active');
            } else return;
            e.preventDefault(); try { e.target.setPointerCapture(e.pointerId); } catch (x) { }
            document.body.classList.add('lay-busy');
        });
        ov.addEventListener('pointermove', e => {
            if (!op) return;
            if (op.t === 'size') {
                const dx = e.clientX - op.x0, dy = e.clientY - op.y0, gap = LAYOUT.gap; let ch = false, rd = false, txt = '';
                if (op.g === 'rep') {
                    const g = clamp(Math.round((op.w0 + dx) / op.pw * 20) * 5, 50, 100), gh = clamp(Math.round((op.h0 + dy / 1.8) / 5) * 5, 50, 250);
                    if (g !== LAYOUT.rep.g) { LAYOUT.rep.g = g; ch = true; }
                    if (gh !== LAYOUT.rep.gh) { LAYOUT.rep.gh = gh; rd = true; }
                    txt = g + '% wide · ' + gh + '% tall';
                } else {
                    const W = clamp(Math.round((op.w0 + dx + gap) / (op.pw + gap) * 20) * 5, 20, 100);
                    if (LAYOUT[op.g].w[op.k] !== W) { LAYOUT[op.g].w[op.k] = W; ch = true; }
                    txt = W + '% wide';
                    if (op.g === 'charts') {
                        const H = clamp(Math.round((op.sh + dy) / 10) * 10, 100, 900);
                        if (LAYOUT.charts.hp[op.k] !== H) { LAYOUT.charts.hp[op.k] = H; ch = true; }
                        txt += ' · graph ' + H + 'px tall';
                    } else if (op.k === 'charts') {
                        (op.starts || []).forEach(([c, h0]) => { const H = clamp(Math.round((h0 + dy) / 10) * 10, 100, 900); if (LAYOUT.charts.hp[c] !== H) { LAYOUT.charts.hp[c] = H; ch = true; } });
                        txt += ' · graphs resized';
                    } else {
                        const H = clamp(Math.round((op.hpx + dy) / 10) * 10, 60, 2000);
                        if (LAYOUT.dash.h[op.k] !== H) { LAYOUT.dash.h[op.k] = H; ch = true; }
                        txt += ' · ' + H + 'px tall';
                    }
                }
                op.f.querySelector('.lay-info').textContent = txt;
                if (ch || rd) { applyLayout(); if (rd) rerenderRep(); scheduleSave(); }
            } else if (op.t === 'move') {
                op.tk = null;
                const t = blocks().find(b => b.g === op.g && b.k !== op.k && (r => e.clientX >= r.left - 8 && e.clientX <= r.right + 8 && e.clientY >= r.top - 8 && e.clientY <= r.bottom + 8)(b.el.getBoundingClientRect()));
                if (t) {
                    const r = t.el.getBoundingClientRect(), pr = (t.g === 'dash' ? dashBox() : t.el.parentElement).getBoundingClientRect();
                    op.tk = t.k; op.before = ((e.clientX - r.left) / r.width + (e.clientY - r.top) / r.height) < 1;
                    ind.style.display = 'block';
                    if (r.width < pr.width * 0.95) { ind.style.width = '4px'; ind.style.height = r.height + 'px'; ind.style.top = (r.top + scrollY) + 'px'; ind.style.left = ((op.before ? r.left - 6 : r.right + 2) + scrollX) + 'px'; }
                    else { ind.style.height = '4px'; ind.style.width = r.width + 'px'; ind.style.left = (r.left + scrollX) + 'px'; ind.style.top = ((op.before ? r.top - 6 : r.bottom + 2) + scrollY) + 'px'; }
                } else ind.style.display = 'none';
            } else if (op.t === 'div') {
                const r = op.L.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width;
                const m = clamp(Math.round((LAYOUT.rep.side === 'left' ? 1 - fx : fx) * 50) * 2, 40, 80);
                if (m !== LAYOUT.rep.main) { LAYOUT.rep.main = m; applyLayout(); scheduleSave(); }
            }
        });
        function endOp() {
            if (!op) return;
            if (op.t === 'move') {
                ind.style.display = 'none'; op.f.classList.remove('lay-dragging');
                if (op.tk) { const o = LAYOUT[op.g].order; o.splice(o.indexOf(op.k), 1); const i = o.indexOf(op.tk); o.splice(op.before ? i : i + 1, 0, op.k); applyLayout(); scheduleSave(); }
            }
            if (op.f) op.f.classList.remove('lay-active');
            op = null; document.body.classList.remove('lay-busy'); if (!pop.hidden) renderSettings();
        }
        ov.addEventListener('pointerup', endOp); ov.addEventListener('pointercancel', endOp);
        ov.addEventListener('dblclick', e => {
            const c = e.target.closest('.lay-corner'); if (!c) return;
            const g = c.parentElement.dataset.g, k = c.parentElement.dataset.k;
            if (g === 'rep') { LAYOUT.rep.g = 100; LAYOUT.rep.gh = 100; commitLayout(false); rerenderRep(); return; }
            if (g === 'charts') { LAYOUT.charts.w[k] = 'auto'; LAYOUT.charts.hp[k] = 0; }
            else { LAYOUT.dash.w[k] = 100; LAYOUT.dash.h[k] = 0; if (k === 'charts') Object.keys(LAYOUT.charts.hp).forEach(c2 => { LAYOUT.charts.hp[c2] = 0; }); }
            commitLayout(true);
        });

        /* ============ SEATING ARRANGEMENT (integrated planner) ============ */
        const ST_KEY = 'sbte_seating_v1';
        const ST_CLOUD_PATH = 'settings/seating';
        const ST_DEFAULT_W = 440, ST_MIN_W = 200, ST_MAX_W = 475, ST_DEFAULT_DOOR = 0.55;
        let stScale = 1;

        function stTables(prefix) { return [1, 2, 3, 4].map(n => ({ id: prefix + n, seats: [] })); }
        function stDefaultLabs() {
            return [{
                id: 'lab-201', name: 'Lab 201', colW: { left: ST_DEFAULT_W, right: ST_DEFAULT_W }, doorPos: ST_DEFAULT_DOOR,
                left: [
                    { id: 'L1', seats: ['Omer', 'Ahmed', 'Abdul Hanan', 'Shaheer'] },
                    { id: 'L2', seats: ['Himesh', 'Abdul Wasay', 'Abraham', 'Hasin'] },
                    { id: 'L3', seats: ['Sarib', 'Abdul Kabeer', 'Anas', 'Ibrahim', 'Ali'] },
                    { id: 'L4', seats: ['Ekrash', 'Mukaram', 'Rehan', 'Zohaib', 'Hammad'] }
                ],
                right: [
                    { id: 'R1', seats: ['Harmain', 'Zunaira', 'Alishba'] },
                    { id: 'R2', seats: ['Yusra', 'Riya', 'Muntaha'] },
                    { id: 'R3', seats: ['Khizar', 'Ali Jawad', 'Taha'] },
                    { id: 'R4', seats: ['Talha', 'Danish', 'Mukaram'] }
                ]
            }];
        }
        // Accepts anything (local cache, cloud, older shapes) and returns a clean labs array, or null if unusable.
        function stNormalize(raw) {
            if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (e) { return null; } }
            if (raw && !Array.isArray(raw) && Array.isArray(raw.labs)) raw = raw.labs;
            if (!Array.isArray(raw) || !raw.length) return null;
            const out = [];
            for (const l of raw) {
                if (!l || typeof l.name !== 'string') continue;
                const side = arr => (Array.isArray(arr) ? arr : []).map((t, i) => ({
                    id: (t && t.id) || ('T' + (i + 1)),
                    seats: (t && Array.isArray(t.seats) ? t.seats : []).map(s => String(s))
                }));
                // each side has its own table length (older saves stored a single shared number)
                const cw = v => { v = Number(v); return Math.max(ST_MIN_W, Math.min(ST_MAX_W, isFinite(v) && v > 0 ? v : ST_DEFAULT_W)); };
                const raw = l.colW && typeof l.colW === 'object' ? l.colW : { left: l.colW, right: l.colW };
                const left = side(l.left), right = side(l.right);
                out.push({
                    id: l.id || ('lab-' + Date.now() + '-' + out.length), name: l.name,
                    colW: { left: cw(raw.left), right: cw(raw.right) },
                    doorPos: typeof l.doorPos === 'number' ? l.doorPos : ST_DEFAULT_DOOR,
                    left: left.length ? left : stTables('L'), right: right.length ? right : stTables('R')
                });
            }
            return out.length ? out : null;
        }

        let ST_LABS = stDefaultLabs();
        let ST_ACTIVE = 0;
        const stCur = () => ST_LABS[ST_ACTIVE];
        (function stLoadLocal() {
            try {
                const raw = JSON.parse(localStorage.getItem(ST_KEY));
                const labs = stNormalize(raw);
                if (labs) { ST_LABS = labs; ST_ACTIVE = Math.min(Math.max((raw.active | 0), 0), labs.length - 1); }
            } catch (e) { }
        })();

        let stSaveTimer = null, stWarned = false;
        function stSetStatus(t) { const e = document.getElementById('stSaveStatus'); if (e) e.textContent = t; }
        const stClock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        // stSave() = autosave shortly after each change; stSave(true) = the Save button (immediately, with confirmation).
        function stSave(now) {
            if (!isAdminRole()) return;           // only admins ever write
            try { localStorage.setItem(ST_KEY, JSON.stringify({ labs: ST_LABS, active: ST_ACTIVE })); } catch (e) { }
            if (!USING_FIREBASE || !FB) {
                stSetStatus('Saved on this device · ' + stClock());
                if (now === true) showToast('Seating saved on this device.');
                return;
            }
            stSetStatus('Saving…');
            clearTimeout(stSaveTimer);
            const run = () =>
                // stored as one JSON string: Realtime Database silently drops empty arrays (empty tables)
                FB.set(FB.ref(FB.db, ST_CLOUD_PATH), JSON.stringify(ST_LABS))
                    .then(() => { setCloudStatus('connected'); stSetStatus('All changes saved · ' + stClock()); if (now === true) showToast('Seating saved.'); })
                    .catch(err => {
                        console.warn('Seating cloud save failed:', err);
                        stSetStatus('Saved on this device only');
                        if (now === true || !stWarned) { stWarned = true; showToast('Seating saved on this device only — the cloud database refused the write.'); }
                    });
            if (now === true) run(); else stSaveTimer = setTimeout(run, 500);
        }
        // Called from the Firebase boot sequence once the cloud is reachable.
        async function stLoadCloud() {
            const snap = await FB.get(FB.ref(null, ST_CLOUD_PATH));
            if (snap.exists()) {
                const labs = stNormalize(snap.val());
                if (labs) { ST_LABS = labs; ST_ACTIVE = Math.min(ST_ACTIVE, labs.length - 1); }
            } else if (isAdminRole()) {
                await FB.set(FB.ref(null, ST_CLOUD_PATH), JSON.stringify(ST_LABS));
            }
            renderSeating();
        }

        /* ---- small dialogs (same look as the rest of the portal) ---- */
        function stPrompt(title, label, value, onOk) {
            const wrap = document.createElement('div'); wrap.className = 'dlg-back';
            wrap.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" aria-label="${escH(title)}" tabindex="-1">
        <h3>${escH(title)}</h3>
        <div class="dlg-body"><label class="dlg-type">${escH(label)}<input type="text" autocomplete="off"></label></div>
        <div class="dlg-btns"><button type="button" class="btn ghost" data-d="cancel">Cancel</button><button type="button" class="btn primary" data-d="ok">OK</button></div></div>`;
            document.body.appendChild(wrap);
            const inp = wrap.querySelector('input'), close = () => wrap.remove();
            inp.value = value || ''; inp.focus(); inp.select();
            const ok = () => { const v = inp.value; close(); onOk(v); };
            wrap.addEventListener('click', e => { if (e.target === wrap || e.target.dataset.d === 'cancel') close(); if (e.target.dataset.d === 'ok') ok(); });
            wrap.addEventListener('keydown', e => { if (e.key === 'Escape') close(); if (e.key === 'Enter') { e.preventDefault(); ok(); } });
        }
        function stConfirm(title, message, confirmLabel, onYes) {
            openDialog({ title, body: `<p>${escH(message)}</p>`, confirmLabel, danger: true, onConfirm: async () => { onYes(); } });
        }

        /* ---- lab tabs ---- */
        function stRenderTabs() {
            const bar = document.getElementById('stTabs'); bar.innerHTML = '';
            ST_LABS.forEach((lab, i) => {
                const tab = document.createElement('div');
                tab.className = 'st-tab' + (i === ST_ACTIVE ? ' active' : '');
                tab.title = isAdminRole() ? 'Click to open â€¢ Double-click to rename' : 'Click to open';
                const label = document.createElement('span'); label.textContent = lab.name; tab.appendChild(label);
                if (ST_LABS.length > 1) {
                    const x = document.createElement('button');
                    x.type = 'button'; x.className = 'st-tab-close st-admin'; x.title = 'Delete this lab'; x.textContent = 'Ã—';
                    x.addEventListener('click', e => { e.stopPropagation(); stDeleteLab(i); });
                    tab.appendChild(x);
                }
                tab.addEventListener('click', () => stSwitchLab(i));
                tab.addEventListener('dblclick', () => { if (isAdminRole()) stRenameLab(i); });
                bar.appendChild(tab);
            });
            const add = document.createElement('button');
            add.type = 'button'; add.className = 'btn st-tab-add st-admin'; add.textContent = '+ New lab (copy)'; add.title = 'Create a new lab as a copy of the lab that is open';
            add.addEventListener('click', stAddLab);
            bar.appendChild(add);
        }
        function stSwitchLab(i) { ST_ACTIVE = i; stSave(); renderSeating(); }
        // A new lab starts as an exact copy of the lab that is open (tables, names, table lengths, door position).
        function stAddLab() {
            if (!isAdminRole()) return;
            const src = stCur();
            stPrompt('New lab (copy of "' + src.name + '")', 'Name for the new lab', 'Copy of ' + src.name, v => {
                const copy = JSON.parse(JSON.stringify(src));
                copy.id = 'lab-' + Date.now();
                copy.name = (v || '').trim() || ('Copy of ' + src.name);
                ST_LABS.push(copy);
                stSwitchLab(ST_LABS.length - 1);
            });
        }
        function stDeleteLab(i) {
            if (!isAdminRole()) return;
            if (ST_LABS.length <= 1) { showToast('At least one lab must remain.'); return; }
            stConfirm('Delete lab', `Delete "${ST_LABS[i].name}" and all of its seating?`, 'Delete lab', () => {
                ST_LABS.splice(i, 1);
                if (ST_ACTIVE >= ST_LABS.length) ST_ACTIVE = ST_LABS.length - 1; else if (i < ST_ACTIVE) ST_ACTIVE--;
                stSave(); renderSeating();
            });
        }
        function stRenameLab(i) {
            if (!isAdminRole()) return;
            stPrompt('Rename lab', 'Lab name', ST_LABS[i].name, v => {
                const name = (v || '').trim(); if (!name) return;
                ST_LABS[i].name = name; stSave(); renderSeating();
            });
        }

        /* ---- selector, labels, "my seat" note ---- */
        function stRenderSelector() {
            const sel = document.getElementById('stTableSel'), prev = sel.value, lab = stCur();
            sel.innerHTML = '';
            ['left', 'right'].forEach(side => {
                const n = lab[side].length;
                lab[side].forEach((t, i) => {
                    const o = document.createElement('option'); o.value = side + '-' + i;
                    o.textContent = (side === 'left' ? 'Left' : 'Right') + ' Table ' + (i + 1) + (i === 0 ? ' (Top)' : (i === n - 1 ? ' (Bottom)' : ''));
                    sel.appendChild(o);
                });
            });
            if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
        }
        function stMyName() {
            if (isAdminRole()) return '';
            const s = getSavedSession();
            return s && s.role === 'student' && s.name ? String(s.name).trim().toLowerCase() : '';
        }
        function stRenderMeNote() {
            const el = document.getElementById('stMeNote'), me = stMyName();
            el.textContent = '';
            if (!me) return;
            const has = lab => lab.left.concat(lab.right).some(t => t.seats.some(s => s.trim().toLowerCase() === me));
            if (has(stCur())) { el.innerHTML = '<strong>Your seat</strong> is highlighted in blue.'; return; }
            const other = ST_LABS.find(has);
            if (other) el.innerHTML = 'Your seat is in <strong>' + escH(other.name) + '</strong> — open that tab below.';
        }

        function renderSeating() {
            if (!document.getElementById('stRoom')) return;
            if (ST_ACTIVE >= ST_LABS.length) ST_ACTIVE = 0;
            const lab = stCur();
            stRenderTabs(); stRenderSelector();
            document.getElementById('stLabTitle').textContent = lab.name + ' (15 ft)';
            stRenderLayout(); stApplyDoor(); stRenderMeNote(); stFit();
        }

        /* ---- layout ---- */
        function stRenderLayout() {
            const lab = stCur(), L = document.getElementById('stLeftCol'), R = document.getElementById('stRightCol');
            L.innerHTML = ''; R.innerHTML = '';
            lab.left.forEach((t, i) => L.appendChild(stDesk('left', i, t)));
            lab.right.forEach((t, i) => R.appendChild(stDesk('right', i, t)));
        }
        function stDesk(side, ti, table) {
            const admin = isAdminRole(), me = stMyName();
            const desk = document.createElement('div');
            desk.className = 'st-desk side-' + side; desk.style.width = stCur().colW[side] + 'px';
            if (!table.seats.length) {
                const h = document.createElement('div'); h.className = 'st-empty';
                h.textContent = admin ? 'Empty table — use "Add seat"' : 'Empty table';
                desk.appendChild(h);
            }
            table.seats.forEach((name, si) => {
                const seat = document.createElement('div');
                seat.className = 'st-seat' + (me && name.trim().toLowerCase() === me ? ' st-me' : '');
                if (admin) {
                    const b = document.createElement('button');
                    b.type = 'button'; b.className = 'st-remove'; b.title = 'Remove seat'; b.textContent = 'Ã—';
                    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); stRemoveSeat(side, ti, si); });
                    seat.appendChild(b);
                }
                const chair = document.createElement('div'); chair.className = 'st-chair'; seat.appendChild(chair);
                const nm = document.createElement('div'); nm.className = 'st-name'; nm.textContent = name;
                if (admin) {
                    nm.contentEditable = 'true'; nm.title = 'Click to edit name';
                    nm.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); nm.blur(); } });
                    nm.addEventListener('blur', () => {
                        const seats = stCur()[side][ti] && stCur()[side][ti].seats;
                        if (!seats || si >= seats.length) return;
                        const v = nm.innerText.trim();
                        if (v !== seats[si]) { seats[si] = v; stSave(); }
                    });
                }
                seat.appendChild(nm); desk.appendChild(seat);
            });
            if (admin) {
                const badge = document.createElement('div'); badge.className = 'st-badge'; desk.appendChild(badge);
                const handle = document.createElement('div'); handle.className = 'st-handle';
                handle.title = 'Drag to resize every table on this side (double-click to reset)';
                stAttachResize(handle, side); desk.appendChild(handle);
            }
            return desk;
        }
        // Resizing changes the LENGTH of every table on the SAME side only (left and right are independent).
        function stAttachResize(handle, side) {
            const dir = side === 'left' ? 1 : -1;
            const all = () => document.querySelectorAll('#stRoom .st-desk.side-' + side);
            handle.addEventListener('pointerdown', e => {
                e.preventDefault(); e.stopPropagation();
                handle.setPointerCapture(e.pointerId); handle.classList.add('dragging');
                all().forEach(d => d.classList.add('resizing'));
                const startX = e.clientX, startW = stCur().colW[side], otherW = stCur().colW[side === 'left' ? 'right' : 'left'];
                const grid = document.querySelector('#stRoom .st-grid');
                const maxW = Math.max(ST_MIN_W, Math.min(ST_MAX_W, grid.clientWidth - 40 - 10 - otherW));
                const onMove = ev => {
                    const w = Math.round(Math.min(maxW, Math.max(ST_MIN_W, startW + dir * ((ev.clientX - startX) / stScale))));
                    stCur().colW[side] = w;
                    all().forEach(d => { d.style.width = w + 'px'; const b = d.querySelector('.st-badge'); if (b) b.textContent = 'Length: ' + w; });
                };
                const onUp = ev => {
                    handle.classList.remove('dragging'); all().forEach(d => d.classList.remove('resizing'));
                    handle.removeEventListener('pointermove', onMove); handle.removeEventListener('pointerup', onUp); handle.removeEventListener('pointercancel', onUp);
                    try { handle.releasePointerCapture(ev.pointerId); } catch (err) { }
                    stSave();
                };
                handle.addEventListener('pointermove', onMove); handle.addEventListener('pointerup', onUp); handle.addEventListener('pointercancel', onUp);
            });
            handle.addEventListener('dblclick', e => { e.stopPropagation(); stCur().colW[side] = ST_DEFAULT_W; stSave(); stRenderLayout(); });
        }

        /* ---- add / remove seats ---- */
        function stAddSeat() {
            if (!isAdminRole()) return;
            const input = document.getElementById('stNewName'), name = input.value.trim();
            if (!name) { showToast('Please enter a student name before adding.'); input.focus(); return; }
            const [side, idx] = document.getElementById('stTableSel').value.split('-');
            stCur()[side][parseInt(idx, 10)].seats.push(name);
            input.value = ''; stSave(); stRenderLayout(); stRenderMeNote();
        }
        function stRemoveSeat(side, ti, si) {
            if (!isAdminRole()) return;
            stConfirm('Remove seat', 'Are you sure you want to remove this seat?', 'Remove', () => {
                const seats = stCur()[side][ti].seats;
                if (si >= 0 && si < seats.length) seats.splice(si, 1);
                stSave(); stRenderLayout(); stRenderMeNote();
            });
        }

        /* ---- door ---- */
        function stApplyDoor() {
            const room = document.getElementById('stRoom'), door = document.getElementById('stDoorArea');
            const W = room.clientWidth, maxF = Math.max(0, (W - door.offsetWidth) / W);
            const lab = stCur(); lab.doorPos = Math.min(Math.max(lab.doorPos, 0), maxF);
            door.style.left = (lab.doorPos * 100) + '%';
        }
        function stNudgeDoor(dir) { if (!isAdminRole()) return; stCur().doorPos = (stCur().doorPos || 0) + dir * 0.05; stApplyDoor(); stSave(); }
        (function stInitDoorDrag() {
            const door = document.getElementById('stDoorArea'), room = document.getElementById('stRoom');
            door.addEventListener('pointerdown', e => {
                if (!isAdminRole()) return;
                e.preventDefault(); door.setPointerCapture(e.pointerId); door.classList.add('dragging');
                const W = room.clientWidth, maxF = Math.max(0, (W - door.offsetWidth) / W), startX = e.clientX, startF = stCur().doorPos;
                const onMove = ev => {
                    const f = Math.min(Math.max(startF + ((ev.clientX - startX) / stScale) / W, 0), maxF);
                    stCur().doorPos = f; door.style.left = (f * 100) + '%';
                };
                const onUp = ev => {
                    door.classList.remove('dragging');
                    door.removeEventListener('pointermove', onMove); door.removeEventListener('pointerup', onUp); door.removeEventListener('pointercancel', onUp);
                    try { door.releasePointerCapture(ev.pointerId); } catch (err) { }
                    stSave();
                };
                door.addEventListener('pointermove', onMove); door.addEventListener('pointerup', onUp); door.addEventListener('pointercancel', onUp);
            });
            door.addEventListener('dblclick', () => { if (!isAdminRole()) return; stCur().doorPos = ST_DEFAULT_DOOR; stApplyDoor(); stSave(); });
        })();

        /* ---- fit the room to the width of the page ---- */
        function stFit() {
            const stage = document.getElementById('stStage'), wrap = document.getElementById('stRoomWrap');
            if (!stage || !wrap) return;
            const aw = stage.clientWidth, w = wrap.offsetWidth, h = wrap.offsetHeight;
            if (!aw || !w || !h) return;                       // view is hidden: fit again when it is shown
            const s = Math.min(aw / w, 1.25);
            stScale = s;
            wrap.style.transform = 'translate(' + ((aw - w * s) / 2) + 'px,0) scale(' + s + ')';
            stage.style.height = Math.ceil(h * s) + 'px';
        }
        if (window.ResizeObserver) {
            const ro = new ResizeObserver(stFit);
            ro.observe(document.getElementById('stStage')); ro.observe(document.getElementById('stRoomWrap'));
        }
        addEventListener('resize', stFit);

        /* ---- download as image (library loaded only when needed) ---- */
        function stLoadH2C() {
            if (window.html2canvas) return Promise.resolve();
            return new Promise((res, rej) => {
                const s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                s.onload = res; s.onerror = () => rej(new Error('offline'));
                document.head.appendChild(s);
            });
        }
        function stDownloadImage() {
            const btn = document.getElementById('stDownloadBtn'), label = btn.textContent;
            btn.disabled = true; btn.textContent = 'Preparing…';
            window.getSelection().removeAllRanges();
            stLoadH2C().then(() => window.html2canvas(document.getElementById('stRoom'), {
                scale: 2, backgroundColor: '#ffffff',
                onclone: doc => {
                    const w = doc.getElementById('stRoomWrap'); w.style.transform = 'none'; w.style.position = 'relative';
                    const st = doc.getElementById('stStage'); st.style.overflow = 'visible'; st.style.position = 'static'; st.style.height = 'auto';
                },
                ignoreElements: el => el.classList && (el.classList.contains('st-handle') || el.classList.contains('st-badge') || el.classList.contains('st-remove'))
            })).then(canvas => {
                const a = document.createElement('a');
                a.href = canvas.toDataURL('image/png');
                a.download = stCur().name.replace(/[^\w\-]+/g, '_') + '_Seating.png';
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
            }).catch(() => showToast('Could not create the image. Check your internet connection and try again.'))
                .finally(() => { btn.disabled = false; btn.textContent = label; });
        }

        document.getElementById('stAddBtn').addEventListener('click', stAddSeat);
        document.getElementById('stNewName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); stAddSeat(); } });
        document.getElementById('stDoorLeft').addEventListener('click', () => stNudgeDoor(-1));
        document.getElementById('stDoorRight').addEventListener('click', () => stNudgeDoor(1));
        document.getElementById('stRenameBtn').addEventListener('click', () => stRenameLab(ST_ACTIVE));
        document.getElementById('stDownloadBtn').addEventListener('click', stDownloadImage);
        document.getElementById('stSaveBtn').addEventListener('click', () => stSave(true));
        renderSeating();

        /* ============ ATTENDANCE ============ */
        const AT_KEY = 'sbte_attendance_v1';
        const AT_CLOUD = 'attendance';
        const AT_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const AT_DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        // ATT = { 'YYYY-MM': { holidays: { day: true|false }, marks: { studentId: { day: 'P'|'A' } } } }
        let ATT = {};
        try { ATT = JSON.parse(localStorage.getItem(AT_KEY)) || {}; } catch (e) { }
        // v2: 'P' present, 'T' present but late (shown as grey P), 'L' leave, 'A' absent. Earlier saves used 'L' for late.
        function atMigrate(d) {
            if (d && typeof d === 'object' && d.v !== 2) {
                Object.values(d.marks || {}).forEach(m => { for (const k in m) if (m[k] === 'L') m[k] = 'T'; });
                d.v = 2;
            }
            return d;
        }
        Object.keys(ATT).forEach(k => atMigrate(ATT[k]));
        const atDirty = new Set();
        let atSelDay = null, atSaveTimer = null, atWarned = false;

        const atEl = id => document.getElementById(id);
        const atKey = () => atEl('atYearSel').value + '-' + String(atEl('atMonthSel').value).padStart(2, '0');
        const atDaysIn = key => { const [y, m] = key.split('-').map(Number); return new Date(y, m, 0).getDate(); };
        const atDow = (key, d) => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };
        function atIsHoliday(key, d) {
            const h = ATT[key] && ATT[key].holidays;
            if (h && Object.prototype.hasOwnProperty.call(h, d)) return !!h[d];
            return atDow(key, d) === 0;                    // Sundays are holidays unless switched off
        }
        function atEnsure(key) {
            if (!ATT[key]) ATT[key] = { v: 2, holidays: {}, marks: {} };
            if (!ATT[key].holidays) ATT[key].holidays = {};
            if (!ATT[key].marks) ATT[key].marks = {};
            return ATT[key];
        }
        function atAllStudents() {
            const m = new Map();
            RECORDS.forEach(r => { const id = String(r.id); if (!m.has(id)) m.set(id, { id, name: r.name, batch: r.batch }); });
            return [...m.values()].sort((a, b) => a.batch.localeCompare(b.batch) || a.name.localeCompare(b.name));
        }
        function atVisibleStudents() {
            let list = atAllStudents();
            if (isAdminRole()) {
                const b = atEl('atBatchSel').value;
                if (b) list = list.filter(s => s.batch === b);
            } else {
                const ses = getSavedSession(), id = ses && ses.id != null ? String(ses.id) : null;
                list = list.filter(s => id ? s.id === id : (ses && s.name === ses.name));
            }
            return list;
        }
        const atMark = (key, id, d) => (ATT[key] && ATT[key].marks[id] && ATT[key].marks[id][d]) || '';
        function atRecordedDays(key) {
            const data = ATT[key]; if (!data) return 0;
            let c = 0;
            for (let d = 1; d <= atDaysIn(key); d++) {
                if (atIsHoliday(key, d)) continue;
                if (Object.values(data.marks).some(m => m && m[d])) c++;
            }
            return c;
        }
        // everything the screen, CSV and Excel need, calculated once
        function atBuild() {
            const key = atKey(), n = atDaysIn(key), students = atVisibleStudents(), rec = atRecordedDays(key);
            const days = []; for (let d = 1; d <= n; d++) days.push({ d, hol: atIsHoliday(key, d), dow: atDow(key, d) });
            const rows = students.map((s, i) => {
                let total = 0, late = 0, leave = 0;
                const cells = days.map(x => { const v = x.hol ? '' : atMark(key, s.id, x.d); if (v === 'P' || v === 'T') total++; if (v === 'T') late++; if (v === 'L') leave++; return v; });
                return { n: i + 1, ...s, cells, total, late, leave, pct: rec ? total / rec * 100 : null };
            });
            const daily = days.map((x, j) => {
                if (x.hol) return { count: null, pct: null };
                const any = rows.some(r => r.cells[j]);
                const count = rows.filter(r => r.cells[j] === 'P' || r.cells[j] === 'T').length;
                return { count, pct: any && rows.length ? count / rows.length * 100 : null, any };
            });
            const totalP = rows.reduce((a, r) => a + r.total, 0), totalLate = rows.reduce((a, r) => a + r.late, 0), totalLeave = rows.reduce((a, r) => a + r.leave, 0);
            const overall = rec && rows.length ? totalP / (rec * rows.length) * 100 : null;
            return { key, days, rows, daily, rec, totalP, totalLate, totalLeave, overall };
        }
        const atFmt = v => v == null ? '—' : (Math.round(v * 10) / 10) + '%';
        const atTitle = key => { const [y, m] = key.split('-').map(Number); return AT_MONTHS[m - 1] + ' ' + y; };

        function atFillSelects() {
            const mSel = atEl('atMonthSel'), ySel = atEl('atYearSel');
            if (!mSel.options.length) {
                const now = new Date();
                AT_MONTHS.forEach((m, i) => { const o = document.createElement('option'); o.value = i + 1; o.textContent = m; mSel.appendChild(o); });
                for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) { const o = document.createElement('option'); o.value = y; o.textContent = y; ySel.appendChild(o); }
                mSel.value = now.getMonth() + 1; ySel.value = now.getFullYear();
            }
            const bSel = atEl('atBatchSel'), cur = bSel.value;
            const batches = [...new Set(RECORDS.map(r => r.batch))].sort();
            bSel.innerHTML = '<option value="">All batches</option>' + batches.map(b => `<option value="${escH(b)}">${escH(b)}</option>`).join('');
            if (batches.includes(cur)) bSel.value = cur;
        }

        function renderAttendance() {
            const wrap = atEl('atWrap'); if (!wrap) return;
            atFillSelects();
            const admin = isAdminRole(), B = atBuild(), key = B.key;
            if (atSelDay && atSelDay > B.days.length) atSelDay = null;
            const sx = wrap.scrollLeft, sy = wrap.scrollTop;
            const head = B.days.map(x => `<th class="at-day${x.hol ? ' hol' : ''}${atSelDay === x.d ? ' sel' : ''}" data-day="${x.d}" title="${AT_DOW[x.dow]} ${x.d} ${atTitle(key)}${x.hol ? ' (holiday)' : ''}">${x.d}<small>${AT_DOW[x.dow].slice(0, 2)}</small></th>`).join('');
            const body = B.rows.map(r => `<tr>
          <td class="c1">${r.n}</td><td class="c2">${escH(r.id)}</td><td class="c3 at-name">${escH(r.name)}</td>
          ${r.cells.map((v, j) => { const x = B.days[j]; return `<td class="at-cell ${x.hol ? 'h' : v === 'P' ? 'p' : v === 'T' ? 't' : v === 'L' ? 'l' : v === 'A' ? 'a' : ''}" data-id="${escH(r.id)}" data-day="${x.d}"${admin && !x.hol ? ' tabindex="0"' : ''}${v === 'T' ? ' title="Present — late arrival"' : v === 'L' ? ' title="Leave"' : ''}>${v === 'T' ? 'P' : v}</td>`; }).join('')}
          <td class="tot" data-tot="${escH(r.id)}">${r.total}</td><td class="late">${r.late}</td><td class="late">${r.leave}</td><td class="pct${r.pct != null && r.pct < 75 ? ' at-low' : ''}" data-pct="${escH(r.id)}">${atFmt(r.pct)}</td></tr>`).join('');
            const foot = admin && B.rows.length ? `<tfoot>
          <tr><td class="c1"></td><td class="c2"></td><td class="c3 at-foot-label">Daily attendance</td>${B.daily.map((x, j) => `<td data-fc="${j}">${x.count == null ? '' : x.count}</td>`).join('')}<td>${B.totalP}</td><td>${B.totalLate}</td><td>${B.totalLeave}</td><td>${atFmt(B.overall)}</td></tr>
          <tr><td class="c1"></td><td class="c2"></td><td class="c3 at-foot-label">Daily percentage</td>${B.daily.map((x, j) => `<td data-fp="${j}">${x.count == null ? '' : atFmt(x.pct)}</td>`).join('')}<td></td><td></td><td></td><td></td></tr></tfoot>` : '';
            wrap.innerHTML = B.rows.length ? `<table class="at-table"><thead><tr><th class="c1">#</th><th class="c2">Std ID</th><th class="c3 at-name">Name</th>${head}<th>Total</th><th>Late</th><th>Leave</th><th>%</th></tr></thead><tbody>${body}</tbody>${foot}</table>`
                : '<div class="empty-state">No students found.</div>';
            wrap.scrollLeft = sx; wrap.scrollTop = sy;

            atEl('atSummary').innerHTML = B.rows.length
                ? (admin ? `<strong>${B.rows.length}</strong> students · ` : '') + `<strong>${B.rec}</strong> working day${B.rec === 1 ? '' : 's'} recorded · ${admin ? 'overall' : 'your attendance'} <strong>${atFmt(admin ? B.overall : (B.rows[0] && B.rows[0].pct))}</strong>`
                : '';
            const lbl = atEl('atSelLabel');
            lbl.textContent = atSelDay ? `Selected day: ${AT_DOW[atDow(key, atSelDay)]} ${atSelDay} ${atTitle(key)}` : 'Click a day number in the table to select that day';
            document.querySelectorAll('#view-attendance [data-atday]').forEach(b => b.disabled = !atSelDay);
        }

        /* ---- editing (admin only) ---- */
        function atSetMark(key, id, d, v) {
            const data = atEnsure(key);
            data.marks[id] = data.marks[id] || {};
            if (v) data.marks[id][d] = v; else delete data.marks[id][d];
        }
        function atChanged() { atDirty.add(atKey()); atSave(); renderAttendance(); }
        function atCycle(td) {
            if (!isAdminRole() || td.classList.contains('h')) return;
            const key = atKey(), id = td.dataset.id, d = +td.dataset.day, cur = atMark(key, id, d);
            atSetMark(key, id, d, cur === '' ? 'P' : cur === 'P' ? 'T' : cur === 'T' ? 'L' : cur === 'L' ? 'A' : '');
            atChanged();
            const again = document.querySelector(`#atWrap td.at-cell[data-id="${id}"][data-day="${d}"]`); if (again) again.focus();
        }
        function atDayAction(v) {
            if (!isAdminRole() || !atSelDay) return;
            const key = atKey(), d = atSelDay;
            if (v === 'H') {
                const data = atEnsure(key), def = atDow(key, d) === 0, nowHol = atIsHoliday(key, d);
                if ((!nowHol) === def) delete data.holidays[d]; else data.holidays[d] = !nowHol;
            } else {
                if (atIsHoliday(key, d)) { showToast('That day is a holiday. Turn the holiday off first.'); return; }
                atVisibleStudents().forEach(s => atSetMark(key, s.id, d, v));
            }
            atChanged();
        }

        /* ---- saving: device + cloud (one JSON string per month) ---- */
        const atClock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        function atSetStatus(t) { const e = atEl('atSaveStatus'); if (e) e.textContent = t; }
        function atSave(now) {
            if (!isAdminRole()) return;
            try { localStorage.setItem(AT_KEY, JSON.stringify(ATT)); } catch (e) { }
            if (!USING_FIREBASE || !FB) { atSetStatus('Saved on this device · ' + atClock()); if (now === true) showToast('Attendance saved on this device.'); return; }
            atSetStatus('Saving…');
            clearTimeout(atSaveTimer);
            const run = () => {
                const keys = [...atDirty]; atDirty.clear();
                return Promise.all(keys.map(k => FB.set(FB.ref(FB.db, AT_CLOUD + '/' + k), JSON.stringify(ATT[k] || { v: 2, holidays: {}, marks: {} }))))
                    .then(() => { setCloudStatus('connected'); atSetStatus('All changes saved · ' + atClock()); if (now === true) showToast('Attendance saved.'); })
                    .catch(err => {
                        console.warn('Attendance cloud save failed:', err);
                        keys.forEach(k => atDirty.add(k));
                        atSetStatus('Saved on this device only');
                        if (now === true || !atWarned) { atWarned = true; showToast('Attendance saved on this device only — the cloud database refused the write.'); }
                    });
            };
            if (now === true) run(); else atSaveTimer = setTimeout(run, 500);
        }
        async function atLoadCloud() {
            const snap = await FB.get(FB.ref(null, AT_CLOUD));
            const cloud = snap.exists() ? snap.val() : {};
            Object.keys(cloud).forEach(k => { try { const v = typeof cloud[k] === 'string' ? JSON.parse(cloud[k]) : cloud[k]; if (v && typeof v === 'object') ATT[k] = atMigrate(v); } catch (e) { } });
            try { localStorage.setItem(AT_KEY, JSON.stringify(ATT)); } catch (e) { }
            if (isAdminRole()) { Object.keys(ATT).forEach(k => { if (!(k in cloud)) atDirty.add(k); }); if (atDirty.size) atSave(); }   // push device-only months up
            renderAttendance();
        }

        /* ---- downloads ---- */
        function atDownload(name, mime, content) {
            const url = URL.createObjectURL(new Blob([content], { type: mime }));
            const a = document.createElement('a'); a.href = url; a.download = name;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        }
        function atFileName(B, ext) {
            const b = isAdminRole() ? (atEl('atBatchSel').value || 'All') : (B.rows[0] ? B.rows[0].name : 'My');
            return ('Attendance_' + B.key + '_' + b).replace(/[^\w\-]+/g, '_') + '.' + ext;
        }
        const atDayLabel = (B, x) => x.d + '-' + AT_MONTHS[+B.key.split('-')[1] - 1].slice(0, 3);
        function atCsv() {
            const B = atBuild(); if (!B.rows.length) { showToast('Nothing to download.'); return; }
            const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"', admin = isAdminRole();
            const lines = [['#', 'Std ID', 'Name', 'Batch', ...B.days.map(x => atDayLabel(B, x)), 'Total', 'Late', 'Leave', '%'].map(q).join(',')];
            B.rows.forEach(r => lines.push([r.n, r.id, r.name, r.batch, ...r.cells.map((v, j) => B.days[j].hol ? 'H' : v === 'T' ? 'P (late)' : v), r.total, r.late, r.leave, r.pct == null ? '' : Math.round(r.pct * 10) / 10 + '%'].map(q).join(',')));
            if (admin) {
                lines.push(['', '', 'Daily Attendance', '', ...B.daily.map(x => x.count == null ? '' : x.count), B.totalP, B.totalLate, B.totalLeave, B.overall == null ? '' : Math.round(B.overall * 10) / 10 + '%'].map(q).join(','));
                lines.push(['', '', 'Daily Percentage', '', ...B.daily.map(x => x.count == null ? '' : atFmt(x.pct)), '', '', '', ''].map(q).join(','));
            }
            atDownload(atFileName(B, 'csv'), 'text/csv;charset=utf-8', '\ufeff' + lines.join('\r\n'));
        }
        // An Excel-readable table with the same colours as the on-screen register (green P, red A, grey holiday)
        function atXls() {
            const B = atBuild(); if (!B.rows.length) { showToast('Nothing to download.'); return; }
            const admin = isAdminRole(), e = escH, ncols = 4 + B.days.length + 4;
            const base = 'border:1px solid #9aa5b1;text-align:center;font-family:Calibri,Arial,sans-serif;font-size:11pt;';
            const st = { P: base + 'background:#c6efce;color:#006100;font-weight:bold;', A: base + 'background:#ffc7ce;color:#9c0006;font-weight:bold;', H: base + 'background:#d9d9d9;color:#595959;', T: base + 'background:#a6a6a6;color:#000000;font-weight:bold;', L: base + 'background:#ffeb9c;color:#7f6000;font-weight:bold;', th: base + 'background:#e8edf3;font-weight:bold;', tot: base + 'font-weight:bold;background:#f3f6fa;' };
            let h = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${e(atTitle(B.key))}</x:Name></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table>`;
            h += `<tr><td colspan="${ncols}" style="font-size:14pt;font-weight:bold;font-family:Calibri,Arial,sans-serif;">Attendance — ${e(atTitle(B.key))}${admin && atEl('atBatchSel').value ? ' — ' + e(atEl('atBatchSel').value) : ''}</td></tr>`;
            h += '<tr>' + ['#', 'Std ID', 'Name', 'Batch', ...B.days.map(x => atDayLabel(B, x)), 'Total', 'Late', 'Leave', '%'].map(t => `<td style="${st.th}">${e(t)}</td>`).join('') + '</tr>';
            B.rows.forEach(r => {
                h += `<tr><td style="${base}">${r.n}</td><td style="${base}">${e(r.id)}</td><td style="${base}text-align:left;">${e(r.name)}</td><td style="${base}">${e(r.batch)}</td>`;
                r.cells.forEach((v, j) => { h += B.days[j].hol ? `<td style="${st.H}"></td>` : `<td style="${v ? st[v] : base}">${v === 'T' ? 'P' : v}</td>`; });
                h += `<td style="${st.tot}">${r.total}</td><td style="${st.tot}">${r.late}</td><td style="${st.tot}">${r.leave}</td><td style="${st.tot}">${r.pct == null ? '' : Math.round(r.pct * 10) / 10 + '%'}</td></tr>`;
            });
            if (admin) {
                h += `<tr><td style="${st.th}"></td><td style="${st.th}"></td><td style="${st.th}">Daily Attendance</td><td style="${st.th}"></td>` + B.daily.map(x => `<td style="${st.th}">${x.count == null ? '' : x.count}</td>`).join('') + `<td style="${st.th}">${B.totalP}</td><td style="${st.th}">${B.totalLate}</td><td style="${st.th}">${B.totalLeave}</td><td style="${st.th}">${B.overall == null ? '' : Math.round(B.overall * 10) / 10 + '%'}</td></tr>`;
                h += `<tr><td style="${st.th}"></td><td style="${st.th}"></td><td style="${st.th}">Daily Percentage</td><td style="${st.th}"></td>` + B.daily.map(x => `<td style="${st.th}">${x.count == null ? '' : atFmt(x.pct)}</td>`).join('') + `<td style="${st.th}"></td><td style="${st.th}"></td><td style="${st.th}"></td><td style="${st.th}"></td></tr>`;
            }
            h += '</table></body></html>';
            atDownload(atFileName(B, 'xls'), 'application/vnd.ms-excel;charset=utf-8', '\ufeff' + h);
        }

        atEl('atWrap').addEventListener('click', e => {
            const th = e.target.closest('th.at-day');
            if (th && isAdminRole()) { const d = +th.dataset.day; atSelDay = atSelDay === d ? null : d; renderAttendance(); return; }
            const td = e.target.closest('td.at-cell'); if (td) atCycle(td);
        });
        atEl('atWrap').addEventListener('keydown', e => {
            const td = e.target.closest && e.target.closest('td.at-cell'); if (!td || !isAdminRole() || td.classList.contains('h')) return;
            const k = e.key.toLowerCase(), key = atKey(), id = td.dataset.id, d = +td.dataset.day;
            if (k === 'p' || k === 't' || k === 'l' || k === 'a' || k === 'backspace' || k === 'delete') {
                e.preventDefault(); atSetMark(key, id, d, k === 'p' ? 'P' : k === 't' ? 'T' : k === 'l' ? 'L' : k === 'a' ? 'A' : ''); atChanged();
                const again = document.querySelector(`#atWrap td.at-cell[data-id="${id}"][data-day="${d}"]`); if (again) again.focus();
            } else if (k === ' ' || k === 'enter') { e.preventDefault(); atCycle(td); }
        });
        ['atMonthSel', 'atYearSel', 'atBatchSel'].forEach(id => atEl(id).addEventListener('change', () => { atSelDay = null; renderAttendance(); }));
        document.querySelectorAll('#view-attendance [data-atday]').forEach(b => b.addEventListener('click', () => atDayAction(b.dataset.atday)));
        atEl('atSaveBtn').addEventListener('click', () => { atDirty.add(atKey()); atSave(true); });
        atEl('atCsvBtn').addEventListener('click', atCsv);
        atEl('atXlsBtn').addEventListener('click', atXls);
        renderAttendance();

        /* ============ DESIGN PICKER ============ */
        const DESIGN_KEY = 'sbte_design';
        const DESIGNS = [
            { id: 'classic', name: 'Classic', desc: 'The original look with soft blue accents.' },
            { id: 'minimal', name: 'Minimalism', desc: 'Flat and quiet: hairlines, lots of space, no shadows.' },
            { id: 'neumorphic', name: 'Neumorphism', desc: 'Soft surfaces that look raised or pressed in.' },
            { id: 'glass', name: 'Glassmorphism', desc: 'Frosted see-through panels over a soft gradient.' },
            { id: 'brutalist', name: 'Brutalism', desc: 'Bold black outlines, hard shadows, bright colours.' }
        ];
        const currentDesign = () => document.documentElement.getAttribute('data-design') || 'neumorphic';
        function applyDesign(id) {
            if (!DESIGNS.some(d => d.id === id)) id = 'neumorphic';
            document.documentElement.setAttribute('data-design', id);
            try { localStorage.setItem(DESIGN_KEY, id); } catch (e) { }
            setTimeout(() => window.dispatchEvent(new Event('resize')), 60);   // let charts and the seating plan refit
        }
        function openDesignPicker() {
            if (document.getElementById('designPicker')) return;
            const wrap = document.createElement('div'); wrap.className = 'dlg-back'; wrap.id = 'designPicker';
            const card = d => `<button type="button" class="dg-card${d.id === currentDesign() ? ' on' : ''}" data-d="${d.id}" aria-pressed="${d.id === currentDesign()}">
          <div class="dg-thumb dg-t-${d.id}"><span class="dg-bar"></span><div class="dg-row"><i></i><i></i><i></i></div><div class="dg-chart"><b style="height:40%"></b><b style="height:70%"></b><b style="height:55%"></b><b style="height:90%"></b><b style="height:65%"></b></div><span class="dg-btn"></span></div>
          <div class="dg-name"><span>${d.name}</span><span class="dg-tick">${d.id === currentDesign() ? 'âœ“ Selected' : ''}</span></div>
          <div class="dg-desc">${d.desc}</div></button>`;
            wrap.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" aria-label="Choose website design" tabindex="-1" style="width:min(820px,95vw);max-width:95vw;">
        <h3>Choose a website design</h3>
        <div class="dlg-body">Pick a picture to switch the whole website to that style. It applies straight away and is remembered on this device.
        <div class="dg-grid">${DESIGNS.map(card).join('')}</div>
        <div class="ac-section"><div class="ac-title" id="acTitle">Theme colour</div>
        <div class="ac-row" role="group" aria-labelledby="acTitle">${ACCENTS.map(a => `<button type="button" class="ac-swatch" data-a="${a.id}" aria-label="${a.name}" aria-pressed="${a.id === currentAccent()}" style="background:${a.swatch}"><span class="ac-check" style="color:${a.check}">✓</span></button>`).join('')}</div></div></div>
        <div class="dlg-btns"><button type="button" class="btn primary" data-close="1">Done</button></div></div>`;
            document.body.appendChild(wrap);
            const refresh = () => {
                wrap.querySelectorAll('.dg-card').forEach(c => {
                    const on = c.dataset.d === currentDesign();
                    c.classList.toggle('on', on); c.setAttribute('aria-pressed', on);
                    c.querySelector('.dg-tick').textContent = on ? 'âœ“ Selected' : '';
                });
                wrap.querySelectorAll('.ac-swatch').forEach(s => s.setAttribute('aria-pressed', s.dataset.a === currentAccent()));
            };
            wrap.addEventListener('click', e => {
                const c = e.target.closest('.dg-card');
                if (c) { applyDesign(c.dataset.d); refresh(); return; }
                const sw = e.target.closest('.ac-swatch');
                if (sw) { applyAccent(sw.dataset.a); refresh(); return; }
                if (e.target === wrap || e.target.dataset.close) wrap.remove();
            });
            wrap.addEventListener('keydown', e => { if (e.key === 'Escape') wrap.remove(); });
            const sel = wrap.querySelector('.dg-card.on'); if (sel) sel.focus();
        }
        ['designBtn', 'designBtnLogin'].forEach(id => { const b = document.getElementById(id); if (b) b.addEventListener('click', openDesignPicker); });

        /* ============ THEME COLOUR (ACCENT) ============
           Six accents, stored per-device in localStorage (no Firebase sync)
           and applied as data-accent on <html> - the pre-paint script in
           index.html restores it before first paint so there is no flash.
           Blue is the default and has no CSS override block at all. */
        const ACCENT_KEY = 'sbte_accent';
        const ACCENTS = [
            { id: 'blue', name: 'Blue', swatch: '#0EA5E9', check: '#fff' },
            { id: 'red', name: 'Red', swatch: '#E5484D', check: '#fff' },
            { id: 'yellow', name: 'Yellow', swatch: '#EAB308', check: '#1F1400' },
            { id: 'green', name: 'Green', swatch: '#2FA36B', check: '#fff' },
            { id: 'pink', name: 'Pink', swatch: '#EC4899', check: '#fff' },
            { id: 'brown', name: 'Brown', swatch: '#A47148', check: '#fff' }
        ];
        const currentAccent = () => document.documentElement.getAttribute('data-accent') || 'blue';
        function applyAccent(id) {
            if (!ACCENTS.some(a => a.id === id)) id = 'blue';
            document.documentElement.setAttribute('data-accent', id);
            try { localStorage.setItem(ACCENT_KEY, id); } catch (e) { }
            refreshAccentViews();
        }
        // SVG charts draw with var(--sky*), so most views restyle live;
        // re-render anyway so anything JS-computed is rebuilt too, and the
        // resize event lets charts and the seating plan refit.
        function refreshAccentViews() {
            try { renderDashboard(); } catch (e) { }
            try { renderReport(currentReportRecord()); } catch (e) { }
            try { renderBatch(); } catch (e) { }
            try { renderAttendance(); } catch (e) { }
            setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
        }

        /* ============ Auto-restore Session on Page Load ============ */
        (function restoreSessionOnLoad() {
            const savedSession = getSavedSession();
            if (savedSession && savedSession.role) {
                logIn(savedSession, true);
            }
        })();

        /* ============ Firebase boot: load saved data, or seed it on first run ============ */

        // ============ MongoDB Atlas connection check ============
async function checkMongoDB() {
    setCloudStatus('connecting');
    try {
        const res = await fetch(`${API_BASE}/records`);
        if (res.ok) {
            USING_FIREBASE = true;
            FB = { ref: (db, path) => path, get: FB.get, set: FB.set, update: FB.update, remove: FB.remove };
            setCloudStatus('connected');
            console.log('✅ Connected to MongoDB Atlas backend');

            // Load student passwords
            await stuLoadPasswords();

            // Load records (or seed if first run)
            const snap = await FB.get(FB.ref(null, 'records'));
            if (snap.exists()) {
                const val = snap.val();
                const cloudRecords = Object.values(val).map(rec => ({ ...rec, id: rec.id })).map(normalizeRecord);
                if (cloudRecords.length) {
                    RECORDS.length = 0;
                    cloudRecords.forEach(r => RECORDS.push(r));
                    rebuildSelectors();
                    refreshReportMonths();
                    refreshBatchMonths();
                    renderDashboard();

                    const curSession = getSavedSession();
                    if (curSession && curSession.role === 'student') {
                        repStudent.value = curSession.name;
                        refreshReportMonths();
                    } else if (curSession && curSession.role === 'admin') {
                        try {
                            const savedRep = JSON.parse(localStorage.getItem(ACTIVE_REPORT_KEY));
                            if (savedRep && savedRep.student && [...repStudent.options].some(o => o.value === savedRep.student)) {
                                repStudent.value = savedRep.student;
                                refreshReportMonths();
                                if (savedRep.month && [...repMonth.options].some(o => o.value === savedRep.month)) {
                                    repMonth.value = savedRep.month;
                                }
                            }
                        } catch (e) { }
                    }
                    renderReport(currentReportRecord());
                    renderBatch();

                    let savedView = null;
                    try { savedView = localStorage.getItem(ACTIVE_VIEW_KEY); } catch (e) { }
                    if (savedView) switchView(savedView);
                }
            } else {
                // first run ever — seed the MongoDB database with the workbook data baked into this page
                for (const r of RECORDS) {
                    await FB.set(FB.ref(null, 'records/' + recKey(r)), r);
                }
            }

            // Load notes
            const notesSnap = await FB.get(FB.ref(null, 'notes'));
            if (notesSnap.exists()) {
                NOTES = Object.values(notesSnap.val());
            } else {
                const localNotes = loadNotesLocal();
                if (localNotes.length) {
                    for (const n of localNotes) {
                        await FB.set(FB.ref(null, 'notes/' + n.id), n);
                    }
                }
                NOTES = localNotes;
            }
            renderNotes();

            // Load simulations
            const simsSnap = await FB.get(FB.ref(null, 'simulations'));
            if (simsSnap.exists()) {
                SIMULATIONS = Object.values(simsSnap.val());
            } else {
                const localSims = loadSimsLocal();
                if (localSims.length) {
                    for (const s of localSims) {
                        await FB.set(FB.ref(null, 'simulations/' + s.id), s);
                    }
                }
                SIMULATIONS = localSims;
            }
            renderSims();

            // Load seating and attendance
            try { await stLoadCloud(); } catch (err) { console.warn('Seating load failed:', err); }
            try { await atLoadCloud(); } catch (err) { console.warn('Attendance load failed:', err); }

            // Load layout
            try {
                const layoutSnap = await FB.get(FB.ref(null, 'settings/layout'));
                if (layoutSnap.exists()) {
                    LAYOUT = mergeLayout(layoutSnap.val());
                    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(LAYOUT)); } catch (e) { }
                    applyLayout(); renderSettings(); renderDashboard();
                }
            } catch (err) { console.warn('Layout settings load failed:', err); }

            return true;
        }
    } catch (e) {
        console.warn('MongoDB backend unreachable:', e);
    }
    USING_FIREBASE = false;
    setCloudStatus('offline');
    return false;
}

// Module scripts note: classic scripts run first, so no __fbReady polling needed for MongoDB

// Start MongoDB connection on load
checkMongoDB().finally(() => stuPwResolve());


        // ---------- Dark / Light Theme Management ----------
        function getPreferredTheme() {
            const saved = localStorage.getItem('sbte_theme');
            if (saved === 'dark' || saved === 'light') return saved;
            return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
        }

        function updateThemeUI(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            const isDark = theme === 'dark';
            const text = isDark ? 'Light Mode' : 'Dark Mode';
            const appBtn = document.getElementById('themeToggleBtn');
            const loginBtn = document.getElementById('loginThemeToggleBtn');
            [appBtn, loginBtn].forEach(btn => {
                if (!btn) return;
                const span = btn.querySelector('.theme-toggle-text');
                if (span) span.textContent = text;
                btn.setAttribute('title', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
                btn.setAttribute('aria-label', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
            });
        }

        function toggleTheme() {
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            try {
                localStorage.setItem('sbte_theme', next);
            } catch (e) { }
            updateThemeUI(next);
        }

        const appThemeBtn = document.getElementById('themeToggleBtn');
        if (appThemeBtn) appThemeBtn.addEventListener('click', toggleTheme);

        const loginThemeBtn = document.getElementById('loginThemeToggleBtn');
        if (loginThemeBtn) loginThemeBtn.addEventListener('click', toggleTheme);

        updateThemeUI(document.documentElement.getAttribute('data-theme') || getPreferredTheme());

        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                if (!localStorage.getItem('sbte_theme')) {
                    updateThemeUI(e.matches ? 'dark' : 'light');
                }
            });
        }

        /* ============ LOGIN SCIENCE BACKDROP ============
           Fades maths -> physics -> chemistry behind the sign-in card
           every 3s (380ms cross-fade). Dots let the visitor jump to a
           scene; the timer pauses on a hidden tab and stops for good once
           the user is signed in. */
        (function scienceBackdrop() {
            const overlay = document.getElementById('loginOverlay');
            if (!overlay || !overlay.querySelector('.sci-layer')) return;

            const SCENES = ['math', 'physics', 'chem'];
            const ROTATE_MS = 3000;
            const layers = [...overlay.querySelectorAll('.sci-layer')];
            const dots = [...overlay.querySelectorAll('.sci-dot')];
            const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
            let index = 0, timer = null, stopped = false;

            function show(n) {
                index = ((n % SCENES.length) + SCENES.length) % SCENES.length;
                const scene = SCENES[index];
                overlay.setAttribute('data-scene', scene);
                layers.forEach(l => l.classList.toggle('on', l.getAttribute('data-scene') === scene));
                dots.forEach((d, k) => d.setAttribute('aria-pressed', String(k === index)));
            }

            function stop() { if (timer) { clearInterval(timer); timer = null; } }

            function start() {
                stop();
                if (stopped || reduceMotion) return;
                timer = setInterval(() => show(index + 1), ROTATE_MS);
            }

            dots.forEach((dot, k) => dot.addEventListener('click', () => { show(k); start(); }));

            // pause while the tab is in the background
            document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });

            // stop for good once signed in (the overlay is hidden then)
            const isAuthed = () => document.documentElement.classList.contains('is-authed');
            stopped = isAuthed();
            new MutationObserver(() => {
                if (isAuthed()) { stopped = true; stop(); }
            }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

            show(0);
            start();
        })();

    
