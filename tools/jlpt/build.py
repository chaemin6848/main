#!/usr/bin/env python3
"""JLPT 단어 정적 페이지를 만든다 (검색엔진이 단어 내용을 직접 읽을 수 있게).
사용: python3 tools/jlpt/build.py
입력: public/japanese/vocabulary.js (window.JLPT_VOCABULARY)
출력: public/japanese/jlpt/index.html            레벨 목록
      public/japanese/jlpt/n5/index.html         N5 1–200
      public/japanese/jlpt/n5/2/index.html       N5 201–400 …
      그리고 sitemap.xml의 jlpt 항목을 다시 쓴다.
vocabulary.js를 고친 뒤 다시 돌리면 된다."""
import json, re, html, os, shutil, datetime

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'public')
SRC = os.path.join(ROOT, 'japanese', 'vocabulary.js')
OUT = os.path.join(ROOT, 'japanese', 'jlpt')
SITE = 'https://nihongodic.com'
PER = 200
LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
LEVEL_NOTE = {
    'N5': '가장 기초 단계. 인사, 숫자, 날짜, 기본 동사·형용사처럼 일상에서 바로 쓰는 단어',
    'N4': '기초 회화 단계. 일상생활과 간단한 설명에 쓰는 단어',
    'N3': '중급 입문 단계. 신문 제목, 일상 대화를 자연스럽게 이해하는 데 필요한 단어',
    'N2': '중상급 단계. 뉴스, 업무, 대학 생활에서 자주 보는 단어',
    'N1': '최상급 단계. 논설, 전문적인 글, 격식 있는 표현에 쓰는 단어',
}
esc = lambda s: html.escape(s or '', quote=True)

def load():
    s = open(SRC, encoding='utf-8').read()
    s = s[s.index('['):s.rindex(']') + 1]
    return json.loads(s)

def kana_key(w):
    r = w.get('reading') or w.get('word') or ''
    r = ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in r)  # 가타카나 → 히라가나로 정렬
    return (re.sub(r'^[～〜~]', '', r), w.get('word', ''))

CSS = """:root{--ink:#1c211d;--muted:#6c736b;--paper:#f8f7f2;--card:#fff;--line:#dcdcd3;--lime:#dfff70}
@media (prefers-color-scheme:dark){:root{--ink:#ecefe7;--muted:#9aa197;--paper:#151814;--card:#1d211c;--line:#343a32;--lime:#8fa82e;color-scheme:dark}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font-family:"Noto Sans KR",system-ui,-apple-system,sans-serif;line-height:1.6}
.shell{max-width:820px;margin:0 auto;padding:20px max(20px,env(safe-area-inset-left,0px)) 64px}
.crumb{font-size:13px;color:var(--muted)}.crumb a{color:var(--muted)}
.eyebrow{font-family:"DM Mono",ui-monospace,monospace;font-size:11px;letter-spacing:.12em;color:var(--muted);margin:24px 0 0}
h1{margin:6px 0 10px;font-size:clamp(28px,6vw,42px);line-height:1.2;letter-spacing:-.03em;font-weight:900}
h1 em{font-style:normal;background:linear-gradient(transparent 58%,var(--lime) 58%)}
.lead{margin:0 0 18px;color:var(--muted);font-size:15px}.lead a{color:var(--ink);font-weight:700}
.cta{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 22px}
.cta a{font-size:14px;font-weight:700;color:var(--ink);text-decoration:none;padding:8px 14px;border:1.5px solid var(--ink);border-radius:8px;background:var(--card)}
.cta a.main{background:var(--lime);color:#1c211d;border-color:#1c211d}
.words{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.words li{padding:12px 2px;border-bottom:1px solid var(--line);display:grid;grid-template-columns:minmax(0,11em) minmax(0,1fr);gap:4px 16px}
.w{font-family:"Noto Sans JP","Noto Sans KR",sans-serif;font-size:19px;font-weight:700;line-height:1.3}
.w small{display:block;font-size:13px;font-weight:400;color:var(--muted)}
.m{font-size:15px}
.ex{grid-column:2;font-size:13.5px;color:var(--muted)}
.ex span{font-family:"Noto Sans JP","Noto Sans KR",sans-serif;display:block;color:var(--ink)}
.pager{display:flex;flex-wrap:wrap;gap:6px;margin:24px 0}
.pager a,.pager b{min-width:40px;text-align:center;font-size:13px;padding:6px 10px;border:1px solid var(--line);border-radius:6px;color:var(--ink);text-decoration:none;font-family:"DM Mono",ui-monospace,monospace}
.pager b{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.levels{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.levels a{display:block;padding:16px 18px;background:var(--card);border:1.5px solid var(--ink);border-radius:10px;color:inherit;text-decoration:none;box-shadow:4px 4px 0 var(--lime)}
.levels a:hover{transform:translate(-1px,-1px);box-shadow:5px 5px 0 var(--lime)}
.levels b{font-size:20px;font-weight:900}.levels span{display:block;color:var(--muted);font-size:14px}
footer{margin-top:32px;padding-top:16px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}footer a{color:var(--muted)}
@media (max-width:560px){.words li{grid-template-columns:1fr}.ex{grid-column:1}}"""

def page(title, desc, path, body, prev=None, nxt=None):
    url = SITE + path
    links = ''.join(f'<link rel="{r}" href="{SITE + h}">' for r, h in (('prev', prev), ('next', nxt)) if h)
    return f"""<!doctype html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>{esc(title)}</title><meta name="description" content="{esc(desc)}"><link rel="canonical" href="{url}">{links}
<meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{url}"><meta property="og:type" content="website"><meta property="og:site_name" content="nihongodic"><meta property="og:locale" content="ko_KR">
<meta property="og:image" content="{SITE}/shared/og/jlpt.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="{SITE}/shared/og/jlpt.png">
<link rel="icon" type="image/jpeg" href="/japanese/IMG_2029.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&family=Noto+Sans+JP:wght@400;700&family=DM+Mono&display=swap">
<style>{CSS}</style>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5925323367833464" crossorigin="anonymous"></script>
</head><body>
<script src="/shared/nav.js" data-langs="ko"></script>
<div class="shell">
{body}
<footer>예문 일부: <a href="https://tatoeba.org/" rel="noopener">Tatoeba</a> (<a href="https://creativecommons.org/licenses/by/2.0/fr/" rel="noopener">CC BY 2.0 FR</a>). 뜻과 예문 번역에는 기계 번역이 포함되어 틀릴 수 있습니다. · <a href="/privacy?lang=ko">개인정보처리방침</a></footer>
</div>
</body></html>
"""

def level_path(lv, n=1):
    return f'/japanese/jlpt/{lv.lower()}/' + (f'{n}/' if n > 1 else '')

def main():
    words = load()
    by = {lv: sorted([w for w in words if w.get('level') == lv], key=kana_key) for lv in LEVELS}
    if os.path.isdir(OUT): shutil.rmtree(OUT)
    urls = ['/japanese/jlpt/']
    cta = '<div class="cta"><a class="main" href="/japanese/">퀴즈로 외우기 →</a><a href="/japanese/vocabulary-list">단어 사전에서 검색</a></div>'
    # 레벨 목록
    items = ''.join(f'<li><a href="{level_path(lv)}"><b>JLPT {lv} 단어 {len(by[lv]):,}개</b><span>{esc(LEVEL_NOTE[lv])}</span></a></li>' for lv in LEVELS)
    total = sum(len(v) for v in by.values())
    body = (f'<p class="crumb"><a href="/">nihongodic</a> › <a href="/japanese/">단어 한 장</a> › JLPT 단어 목록</p>'
            f'<p class="eyebrow">JLPT VOCABULARY LIST</p><h1>JLPT <em>단어 목록</em></h1>'
            f'<p class="lead">N5부터 N1까지 일본어 단어 {total:,}개를 레벨별로 정리했습니다. 단어마다 읽기, 한국어 뜻, 예문을 함께 볼 수 있어요.</p>'
            f'{cta}<ul class="levels">{items}</ul>')
    write('index.html', page('JLPT 단어 목록 N5–N1 | 단어 한 장',
          f'JLPT N5·N4·N3·N2·N1 일본어 단어 {total:,}개를 레벨별로 정리한 무료 단어장. 읽기, 한국어 뜻, 예문을 함께 확인하세요.', '/japanese/jlpt/', body))
    for lv in LEVELS:
        ws = by[lv]; pages = (len(ws) + PER - 1) // PER
        for n in range(1, pages + 1):
            chunk = ws[(n - 1) * PER:n * PER]; a, b = (n - 1) * PER + 1, (n - 1) * PER + len(chunk)
            lis = []
            for w in chunk:
                rd = w.get('reading') or ''
                ex = ''
                if w.get('example'):
                    ex = f'<div class="ex"><span lang="ja">{esc(w["example"])}</span>{esc(w.get("exampleKorean"))}</div>'
                lis.append(f'<li><div class="w" lang="ja">{esc(w["word"])}' + (f'<small>{esc(rd)}</small>' if rd and rd != w['word'] else '') +
                           f'</div><div class="m">{esc(w.get("korean"))}</div>{ex}</li>')
            pager = ''.join(f'<b aria-current="page">{i}</b>' if i == n else f'<a href="{level_path(lv, i)}">{i}</a>' for i in range(1, pages + 1))
            other = ' '.join(f'<a href="{level_path(x)}">{x}</a>' for x in LEVELS if x != lv)
            sample = ', '.join(w['word'] for w in chunk[:6])
            title = f'JLPT {lv} 단어 목록 {a}–{b} | 단어 한 장' if pages > 1 else f'JLPT {lv} 단어 목록 | 단어 한 장'
            desc = f'JLPT {lv} 일본어 단어 {len(ws):,}개 중 {a}–{b}번째({sample} 등). 읽기, 한국어 뜻, 예문을 함께 정리했습니다.'
            body = (f'<p class="crumb"><a href="/">nihongodic</a> › <a href="/japanese/">단어 한 장</a> › <a href="/japanese/jlpt/">JLPT 단어 목록</a> › {lv}</p>'
                    f'<p class="eyebrow">JLPT {lv} · {a}–{b} / {len(ws):,}</p><h1>JLPT {lv} <em>단어 목록</em></h1>'
                    f'<p class="lead">{esc(LEVEL_NOTE[lv])}. 히라가나 순으로 {len(ws):,}개 중 {a}–{b}번째 단어입니다. 다른 레벨: {other}</p>'
                    f'{cta}<nav class="pager" aria-label="쪽">{pager}</nav><ul class="words">{"".join(lis)}</ul><nav class="pager" aria-label="쪽">{pager}</nav>')
            path = level_path(lv, n)
            write(path[len('/japanese/jlpt/'):] + 'index.html',
                  page(title, desc, path, body, level_path(lv, n - 1) if n > 1 else None, level_path(lv, n + 1) if n < pages else None))
            urls.append(path)
    # sitemap: 예전 jlpt 항목을 지우고 다시 넣는다
    sm_path = os.path.join(ROOT, 'sitemap.xml'); sm = open(sm_path, encoding='utf-8').read()
    sm = re.sub(r'\s*<url><loc>https://nihongodic\.com/japanese/jlpt/[^<]*</loc>.*?</url>', '', sm)
    today = datetime.date.today().isoformat()
    add = ''.join(f'\n  <url><loc>{SITE}{u}</loc><lastmod>{today}</lastmod></url>' for u in urls)
    sm = sm.replace('\n</urlset>', add + '\n</urlset>')
    open(sm_path, 'w', encoding='utf-8').write(sm)
    print(len(urls), 'pages')

def write(rel, s):
    p = os.path.join(OUT, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8').write(s)

if __name__ == '__main__':
    main()
