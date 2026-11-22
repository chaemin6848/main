"""한글 지명 → 로마자(국어의 로마자 표기법) · 가타카나.

지도 시군구 이름을 영어·일본어 화면에 쓰려고 만든 간단한 변환기다. 지명에 흔한 자음 동화
(종로→Jongno, 울릉→Ulleung, 백령→Baengnyeong)와 연음(관악→Gwanak)을 반영한다.
된소리되기처럼 로마자 표기법이 적지 않는 변화는 다루지 않는다.
"""
L = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h']
V = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i']
# 받침 → (대표음 종류, 뒤 모음으로 넘어갈 때의 첫소리 번호)
T = [None, ('k', 0), ('k', 1), ('k', 9), ('n', 2), ('n', 12), ('n', 18), ('t', 3), ('l', 5), ('k', 0), ('m', 6), ('l', 7),
     ('l', 9), ('l', 16), ('p', 17), ('l', 18), ('m', 6), ('p', 7), ('p', 9), ('t', 9), ('t', 10), ('ng', None), ('t', 12),
     ('t', 14), ('k', 15), ('t', 16), ('p', 17), ('t', 18)]


def split(word):
    out = []
    for ch in word:
        c = ord(ch) - 0xAC00
        if 0 <= c < 11172: out.append([c // 588, (c % 588) // 28, c % 28])
        else: out.append(ch)
    return out


def pron(word):
    """음절마다 (첫소리 로마자, 모음 번호, 받침 대표음) — 연음과 받침+첫소리 동화를 반영한 발음."""
    sy = split(word)
    out = []
    for i, s in enumerate(sy):
        if isinstance(s, str): out.append(s); continue
        l, v, t = s
        nxt = sy[i + 1] if i + 1 < len(sy) and not isinstance(sy[i + 1], str) else None
        ini = L[l] if isinstance(l, int) else l
        kind = ''
        if t:
            kind, move = T[t]
            if nxt is not None:
                nl = nxt[0]
                if nl == 11 and move is not None:          # 연음: 받침이 다음 모음으로 넘어간다
                    nxt[0] = L[move] if move != 5 else 'r'; kind = ''
                elif nl in (2, 6):                          # ㄴ·ㅁ 앞 비음화
                    kind = {'k': 'ng', 't': 'n', 'p': 'm'}.get(kind, kind)
                    if kind == 'l' and nl == 2: nxt[0] = 'l'
                elif nl == 5:                               # ㄹ 앞
                    if kind in ('n', 'l'): kind = 'l'; nxt[0] = 'l'
                    elif kind in ('m', 'ng'): nxt[0] = 'n'
                    elif kind == 'k': kind = 'ng'; nxt[0] = 'n'
                    elif kind == 'p': kind = 'm'; nxt[0] = 'n'
                    elif kind == 't': kind = 'n'; nxt[0] = 'n'
        out.append((ini, v, kind))
    return out


def rr(word):
    """국어의 로마자 표기법(지명용, 소문자)."""
    return ''.join(x if isinstance(x, str) else x[0] + V[x[1]] + x[2] for x in pron(word))


# 가타카나: (첫소리 → 어두/어중 행) — 행은 a·i·u·e·o 다섯 글자
ROW = {
    'k': ('カキクケコ', 'ガギグゲゴ'), 'n': ('ナニヌネノ',) * 2, 't': ('タチトゥテト', 'ダジドゥデド'), 'r': ('ラリルレロ',) * 2,
    'm': ('マミムメモ',) * 2, 'p': ('パピプペポ', 'バビブベボ'), 's': ('サシスセソ',) * 2, '': ('アイウエオ',) * 2,
    'j': ('チャチチュチェチョ', 'ジャジジュジェジョ'), 'ch': ('チャチチュチェチョ',) * 2, 'kh': ('カキクケコ',) * 2,
    'th': ('タチトゥテト',) * 2, 'ph': ('パピプペポ',) * 2, 'h': ('ハヒフヘホ',) * 2,
}
LK = ['k', 'k', 'n', 't', 't', 'r', 'm', 'p', 'p', 's', 's', '', 'j', 'j', 'ch', 'kh', 'th', 'ph', 'h']
# 모음 → (기본 모음 a/i/u/e/o, 앞에 y·w)
VK = [('a', ''), ('e', ''), ('a', 'y'), ('e', 'y'), ('o', ''), ('e', ''), ('o', 'y'), ('e', 'y'), ('o', ''), ('a', 'w'), ('e', 'w'),
      ('e', 'w'), ('o', 'y'), ('u', ''), ('o', 'w'), ('e', 'w'), ('i', 'w'), ('u', 'y'), ('u', ''), ('i', 'w'), ('i', '')]
SMALL_Y = {'a': 'ャ', 'u': 'ュ', 'o': 'ョ', 'e': 'ェ'}
SMALL_W = {'a': 'ァ', 'i': 'ィ', 'e': 'ェ', 'o': 'ォ'}
IK = {'g': 'k', 'kk': 'k', 'n': 'n', 'd': 't', 'tt': 't', 'r': 'r', 'l': 'r', 'm': 'm', 'b': 'p', 'pp': 'p', 's': 's', 'ss': 's',
      '': '', 'j': 'j', 'jj': 'j', 'ch': 'ch', 'k': 'kh', 't': 'th', 'p': 'ph', 'h': 'h'}
CK = {'': '', 'k': 'ク', 'n': 'ン', 'ng': 'ン', 't': 'ッ', 'l': 'ル', 'm': 'ム', 'p': 'プ'}


def kana_row(row, vowel):
    """행 문자열에서 a/i/u/e/o 글자를 꺼낸다 (チャ처럼 두 글자짜리 행 포함)."""
    if len(row) == 5: return row['aiueo'.index(vowel)]
    if row.startswith('タ') or row.startswith('ダ'):   # タチトゥテト
        return {'a': row[0], 'i': row[1], 'u': row[2:4], 'e': row[4], 'o': row[5]}[vowel]
    # チャチチュチェチョ
    return {'a': row[0:2], 'i': row[2], 'u': row[3:5], 'e': row[5:7], 'o': row[7:9]}[vowel]


def kana(word):
    out = []
    prev_voiced = False
    for x in pron(word):
        if isinstance(x, str): out.append(x); prev_voiced = False; continue
        ini, v, coda = x
        k = IK[ini]
        base, glide = VK[v]
        rows = ROW[k]
        row = rows[1] if (prev_voiced and len(rows) > 1) else rows[0]
        if glide == 'y':
            if k == '': head = {'a': 'ヤ', 'u': 'ユ', 'o': 'ヨ', 'e': 'イェ'}[base]
            elif k in ('j', 'ch'): head = kana_row(row, base)
            else: head = kana_row(row, 'i') + SMALL_Y[base]
        elif glide == 'w':
            if k == '': head = {'a': 'ワ', 'i': 'ウィ', 'e': 'ウェ', 'o': 'ウォ'}[base]
            else: head = kana_row(row, 'u')[0] + SMALL_W[base]
        else:
            head = kana_row(row, base)
        out.append(head + CK[coda])
        prev_voiced = coda in ('', 'n', 'ng', 'm', 'l')
    return ''.join(out)


if __name__ == '__main__':
    for w in ['종로', '강남', '울릉', '백령', '관악', '해운대', '부평', '의정부', '독립', '신림', '영등포', '제주', '광주', '서귀포', '창원']:
        print(w, rr(w), kana(w))


# ---------- 일본어 가나 → 한글 (외래어 표기법: 어두 무성음은 예사소리, 장음은 적지 않음) ----------
_K = {
    'あ': '아', 'い': '이', 'う': '우', 'え': '에', 'お': '오',
    'か': ('가', '카'), 'き': ('기', '키'), 'く': ('구', '쿠'), 'け': ('게', '케'), 'こ': ('고', '코'),
    'が': '가', 'ぎ': '기', 'ぐ': '구', 'げ': '게', 'ご': '고',
    'さ': '사', 'し': '시', 'す': '스', 'せ': '세', 'そ': '소', 'ざ': '자', 'じ': '지', 'ず': '즈', 'ぜ': '제', 'ぞ': '조',
    'た': ('다', '타'), 'ち': ('지', '치'), 'つ': '쓰', 'て': ('데', '테'), 'と': ('도', '토'),
    'だ': '다', 'ぢ': '지', 'づ': '즈', 'で': '데', 'ど': '도',
    'な': '나', 'に': '니', 'ぬ': '누', 'ね': '네', 'の': '노',
    'は': '하', 'ひ': '히', 'ふ': '후', 'へ': '헤', 'ほ': '호', 'ば': '바', 'び': '비', 'ぶ': '부', 'べ': '베', 'ぼ': '보',
    'ぱ': '파', 'ぴ': '피', 'ぷ': '푸', 'ぺ': '페', 'ぽ': '포',
    'ま': '마', 'み': '미', 'む': '무', 'め': '메', 'も': '모', 'や': '야', 'ゆ': '유', 'よ': '요',
    'ら': '라', 'り': '리', 'る': '루', 'れ': '레', 'ろ': '로', 'わ': '와', 'を': '오', 'ゐ': '이', 'ゑ': '에',
    'ゔ': '부',
}
_Y = {  # 요음 (앞 글자 + ゃゅょ)
    'き': (('갸', '캬'), ('규', '큐'), ('교', '쿄')), 'ぎ': ('갸', '규', '교'), 'し': ('샤', '슈', '쇼'), 'じ': ('자', '주', '조'),
    'ち': (('자', '차'), ('주', '추'), ('조', '초')), 'ぢ': ('자', '주', '조'), 'に': ('냐', '뉴', '뇨'), 'ひ': ('햐', '휴', '효'),
    'び': ('뱌', '뷰', '뵤'), 'ぴ': ('퍄', '퓨', '표'), 'み': ('먀', '뮤', '묘'), 'り': ('랴', '류', '료'),
}
_O_ROW = set('おこごそぞとどのほぼぽもよろをょ')
_U_ROW = set('うくぐすずつづぬふぶぷむゆるゅ')


def _add_final(syl, jong):
    c = ord(syl) - 0xAC00
    if not (0 <= c < 11172) or c % 28: return syl   # 한글이 아니거나 이미 받침이 있으면 그대로
    return chr(ord(syl) + jong)


def kana2hangul(hira):
    """히라가나 → 한글. ん은 ㄴ 받침, っ은 ㅅ 받침."""
    out = []; i = 0; prev = ''
    while i < len(hira):
        ch = hira[i]; nxt = hira[i + 1] if i + 1 < len(hira) else ''
        first = not out
        if ch == 'ん':
            if out: out[-1] = _add_final(out[-1], 4)
            else: out.append('응')
            i += 1; prev = ch; continue
        if ch == 'っ':
            if out: out[-1] = _add_final(out[-1], 19)
            i += 1; prev = ch; continue
        if ch == 'ー': i += 1; continue
        # 장음: o단 뒤 う·お, u단 뒤 う 는 적지 않는다
        if (ch == 'う' and (prev in _O_ROW or prev in _U_ROW)) or (ch == 'お' and prev in _O_ROW):
            i += 1; prev = 'う'; continue
        if nxt in ('ゃ', 'ゅ', 'ょ') and ch in _Y:
            v = _Y[ch]['ゃゅょ'.index(nxt)]
            out.append(v[0 if first else 1] if isinstance(v, tuple) else v)
            prev = nxt; i += 2; continue
        v = _K.get(ch)
        if v is None: out.append(ch); prev = ch; i += 1; continue
        out.append(v[0 if first else 1] if isinstance(v, tuple) else v)
        prev = ch; i += 1
    return ''.join(out)


def hepburn_simple(s):
    """pykakasi 헵번식에서 장음 겹글자를 줄인다 (chuuou → chuo, oosaka → osaka)."""
    import re as _re
    s = s.replace('ou', 'o').replace('uu', 'u').replace('oo', 'o')
    return _re.sub(r'\s+', '', s)
