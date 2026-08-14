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
// 기간만 남긴 상태로 본다. 다른 예정이 섞여 있으면 그것 때문에 한도가 바뀌므로,
// "기간이 매일 깎지 않는다"는 불변식만 따로 떼어 확인해야 한다.
await evaluate(`
  window.__rich = localStorage.getItem('tideover.state');
  localStorage.setItem('tideover.state', JSON.stringify({
    balance: { amount: 800000, checkedAt: new Date().toISOString() },
    entries: [
      { id:'p', name:'급여', amount:3000000, kind:'income', schedule:{ type:'monthly', day:25 } },
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

/* ---------- 날짜를 누르면 아래 내역 리스트 ---------- */
await evaluate(`__futureCell(1).click()`);
await sleep(350);
check('셀을 누르면 팝업이 아니라 아래 카드', (await evaluate(`!!__q('.daylist__head')`)));
check('추가 버튼이 있다', await evaluate(`!!__byText('button', '+ 이 날에 추가')`));

await evaluate(`__byText('button', '+ 이 날에 추가').click()`);
await sleep(300);
check('반복이 네 가지다', (await evaluate(`__all('.chips .chip').length`)) >= 6);
await evaluate(`__fill('금액', '12000')`);
await evaluate(`__fill('내용', '스모크')`);
await sleep(200);
await evaluate(`__q('.dialog-form button[type=submit]').click()`);
await sleep(400);
check('추가하면 저장된다', await evaluate(`__state().entries.some((e) => e.name === '스모크')`));
check('추가 후 팝업이 닫힌다', (await evaluate(`!!__q('.modal')`)) === false);

await evaluate(`__byText('.list--day .list__row', '스모크').click()`);
await sleep(350);
check('항목을 누르면 수정 팝업', (await evaluate(`__text('.modal__title')`)).includes('수정'));
await key('Escape');
check('Esc로 닫힌다', (await evaluate(`!!__q('.modal')`)) === false);

/* ---------- 머리 카드의 + 와 잔고 편집 ---------- */
await evaluate(`__q('.daylist__head .icon-btn').click()`);
await sleep(250);
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
