# 화면 만드는 규칙

잔고 캘린더에서 자리를 잡은 UI/UX 규칙을 다른 프로젝트에 그대로 쓰려고 뽑아낸 것이다.
**이 파일은 도메인 지식이 없다.** 새 저장소에 그냥 복사해도 된다.

여기 적힌 값들은 상상해서 적은 게 아니라 실제로 돌아가는 `src/styles.css`에서 가져왔다.
바꾸고 싶으면 바꿔도 되지만, **바꿀 거면 전부 바꿔라.** 반만 바꾸면 화면이 어긋난다.

---

## 0. 다섯 줄 요약

1. **화면 수를 늘리지 말고 팝업을 써라.** 최상위 화면은 두세 개면 충분하다.
2. **설명 문구를 넣지 마라.** 안내문을 쓰고 싶어지면 그건 UI가 틀렸다는 신호다.
3. **한 번 누르면 목적지다.** 눌러서 나온 화면에서 또 눌러야 하면 한 단계가 남은 것이다.
4. **막을 때 타이르지 마라.** 막을 이유가 있으면 그 길을 UI에서 없애고, 못 없애면 막지 마라.
5. **끝없이 길어지는 목록을 만들지 마라.** 쓸수록 늘어나는 걸 한 화면에 다 나열하면 언젠가 못 쓰게 된다.

---

## 1. 뼈대

```
app          최대 640px, 좌우 16px, 가운데 정렬
 ├ header    sticky. 제목 한 줄 + 탭
 ├ main      screen(세로 flex, gap 14px) 안에 card 들이 쌓인다
 └ footer    가운데 정렬, 만든 사람 한 줄
```

- **폭은 640px에서 끊는다.** 모바일에서 만들고 데스크톱에서 가운데 두는 쪽이,
  데스크톱에서 만들고 모바일로 우겨넣는 것보다 항상 낫다.
- **세로 간격은 카드 사이 `14px` 하나로 통일한다.** 요소마다 다른 여백을 주지 마라.
- 헤더는 `position: sticky` + 배경을 `linear-gradient(var(--bg) 72%, transparent)`로 둔다.
  딱 잘린 선보다 스크롤이 자연스럽게 사라진다.
- 하단 여백에 `env(safe-area-inset-bottom)`을 더한다. 아이폰 홈 인디케이터에 안 가리게.

```css
.app { max-width: 640px; margin: 0 auto; padding: 0 16px calc(48px + env(safe-area-inset-bottom)); }
.screen { display: flex; flex-direction: column; gap: 14px; }
```

---

## 2. 토큰

**색은 이름이 아니라 역할로 짓는다.** `--blue-500`이 아니라 `--accent`다.
그래야 다크모드에서 값만 갈아끼울 수 있다.

```css
:root {
  --bg: #f5f6f8;          /* 화면 바닥 — 카드보다 어둡다 */
  --surface: #ffffff;     /* 카드·입력창 */
  --surface-2: #f0f2f5;   /* 카드 안의 한 단계 더 들어간 면 */
  --text: #16202b;
  --muted: #62707f;       /* 라벨·보조 설명 */
  --line: #dfe4ea;        /* 테두리·구분선 */
  --accent: #1f6feb;
  --accent-soft: #e8f0fe; /* 배지 배경 */
  --danger: #c8342b;
  --ok: #17794b;
  --radius: 14px;
  --shadow: 0 1px 2px rgb(16 24 40 / 6%), 0 6px 20px rgb(16 24 40 / 5%);
  color-scheme: light dark;
}
```

- **바닥이 카드보다 어둡다.** 흰 바닥에 흰 카드를 얹고 그림자로 띄우는 것보다,
  회색 바닥에 흰 카드를 얹는 쪽이 훨씬 정리돼 보인다.
- **그림자는 두 겹으로 아주 옅게.** 진한 그림자 한 겹은 싸구려로 보인다.
- **반경은 하나만 쓴다.** 카드 14px, 버튼 10px, 칩·탭은 999px(알약). 그 외는 만들지 마라.
- 글꼴은 **시스템 글꼴 스택**으로 끝낸다. 웹폰트를 안 불러오면 CSP를 잠글 수 있고,
  첫 화면이 깜빡이지도 않는다.

```css
font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Apple SD Gothic Neo',
  'Noto Sans KR', 'Malgun Gothic', system-ui, sans-serif;
font-size: 16px;   /* 모바일에서 16px 미만이면 입력할 때 화면이 확대된다 */
line-height: 1.55;
```

---

## 3. 요소별 규칙

### 카드

모든 덩어리는 카드다. 카드가 아니면 화면에 두지 마라.

```css
.card { padding: 18px; background: var(--surface); border: 1px solid var(--line);
        border-radius: var(--radius); box-shadow: var(--shadow); }
.card__title { margin: 0 0 8px; font-size: 15px; letter-spacing: -0.01em; }
```

- 제목은 **작게**(15px). 제목이 내용보다 크면 시선이 제목에 묶인다.
- 한글에는 `letter-spacing: -0.01em`을 준다. 기본 자간이 살짝 넓다.

### 머리 숫자 (그 화면에서 제일 중요한 값 하나)

화면마다 **가장 중요한 숫자 하나**를 크게 띄우고, 나머지는 그 밑에 작게 붙인다.

- 크기는 본문의 2.5~3배(예: 40px), `font-weight: 800`, `font-variant-numeric: tabular-nums`.
- **누르면 고칠 수 있는 숫자에는 점선 밑줄을 깐다.** 안내문 대신 이걸로 말한다.

```css
.headline__amount {
  border: 0; background: none; color: inherit; font-family: inherit; cursor: pointer;
  text-decoration: underline; text-decoration-style: dotted;
  text-decoration-thickness: 2px; text-underline-offset: 6px;
  text-decoration-color: var(--line);
}
```

### 탭

알약 안에 든 알약. 세그먼트 컨트롤 모양이 상단 탭보다 가볍다.

```css
.tabs { display: flex; gap: 4px; padding: 3px; background: var(--surface-2); border-radius: 999px; }
.tab  { flex: 1; padding: 8px 0; border: 0; border-radius: 999px; background: transparent;
        color: var(--muted); font-weight: 600; font-size: 14px; }
.tab.is-active { background: var(--surface); color: var(--text); }
```

- **세 개를 넘기지 마라.** 넘으면 그건 탭이 아니라 메뉴가 필요한 앱이다.

### 칩 (선택지)

라디오 버튼·셀렉트 대신 칩을 쓴다. 손가락으로 누르기 쉽고 선택된 게 한눈에 보인다.

```css
.chip { padding: 7px 12px; border: 1px solid var(--line); border-radius: 999px;
        background: var(--surface); color: var(--muted); font-size: 13px; font-weight: 600; }
.chip.is-active { background: var(--text); color: var(--surface); border-color: var(--text); }
```

- **선택된 칩은 색을 반전한다.** 테두리만 굵게 하는 건 안 보인다.
- 선택 상태는 `aria-pressed`로도 알린다.
- **선택지가 5개를 넘으면 칩을 쓰지 마라.** 그때는 목록이나 검색이다.

### 버튼

세 종류면 끝난다. 네 번째를 만들지 마라.

| | 쓰임 | 모양 |
|---|---|---|
| `primary-btn` | 그 화면의 주된 행동, 하나뿐 | 꽉 찬 accent 배경, 폭 100% |
| `ghost-btn` | 취소·부차적 행동 | 투명 배경 + 테두리 |
| `icon-btn` | ×, +, ‹ › 같은 한 글자 | 34×34 정사각, 테두리 |

- 공통: `padding: 11px 18px; border-radius: 10px; font-weight: 600; font: inherit`.
- **`font: inherit`을 빠뜨리지 마라.** 브라우저 기본 글꼴이 튀어나온다.
- 비활성은 `opacity: 0.45` + `cursor: not-allowed`. 숨기지 말고 눌러도 안 되게 둔다.
- **터치 대상은 최소 34px.** 그보다 작으면 손가락으로 못 누른다.

### 팝업

```css
.modal-backdrop { position: fixed; inset: 0; z-index: 20; display: flex;
                  align-items: center; justify-content: center; padding: 16px;
                  background: rgb(6 12 20 / 55%); }
.modal { width: 100%; max-width: 460px; max-height: 90vh; overflow-y: auto;
         padding: 20px; background: var(--surface); border-radius: var(--radius); }
```

반드시 지킬 것:

- **Esc로 닫힌다.** `window`에 keydown을 걸어라.
- **바깥을 눌러도 닫힌다.** 단 `mousedown` 대상만 본다 — 안에서 시작한 드래그가
  바깥에서 끝났다고 닫히면 텍스트 선택하다가 창이 사라진다.
- **열릴 때 첫 입력에 초점**, 닫힐 때 **원래 있던 곳으로 초점 복귀**.
- 열려 있는 동안 `body`의 스크롤을 잠근다.
- `role="dialog" aria-modal="true" aria-labelledby={제목 id}`.
- 제목 줄 왼쪽에 **맥락 배지**(날짜·상태 같은 것)를 알약으로 둔다. 설명 한 문장을 대신한다.

### 폼

```css
.dialog-form { display: flex; flex-direction: column; gap: 12px; }
.dialog-row  { display: grid; grid-template-columns: 52px minmax(0, 1fr);
               align-items: center; gap: 10px; }
.dialog-row__label { color: var(--muted); font-size: 13px; }
```

- **라벨은 위가 아니라 왼쪽 고정폭 열에 둔다.** 세로가 절반으로 줄고 눈이 한 줄로 흐른다.
- 두 번째 열은 반드시 `minmax(0, 1fr)`. `1fr`만 쓰면 긴 내용이 칸을 밀어낸다.
- 입력은 전부 같은 모양: `padding: 11px 12px; border: 1px solid var(--line); border-radius: 10px; font: inherit`.
- 숫자 입력에는 `font-variant-numeric: tabular-nums`, `inputMode="numeric"`.
- **저장 버튼은 조건이 안 맞으면 비활성**으로 두고, 왜 안 되는지는 **그 자리에서 보이게** 한다.
  경고 문단을 아래에 다는 건 마지막 수단이다.

### 목록

```css
.list__row { display: grid; grid-template-columns: minmax(46px, auto) 1fr auto;
             grid-template-areas: 'date name amount' '. after after';
             align-items: center; gap: 8px; width: 100%;
             border: 0; background: none; font: inherit; text-align: left; cursor: pointer; }
```

- 한 줄은 **`<button>`**이다. `<div onClick>`은 키보드로 못 쓴다.
- 열 배치는 `grid-template-areas`로 잡는다. 좁아지면 줄만 바꿔 접히게 된다.
- **줄 하나에 행동 하나**를 기본으로 하고, 자주 고치는 값(금액 같은 것)만 예외로
  그 자리에서 편집하게 한다. 그때도 저장 경로는 원래 것과 같아야 한다.

---

## 4. 상호작용

- **한 번 누르면 목적지.** 셀을 눌렀는데 카드가 열리고 거기서 "추가"를 또 눌러야 하면
  한 단계가 남은 것이다. 바로 팝업을 띄워라.
- **만들고 고치는 입구는 하나.** 두 개가 되면 둘이 서서히 달라진다.
- **되돌릴 수 없는 것에는 확인을 받는다.** 덮어쓰기·삭제·외부로 나가는 것.
  그 외에는 확인창을 띄우지 마라.
- **인라인 편집의 저장 규칙**: Enter로 저장, Esc로 취소(이때 `stopPropagation` —
  안 그러면 팝업까지 닫힌다), 초점이 밖으로 나가면 그대로 저장.
- 좌우 스와이프를 쓸 거면 **55px 이상 + 세로 이동의 1.5배 이상**일 때만 발동시킨다.
  그 아래는 누르려다 손이 흔들린 것이다.
- 스와이프 판정 플래그는 `setTimeout(..., 0)`으로 지운다. `click`은 `pointerup`
  직후 같은 태스크에 오기 때문에, 그 전에 지우면 클릭이 삼켜진다.

---

## 5. 글

- **안내문·툴팁·범례를 넣지 마라.** 넣고 싶어지면 UI를 고쳐라.
- **막을 때 타이르지 마라.** "~하실 수 없습니다", "~는 이런 뜻입니다" 같은 문장은
  전부 지워라. 못 하게 할 거면 그 버튼이 애초에 없어야 한다.
- 라벨은 **명사 한 단어**. "금액", "날짜", "반복". "금액을 입력하세요"가 아니다.
- 버튼은 **동사 한 단어**. "추가", "저장", "삭제".
- 빈 상태는 한 줄로 담백하게. "아직 아무것도 없습니다" 정도. 그림이나 격려 문구는 넣지 마라.

---

## 6. 다크모드

`@media (prefers-color-scheme: dark)` 안에서 **토큰 값만** 갈아끼운다.
컴포넌트 CSS를 다크모드용으로 또 쓰지 마라.

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1720; --surface: #172230; --surface-2: #1e2b3a;
    --text: #e8eef5; --muted: #9aabbd; --line: #2a3849;
    --accent: #6ba4ff; --danger: #ff8177; --ok: #6dd3a1;
    --shadow: 0 1px 2px rgb(0 0 0 / 30%), 0 6px 20px rgb(0 0 0 / 25%);
  }
}
```

- **다크에서는 accent와 danger를 밝게 올린다.** 라이트용 진한 색을 그대로 쓰면 안 읽힌다.
- `color-scheme: light dark`를 `:root`에 선언한다. 스크롤바·기본 입력창이 같이 따라온다.
- 순수한 검정(#000)과 순수한 흰색(#fff)은 배경으로 쓰지 마라. 눈이 아프다.

---

## 7. 접근성 (비용이 거의 없는 것만)

- 글자 없는 버튼에는 **반드시 `aria-label`**. `×`, `+`, `‹`는 스크린리더에 아무 뜻도 없다.
- 초점 표시는 지우지 말고 **`:focus-visible`로 통일**한다.
  ```css
  input:focus-visible, textarea:focus-visible, button:focus-visible {
    outline: 2px solid var(--accent); outline-offset: 1px;
  }
  ```
- 누를 수 있는 것은 `<button>`, 이동하는 것은 `<a>`. 바꿔 쓰지 마라.
- 상태는 `aria-pressed`(칩), `aria-selected`(탭), `role="status"`(토스트)로 알린다.
- 장식용 아이콘·기호에는 `aria-hidden="true"`.

---

## 8. 숫자

돈·수치를 다루는 화면이면 이 세 가지는 반드시.

- **`font-variant-numeric: tabular-nums`** — 숫자가 바뀔 때 폭이 흔들리지 않는다.
- **좁은 칸에서는 줄여 쓴다.** 1,250,000 → `125만`, 3,500 → `3.5천`.
  단, **줄여 쓰는 건 칸이 좁을 때뿐**이고 상세 화면에서는 전체 금액을 보여준다.
- **입력창의 숫자는 오른쪽 정렬 + 입력하는 동안 세 자리 콤마**를 넣어준다.
  단위(원, %)는 입력창 안 오른쪽에 `position: absolute`로 겹쳐 둔다.

---

## 9. 외부 리소스

**아이콘 하나 때문에 CDN을 부르지 마라.** 인라인 SVG로 그리면
`Content-Security-Policy: default-src 'self'`를 그대로 잠글 수 있다.

```jsx
function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
         stroke="currentColor" strokeWidth="1.8">
      <path d="M4 11.5 12 4l8 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

- `stroke="currentColor"`로 두면 색이 저절로 따라온다. 다크모드도 공짜다.
- 선 굵기는 프로젝트 전체에서 하나로(`1.8`). 아이콘마다 다르면 티가 난다.
- 웹폰트도 마찬가지다. 시스템 글꼴로 충분하고, 첫 화면이 안 깜빡인다.

---

## 10. 다 만든 뒤

- **스크린샷을 찍어서 눈으로 봐라.** 잘림·겹침·줄바꿈 깨짐은 코드나 테스트로 안 잡힌다.
- **실제 폭 390px에서 봐라.** 데스크톱 브라우저를 좁히는 것과 다르다.
- **다크모드로 한 번 더 봐라.** 라이트에서만 확인하고 넘어가면 반드시 어딘가 안 읽힌다.
- **가장 긴 내용을 넣어봐라.** 이름 30자, 금액 10억, 항목 20개.
  대부분의 레이아웃 사고는 여기서 난다.

---

## 11. 이미 검토하고 버린 것

같은 제안을 다시 받지 않으려고 적어 둔다.

- **화면을 늘려 기능을 나누는 것** — 탭이 늘수록 어디에 뭐가 있는지 못 찾는다. 팝업을 써라.
- **눌렀을 때 아래에 카드가 펼쳐지고 거기서 한 번 더 누르는 흐름** — 한 번에 목적지로.
- **전체 항목을 나열하는 목록 화면** — 쓸수록 길어져서 결국 못 쓰게 된다. 맥락으로 좁혀라.
- **못 하게 막고 이유를 문구로 설명하기** — 타이르는 투가 된다. 길을 없애거나 열어줘라.
- **밈·캐릭터·랜덤 문구 같은 바이럴 요소** — 처음 한 번 웃기고, 매일 쓰면 거슬린다.
- **아이콘 폰트·CDN 아이콘 라이브러리** — 인라인 SVG 몇 개면 끝난다.
- **컴포넌트 라이브러리(MUI 등) 통째로 얹기** — 위 규칙 전부가 라이브러리 기본값과 싸운다.
  이 정도 화면은 CSS 400줄이면 된다.
