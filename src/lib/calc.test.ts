import { describe, expect, it } from 'vitest';
import {
  entriesOn,
  formatSignedWon,
  headlineLimit,
  horizonOf,
  limitOn,
  netBetween,
  occurrences,
  settle,
  upcomingInHorizon,
} from './calc';
import type { Entry, State } from './types';

const out = (id: string, name: string, amount: number, day: number): Entry => ({
  id,
  name,
  amount,
  kind: 'expense',
  schedule: { type: 'monthly', day },
});

const inc = (id: string, name: string, amount: number, day: number): Entry => ({
  id,
  name,
  amount,
  kind: 'income',
  schedule: { type: 'monthly', day },
});

const once = (
  id: string,
  name: string,
  amount: number,
  date: string,
  kind: Entry['kind'] = 'expense',
): Entry => ({ id, name, amount, kind, schedule: { type: 'once', date } });

const every = (
  id: string,
  name: string,
  amount: number,
  days: number,
  anchor: string,
  kind: Entry['kind'] = 'expense',
): Entry => ({ id, name, amount, kind, schedule: { type: 'every', days, anchor } });

const state = (over: Partial<State> = {}): State => ({
  balance: { amount: 1_000_000, checkedAt: '2026-03-10T09:00:00+09:00' },
  entries: [],
  ...over,
});

describe('occurrences — 매달 반복', () => {
  it('시작은 열려 있고 끝은 닫혀 있다', () => {
    const list = occurrences([out('a', '월세', 500_000, 10)], '2026-03-10', '2026-04-10');
    expect(list.map((o) => o.date)).toEqual(['2026-04-10']);
  });

  it('구간이 비어 있으면 아무것도 없다', () => {
    expect(occurrences([out('a', '월세', 1, 10)], '2026-03-10', '2026-03-10')).toEqual([]);
    expect(occurrences([out('a', '월세', 1, 10)], '2026-03-11', '2026-03-10')).toEqual([]);
  });

  it('여러 달에 걸쳐 매달 한 번씩 잡힌다', () => {
    const list = occurrences([out('a', '월세', 500_000, 5)], '2026-01-01', '2026-04-30');
    expect(list.map((o) => o.date)).toEqual([
      '2026-01-05',
      '2026-02-05',
      '2026-03-05',
      '2026-04-05',
    ]);
  });

  it('그 달에 없는 날짜는 말일로 당겨진다', () => {
    const list = occurrences([out('a', '카드', 100_000, 31)], '2026-01-31', '2026-03-31');
    expect(list.map((o) => o.date)).toEqual(['2026-02-28', '2026-03-31']);
  });
});

describe('occurrences — 특정 일자', () => {
  it('그 날짜에 한 번만 잡힌다', () => {
    const entry = once('a', '경조사', 100_000, '2026-03-15');
    expect(occurrences([entry], '2026-03-01', '2026-03-31').map((o) => o.date)).toEqual([
      '2026-03-15',
    ]);
    expect(occurrences([entry], '2026-04-01', '2026-04-30')).toEqual([]);
  });

  it('구간 경계도 (after, through] 규칙을 따른다', () => {
    const entry = once('a', '경조사', 100_000, '2026-03-15');
    expect(occurrences([entry], '2026-03-15', '2026-03-31')).toEqual([]);
    expect(occurrences([entry], '2026-03-14', '2026-03-15')).toHaveLength(1);
  });
});

describe('occurrences — N일마다', () => {
  it('anchor부터 N일 간격으로 잡힌다 (1주 = 7)', () => {
    const list = occurrences([every('a', '적금', 10_000, 7, '2026-03-10')], '2026-03-07', '2026-03-31');
    expect(list.map((o) => o.date)).toEqual(['2026-03-10', '2026-03-17', '2026-03-24', '2026-03-31']);
  });

  it('anchor 이전에는 발생하지 않는다', () => {
    expect(occurrences([every('a', '적금', 1, 7, '2026-03-10')], '2026-03-01', '2026-03-09')).toEqual(
      [],
    );
  });

  it('시작 경계는 열려 있다 — anchor 당일이 after면 다음 발생부터', () => {
    const list = occurrences([every('a', '적금', 1, 7, '2026-03-10')], '2026-03-10', '2026-03-24');
    expect(list.map((o) => o.date)).toEqual(['2026-03-17', '2026-03-24']);
  });

  it('과거 anchor에서도 미래 발생분으로 바로 점프한다 (10일 주기)', () => {
    const list = occurrences([every('a', '적금', 1, 10, '2026-03-03')], '2026-03-20', '2026-04-10');
    expect(list.map((o) => o.date)).toEqual(['2026-03-23', '2026-04-02']);
  });

  it('매일(1일마다)도 된다', () => {
    const list = occurrences([every('a', '커피', 1, 1, '2026-03-01')], '2026-03-01', '2026-03-05');
    expect(list.map((o) => o.date)).toEqual(['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05']);
  });

  it('달을 넘어도 간격이 정확하다', () => {
    const list = occurrences([every('a', '적금', 1, 14, '2026-02-20')], '2026-02-20', '2026-04-01');
    expect(list.map((o) => o.date)).toEqual(['2026-03-06', '2026-03-20']);
  });
});

describe('entriesOn', () => {
  it('그 날 하루치만 뽑는다', () => {
    const entries = [
      out('a', '월세', 600_000, 10),
      once('b', '경조사', 50_000, '2026-03-10'),
      every('c', '적금', 10_000, 7, '2026-03-03'),
    ];
    expect(entriesOn(entries, '2026-03-10')).toHaveLength(3);
    expect(entriesOn(entries, '2026-03-11')).toEqual([]);
  });
});

describe('horizonOf — 주기는 다음 예정 입금 전날까지', () => {
  it('다음 입금 전날이 끝점이다', () => {
    const h = horizonOf([inc('a', '급여', 0, 25)], '2026-03-07');
    expect(h).toEqual({ end: '2026-03-24', nextIncome: '2026-03-25' });
  });

  it('입금 당일에는 다음 달 입금이 기준이다', () => {
    const h = horizonOf([inc('a', '급여', 0, 25)], '2026-03-25');
    expect(h).toEqual({ end: '2026-04-24', nextIncome: '2026-04-25' });
  });

  it('말일보다 큰 날짜는 말일로 당겨진다', () => {
    const h = horizonOf([inc('a', '급여', 0, 31)], '2026-02-01');
    expect(h).toEqual({ end: '2026-02-27', nextIncome: '2026-02-28' });
  });

  it('N일마다 입금도 기준이 된다', () => {
    const h = horizonOf([every('a', '주급', 200_000, 7, '2026-03-10', 'income')], '2026-03-12');
    expect(h).toEqual({ end: '2026-03-16', nextIncome: '2026-03-17' });
  });

  it('여러 입금 중 가장 가까운 것이 기준이다', () => {
    const h = horizonOf(
      [inc('a', '급여', 0, 25), once('b', '용돈', 50_000, '2026-03-15', 'income')],
      '2026-03-07',
    );
    expect(h.nextIncome).toBe('2026-03-15');
  });

  it('예정 입금이 없으면 30일 기준으로 본다', () => {
    expect(horizonOf([], '2026-03-07')).toEqual({ end: '2026-04-06', nextIncome: null });
    expect(horizonOf([out('a', '월세', 1, 10)], '2026-03-07').nextIncome).toBeNull();
  });
});

describe('limitOn', () => {
  const s = state({
    balance: { amount: 1_900_000, checkedAt: '2026-03-07T09:00:00+09:00' },
    entries: [out('a', '월세', 600_000, 10), out('b', '통신비', 55_000, 20), inc('c', '급여', 0, 25)],
  });

  it('오늘까지의 한도는 잔고 그대로다 — 오늘 이전은 잔고가 이미 말해준다', () => {
    expect(limitOn(s, '2026-03-07', '2026-03-07')).toBe(1_900_000);
    expect(limitOn(s, '2026-03-01', '2026-03-07')).toBe(1_900_000);
  });

  it('오늘 이후의 예정 출금만 빠진다', () => {
    expect(limitOn(s, '2026-03-10', '2026-03-07')).toBe(1_300_000);
    expect(limitOn(s, '2026-03-19', '2026-03-07')).toBe(1_300_000);
    expect(limitOn(s, '2026-03-20', '2026-03-07')).toBe(1_245_000);
  });

  it('머리 숫자는 다음 입금 전날까지의 한도다', () => {
    // 급여 매달 25일 → 끝점 3/24. 그 사이 3/10 월세, 3/20 통신비.
    expect(headlineLimit(s, '2026-03-07')).toBe(1_245_000);
  });

  it('N일마다 출금이 한도에 반영된다', () => {
    const s2 = state({
      balance: { amount: 500_000, checkedAt: '2026-03-07T09:00:00+09:00' },
      entries: [every('a', '적금', 50_000, 7, '2026-03-10'), inc('b', '급여', 0, 25)],
    });
    // 3/10, 3/17, 3/24 세 번.
    expect(headlineLimit(s2, '2026-03-07')).toBe(350_000);
  });

  it('예정 입금은 한도를 늘리지만, 다음 급여 자체는 이번 주기에 안 들어간다', () => {
    const s3 = state({
      balance: { amount: 100_000, checkedAt: '2026-03-07T09:00:00+09:00' },
      entries: [inc('a', '급여', 2_000_000, 25), once('b', '용돈', 50_000, '2026-03-10', 'income')],
    });
    // 3/10 용돈 입금이 기준일이 된다 → 끝점 3/9. 용돈은 3/10이라 아직 안 들어감.
    expect(headlineLimit(s3, '2026-03-07')).toBe(100_000);
    // 용돈이 들어온 다음(3/10 이후)의 기준은 3/25 급여 → 3/24까지.
    expect(headlineLimit(s3, '2026-03-10')).toBe(100_000);
  });

  it('한도는 음수가 될 수 있다', () => {
    const tight = state({
      balance: { amount: 100_000, checkedAt: '2026-03-07T09:00:00+09:00' },
      entries: [out('a', '월세', 600_000, 10), inc('b', '급여', 0, 25)],
    });
    expect(headlineLimit(tight, '2026-03-07')).toBe(-500_000);
  });
});

describe('upcomingInHorizon', () => {
  it('오늘 이후 ~ 다음 입금 전날까지만 담는다', () => {
    const s = state({
      entries: [out('a', '월세', 600_000, 10), inc('b', '급여', 0, 25), out('c', '보험', 30_000, 28)],
    });
    // 끝점 3/24 → 3/28 보험은 다음 주기다.
    expect(upcomingInHorizon(s, '2026-03-07').map((o) => o.date)).toEqual(['2026-03-10']);
  });
});

describe('settle', () => {
  it('예정에 없던 지출을 음수 diff로 잡아낸다', () => {
    const s = state({
      balance: { amount: 1_900_000, checkedAt: '2026-03-07T09:00:00+09:00' },
      entries: [out('a', '월세', 600_000, 10)],
    });
    const result = settle(s, 1_176_000, new Date('2026-03-12T21:00:00+09:00'));
    expect(result.passedOut).toBe(600_000);
    expect(result.expected).toBe(1_300_000);
    expect(result.diff).toBe(-124_000);
    expect(formatSignedWon(result.diff)).toBe('−124,000원');
  });

  it('지나간 예정 입금은 예상 잔고를 올린다', () => {
    const s = state({
      balance: { amount: 500_000, checkedAt: '2026-03-07T09:00:00+09:00' },
      entries: [inc('a', '부수입', 200_000, 10)],
    });
    const result = settle(s, 650_000, new Date('2026-03-12T09:00:00+09:00'));
    expect(result.passedIn).toBe(200_000);
    expect(result.expected).toBe(700_000);
    expect(result.diff).toBe(-50_000);
  });

  it('N일마다 항목도 지나간 만큼 정산된다', () => {
    const s = state({
      balance: { amount: 500_000, checkedAt: '2026-03-01T09:00:00+09:00' },
      entries: [every('a', '적금', 50_000, 7, '2026-03-03')],
    });
    // 3/3, 3/10 두 번 지나감.
    const result = settle(s, 400_000, new Date('2026-03-12T09:00:00+09:00'));
    expect(result.passedOut).toBe(100_000);
    expect(result.expected).toBe(400_000);
    expect(result.diff).toBe(0);
  });

  it('같은 날 다시 적으면 그 날짜의 예정은 아직 지나가지 않은 것으로 본다', () => {
    const s = state({
      balance: { amount: 500_000, checkedAt: '2026-03-10T09:00:00+09:00' },
      entries: [out('a', '월세', 100_000, 10)],
    });
    const result = settle(s, 500_000, new Date('2026-03-10T23:00:00+09:00'));
    expect(result.passedOut).toBe(0);
    expect(result.diff).toBe(0);
  });

  it('한 달을 통째로 건너뛰어도 지나간 예정을 모두 센다', () => {
    const s = state({
      balance: { amount: 3_000_000, checkedAt: '2026-01-05T09:00:00+09:00' },
      entries: [out('a', '월세', 600_000, 10)],
    });
    const result = settle(s, 1_000_000, new Date('2026-03-15T09:00:00+09:00'));
    expect(result.passedOut).toBe(1_800_000);
    expect(result.expected).toBe(1_200_000);
    expect(result.diff).toBe(-200_000);
  });
});

describe('구간 규칙의 일관성', () => {
  it('세 스케줄 모두에서 정산과 한도가 같은 규칙을 쓴다 — 이중 차감이 없다', () => {
    const entries = [
      out('a', '월세', 600_000, 10),
      inc('b', '부수입', 200_000, 15),
      once('c', '경조사', 50_000, '2026-03-18'),
      every('d', '적금', 30_000, 7, '2026-03-05'),
    ];
    const passed = netBetween(entries, '2026-03-07', '2026-03-12');
    const remaining = netBetween(entries, '2026-03-12', '2026-04-24');
    expect(passed + remaining).toBe(netBetween(entries, '2026-03-07', '2026-04-24'));
  });

  it('정산 후 다시 계산해도 한도가 어긋나지 않는다', () => {
    const s = state({
      balance: { amount: 1_000_000, checkedAt: '2026-03-07T09:00:00+09:00' },
      entries: [out('a', '월세', 600_000, 10), every('b', '적금', 30_000, 7, '2026-03-05')],
    });
    const before = limitOn(s, '2026-03-24', '2026-03-07');

    // 3/12에 예정대로 정확히 맞아떨어지는 잔고를 적었다.
    // (3/7, 3/12] 사이 지나간 것: 3/10 월세, 3/12 적금(3/5+7일). 3/5분은 구간 밖이다.
    const result = settle(s, 1_000_000 - 600_000 - 30_000, new Date('2026-03-12T09:00:00+09:00'));
    expect(result.diff).toBe(0);
    const after = state({
      ...s,
      balance: { amount: 370_000, checkedAt: '2026-03-12T09:00:00+09:00' },
    });
    expect(limitOn(after, '2026-03-24', '2026-03-12')).toBe(before);
  });
});
