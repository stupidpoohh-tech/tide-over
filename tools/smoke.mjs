/**
 * 핵심 흐름 스모크 테스트.
 *
 *   npm run build && npm run smoke
 *
 * 단위 테스트가 못 잡는 것만 본다: 실제로 그려지는지, 눌러서 되는지,
 * CSP에 막히지 않는지, 콘솔이 조용한지. 계산 자체는 src/lib/*.test.ts 담당.
 */
import { launch, reporter, sleep } from './browser.mjs';
import { serve } from './serve.mjs';

const OUT = process.env.OUT_DIR ?? '.';
const server = await serve('dist', 4178);
const BASE = 'http://127.0.0.1:4178/';

const b = await launch({ port: 9231, outDir: OUT });
const { check, finish } = reporter();
const { evaluate, goto, shot, drag, key, errors } = b;

/* ---------- 준비: 네 가지 스케줄을 모두 심는다 ---------- */
await goto(BASE);
const d = await evaluate(`
  (() => {
    const iso = (n) => { const x = new Date(); x.setDate(x.getDate() + n);
      return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); };
    return { one: iso(2), spanStart: iso(3), spanEnd: iso(9) };
  })()
`);
await evaluate(`
  localStorage.setItem('tideover.schema', '4');
  localStorage.setItem('tideover.state', JSON.stringify({
    balance: { amount: 800000, checkedAt: new Date().toISOString() },
    entries: [
      { id:'p', name:'급여', amount:3000000, kind:'income', schedule:{ type:'monthly', day:25 } },
      { id:'o', name:'택시비', amount:5000, kind:'expense', schedule:{ type:'once', date:'${d.one}' } },
      { id:'e', name:'적금', amount:50000, kind:'expense', schedule:{ type:'every', days:7, anchor:'${d.one}' } },
      { id:'s', name:'생활비', amount:100000, kind:'expense', color:'violet',
        schedule:{ type:'span', start:'${d.spanStart}', end:'${d.spanEnd}' } },
    ],
  }));
`);
await goto(BASE);

/* ---------- 달력 ---------- */
check('머리 숫자가 그려진다', (await evaluate(`__text('.headline__amount')`)).includes('원'));
check('빈칸 없이 주 단위로 채워진다', (await evaluate(`__all('.day').length % 7`)) === 0);
check('이웃 달이 흐리게 보인다', (await evaluate(`__all('.day--outside').length`)) > 0);
check('오늘부터 끝점까지 색 띠가 이어진다', (await evaluate(`__all('.day--band').length`)) >= 2);
check(
  '기간 막대는 총액 라벨을 고정으로 쓴다',
  (await evaluate(`__all('.allow__label').map((l) => l.innerText).join(',')`)).includes('생활비 10만'),
);
// 기간 하나만 남긴 상태로 본다. 다른 예정이 섞이면 그것 때문에 한도가 바뀌므로,
// "기간이 매일 깎지 않는다"는 불변식만 따로 떼어 확인해야 한다.
// 급여(매달 25일)도 빼야 한다 — 오늘이 며칠이냐에 따라 기간 한가운데로 들어와
// 한도를 300만 올려버린다. 앱이 맞고 테스트가 틀리는 쪽이라 격리를 더 좁혔다.
await evaluate(`
  window.__rich = localStorage.getItem('tideover.state');
  localStorage.setItem('tideover.state', JSON.stringify({
    balance: { amount: 800000, checkedAt: new Date().toISOString() },
    entries: [
      { id:'s', name:'생활비', amount:100000, kind:'expense', color:'violet',
        schedule:{ type:'span', start:'${d.spanStart}', end:'${d.spanEnd}' } },
    ],
  }));
`);
const rich = await evaluate(`window.__rich`);
await goto(BASE);
const spanLimits = await evaluate(`
  __all('.day')
    .filter((x) => x.querySelector('.allow') && x.querySelector('.day__limit'))
    .map((x) => x.querySelector('.day__limit').innerText)
`);
check(
  '기간 안의 한도는 상수다 (하루 몫이 새지 않는다)',
  spanLimits.length > 1 && new Set(spanLimits).size === 1,
  spanLimits.join(','),
);
await evaluate(`localStorage.setItem('tideover.state', ${JSON.stringify(rich)})`);
await goto(BASE);
check('설명 문구를 두지 않는다', (await evaluate(`!!__q('.legend') || !!__q('.headline__note')`)) === false);
await shot('smoke-calendar.png');

/* ---------- 스와이프로 달 넘기기 ---------- */
const month = await evaluate(`__text('.month-nav h2')`);
const g = await evaluate(`
  (() => { const r = __q('.grid').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width }; })()
`);
await drag(g.x + g.w - 30, g.y + 40, g.x + 30, g.y + 45);
check('왼쪽으로 밀면 다음 달', (await evaluate(`__text('.month-nav h2')`)) !== month);
await drag(g.x + 30, g.y + 40, g.x + g.w - 30, g.y + 45);
check('오른쪽으로 밀면 되돌아온다', (await evaluate(`__text('.month-nav h2')`)) === month);
check(
  '오늘 버튼과 다음 달 버튼이 겹치지 않는다',
  await evaluate(`
    (() => {
      const t = __q('.month-nav__today').getBoundingClientRect();
      const n = __q('.month-nav button[aria-label="다음 달"]').getBoundingClientRect();
      return t.right <= n.left + 0.5;
    })()
  `),
);

/* ---------- 날짜를 누르면 곧바로 추가 팝업 ---------- */
const cellDate = await evaluate(`
  (() => { const c = __futureCell(1); c.click(); return c.getAttribute('aria-label'); })()
`);
await sleep(350);
check('셀을 누르면 곧바로 팝업이 뜬다', await evaluate(`!!__q('.modal .dialog-form')`));
check(
  '팝업이 그 날짜로 열린다',
  cellDate.startsWith(await evaluate(`__text('.modal__badge')`)),
  `${cellDate} / ${await evaluate(`__text('.modal__badge')`)}`,
);
check('반복이 네 가지다', (await evaluate(`__all('.chips .chip').length`)) >= 6);
await evaluate(`__fill('금액', '12000')`);
await evaluate(`__fill('내용', '스모크')`);
await sleep(200);
await evaluate(`__q('.dialog-form button[type=submit]').click()`);
await sleep(400);
check('추가하면 저장된다', await evaluate(`__state().entries.some((e) => e.name === '스모크')`));
check('추가 후 팝업이 닫힌다', (await evaluate(`!!__q('.modal')`)) === false);

// 같은 셀을 다시 열면 방금 넣은 것이 그 안에 보이고, 눌러서 수정으로 넘어간다.
await evaluate(`__futureCell(1).click()`);
await sleep(350);
check('팝업 안에 그 날 내역이 보인다', await evaluate(`!!__byText('.dialog-items__name', '스모크')`));
// 금액을 눌러 그 자리에서 고친다 — 수정 팝업까지 가지 않는다.
await evaluate(`__byText('.dialog-items__amount', '12,000').click()`);
await sleep(250);
check('금액을 누르면 그 자리에서 고친다', await evaluate(`!!__q('.amount-tweak input')`));
await evaluate(`__set(__q('.amount-tweak input'), '9000')`);
await sleep(150);
await evaluate(`__q('.amount-tweak .icon-btn').click()`);
await sleep(350);
check(
  '그 자리 수정이 저장된다',
  (await evaluate(`__state().entries.find((e) => e.name === '스모크')?.amount`)) === 9000,
);
check('금액만 고쳐도 팝업은 열려 있다', await evaluate(`!!__q('.modal .dialog-form')`));

await evaluate(`__byText('.dialog-items__name', '스모크').click()`);
await sleep(350);
check('항목을 누르면 수정 팝업', (await evaluate(`__text('.modal__title')`)).includes('수정'));
await key('Escape');
check('Esc로 닫힌다', (await evaluate(`!!__q('.modal')`)) === false);

/* ---------- 지난 날짜도 고치고 새로 만들 수 있다 ---------- */
const pastISO = await evaluate(`
  (() => {
    const s = __state();
    const past = new Date(); past.setDate(past.getDate() - 3);
    const iso = past.getFullYear()+'-'+String(past.getMonth()+1).padStart(2,'0')+'-'+String(past.getDate()).padStart(2,'0');
    s.entries.push({ id:'past', name:'지난기록', amount:20000, kind:'expense', schedule:{ type:'once', date: iso } });
    localStorage.setItem('tideover.state', JSON.stringify(s));
    return iso;
  })()
`);
await goto(BASE);
await evaluate(`__byText('.day--past:not(.day--outside)', '지난기록').click()`);
await sleep(350);
check('지난 날도 폼이 열린다 (읽기 전용 안내 없음)', await evaluate(`!!__q('.modal .dialog-form')`));
check('지난 날 항목도 보인다', await evaluate(`!!__byText('.dialog-items__name', '지난기록')`));
await evaluate(`__byText('.dialog-items__amount', '20,000').click()`);
await sleep(250);
await evaluate(`__set(__q('.amount-tweak input'), '25000')`);
await sleep(150);
await evaluate(`__q('.amount-tweak .icon-btn').click()`);
await sleep(350);
check(
  '지난 기록의 금액도 고쳐진다',
  (await evaluate(`__state().entries.find((e) => e.name === '지난기록')?.amount`)) === 25000,
);
// 지난 날짜로 새로 만들 수 있다. 다만 한도(오늘 이후만 더한다)는 흔들리지 않아야 한다.
const headBefore = await evaluate(`__text('.headline__amount')`);
check('지난 날 폼의 날짜는 그 날짜다', (await evaluate(`__field('날짜').value`)) === pastISO, pastISO);
await evaluate(`__fill('금액', '30000')`);
await evaluate(`__fill('내용', '지난추가')`);
await sleep(200);
check('지난 날짜여도 추가 버튼이 살아 있다', (await evaluate(`__q('.dialog-form button[type=submit]').disabled`)) === false);
await evaluate(`__q('.dialog-form button[type=submit]').click()`);
await sleep(400);
check('지난 날짜로 새로 만들어진다', await evaluate(`__state().entries.some((e) => e.name === '지난추가')`));
check('지난 날짜를 넣어도 머리 숫자는 그대로다', (await evaluate(`__text('.headline__amount')`)) === headBefore);
check('타이르는 경고문이 없다', (await evaluate(`!!__q('.dialog-warn')`)) === false);

await evaluate(`__byText('.day--past:not(.day--outside)', '지난기록').click()`);
await sleep(350);
await evaluate(`__byText('.dialog-items__name', '지난기록').click()`);
await sleep(350);
check('지난 기록도 수정 팝업이 열린다', (await evaluate(`__text('.modal__title')`)).includes('수정'));
await evaluate(`__byText('.modal button', '삭제').click()`);
await sleep(350);
check(
  '지난 기록을 지울 수 있다',
  (await evaluate(`__state().entries.some((e) => e.name === '지난기록')`)) === false,
);

/* ---------- 머리 카드의 + 와 잔고 편집 ---------- */
await evaluate(`__q('.add-btn').click()`);
await sleep(350);
check('+ 버튼이 추가 팝업을 연다', (await evaluate(`__text('.modal__title')`)).includes('새로 만들기'));
await key('Escape');

await evaluate(`__q('.headline__amount').click()`);
await sleep(350);
check('머리 숫자를 누르면 잔고 편집', (await evaluate(`__text('.ledger')`)).includes('예정대로였다면'));
await evaluate(`__fill('잔고', '700000')`);
await sleep(250);
check('차액이 계산된다', (await evaluate(`__text('.diff')`)).length > 0);
await evaluate(`__byText('.modal button', '저장').click()`);
await sleep(400);
check('잔고가 반영된다', (await evaluate(`__state().balance.amount`)) === 700000);

/* ---------- 백업 왕복 ---------- */
await evaluate(`__byText('.tab', '설정').click()`);
await sleep(300);
check('설정에 항목 나열이 없다', (await evaluate(`!!__q('.entry-cards') || !!__q('.ecard')`)) === false);
check('서비스 더보기 링크가 있다', (await evaluate(`__q('.promo')?.href`)) === 'https://loan-early.vercel.app/');
check(
  '만든 사람 링크가 하단에 있다',
  (await evaluate(`__q('.app-footer a')?.href`)) === 'https://dada-portfolio.stupidpoohh.workers.dev/',
);

await evaluate(`__byText('button', '백업 링크 복사').click()`);
await sleep(400);
const link = await evaluate(`__q('textarea')?.value ?? ''`);
check('백업 링크가 만들어진다', link.includes('#b='));
check('백업 이력이 쿠키에 남는다', await evaluate(`document.cookie.includes('tideover_backup')`));

await evaluate(`localStorage.clear()`);
await goto(BASE);
check('지워지면 안내가 뜬다', (await evaluate(`__text('.card--alert')`)).includes('지워졌'));
await goto(link);
await sleep(400);
check(
  '네 가지 스케줄이 모두 왕복한다',
  await evaluate(`
    (() => {
      const t = __state().entries.map((e) => e.schedule.type);
      return ['once','monthly','every','span'].every((x) => t.includes(x));
    })()
  `),
);
check('기간 색도 함께 왕복한다', (await evaluate(`__state().entries.find((e) => e.name === '생활비')?.color`)) === 'violet');

/* ---------- v1 데이터 마이그레이션 ---------- */
await evaluate(`
  localStorage.setItem('tideover.schema', '1');
  localStorage.setItem('tideover.state', JSON.stringify({
    payday: 25,
    balance: { amount: 1000000, checkedAt: new Date().toISOString() },
    fixed: [{ id: 'old', name: '월세', amount: 600000, day: 28 }],
  }));
`);
await goto(BASE);
check('v1 데이터가 올라온다', await evaluate(`__state().entries.some((e) => e.name === '월세')`));
check('급여일이 급여 입금으로 살아난다', await evaluate(`__state().entries.some((e) => e.name === '급여')`));
check('스키마 버전이 올라간다', (await evaluate(`localStorage.getItem('tideover.schema')`)) === '4');

check('콘솔 에러가 없다', errors.length === 0, errors.join(' | ').slice(0, 300));

b.close();
server.close();
process.exit(finish() ? 0 : 1);
