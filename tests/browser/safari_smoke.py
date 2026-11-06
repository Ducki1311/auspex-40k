"""Safari/iPhone-Rauchtest (WebKit): alle Fraktionen, Datenblätter, Auto-Liste, Ansichten, neue Funktionen.
Lokal: python3 -m http.server 8765 & python3 tests/browser/safari_smoke.py"""
import asyncio, sys
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/index.html'
async def main():
    bad = 0
    async with async_playwright() as p:
        b = await p.webkit.launch()
        ctx = await b.new_context(**p.devices['iPhone 14'])
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
        pg.on('console', lambda m: m.type == 'error' and 'fonts.g' not in m.text and 'ERR_TUNNEL' not in m.text and errs.append('console: ' + m.text[:300]))
        await pg.goto(URL); await pg.wait_for_timeout(4000)
        print('Onboarding sichtbar:', await pg.evaluate("!!document.querySelector('#xOnboard.is-open')"))
        await pg.evaluate("closeModals(); state.ext.onboarded = true")
        res = await pg.evaluate("""async () => { const out = { ds: 0, err: [] };
          const bad = t => /\\bundefined\\b|\\bNaN\\b|\\[object Object\\]/.exec(t);
          for (const f of GAME_DATA.factions) {
            try {
              state.factionId = f.id; state.mode = 'build'; state.tab = 'katalog'; render();
              for (const u of f.units) { openDatasheet(u.id); out.ds++; const m = bad(document.getElementById('datasheetBody').innerText); if (m) out.err.push(f.id + ' ' + u.name + ': ' + m[0]); closeModals(); }
              state.armies[f.id] = []; state.limit = 2000; runAutoList({ source: 'catalog', limit: 2000 });
              const v = validate().filter(x => x.lvl === 'err'); if (v.length) out.err.push(f.id + ' Regel: ' + v[0].msg);
              state.tab = 'liste'; render(); state.mode = 'play'; render();
              const m2 = bad(document.getElementById('playView').innerText); if (m2) out.err.push(f.id + ' Spiel: ' + m2[0]);
              state.mode = 'math'; state.tab = 'rechner'; render(); state.mode = 'build'; state.tab = 'sammlung'; render();
            } catch (e) { out.err.push(f.id + ': ' + e.message); }
          }
          return out; }""")
        print('Datenblätter geöffnet:', res['ds'], '| Befunde:', len(res['err']))
        for x in res['err'][:20]: print('  ✗', x)
        bad += len(res['err'])
        # Neue Funktionen
        await pg.evaluate("state.factionId='necrons'; runAutoList({source:'catalog',limit:2000}); state.mode='build'; state.tab='liste'; render()")
        await pg.evaluate("xListImage()"); await pg.wait_for_timeout(2500)
        ok_img = await pg.evaluate("(document.querySelector('.x-preview')||{}).naturalWidth||0")
        print('Liste als Bild:', ok_img, 'px breit'); bad += ok_img != 1080
        code = await pg.evaluate("encodeListCode()")
        await pg.evaluate("closeModals(); state.mode='play'; state.tab='spiel'; render()")
        ok = await pg.evaluate("c => xOppLoad(c).then(ok => { renderPlay(); return ok && document.querySelectorAll('[data-action=x-opp-wound]').length > 0 })", code)
        print('Gegnerliste laden:', ok); bad += not ok
        await pg.evaluate("xBuyAdvice()"); await pg.wait_for_timeout(1500)
        print('Kaufempfehlung:', await pg.evaluate("!!document.querySelector('#buyAdvice .x-buy')"))
        print('Seitenfehler:', len(errs)); [print('  ✗', e) for e in errs[:10]]
        bad += len(errs)
        await b.close()
    print('ERGEBNIS:', 'OK' if not bad else f'{bad} Befunde')
    sys.exit(1 if bad else 0)
asyncio.run(main())
