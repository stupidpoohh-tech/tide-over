import { describe, expect, it } from 'vitest';
import {
  cycleOf,
  formatSignedWon,
  headlineLimit,
  limitOn,
  nextPayday,
  occurrences,
  scheduledBetween,
  settle,
  upcomingInCycle,
} from './calc';
import { dayInMonth } from './date';
import type { Fixed, State } from './types';

const fixed = (id: string, name: string, amount: number, day: number): Fixed => ({
  id,
  name,
  amount,
  day,
});

const state = (over: Partial<State> = {}): State => ({
  payday: 25,
  balance: { amount: 1_000_000, checkedAt: '2026-03-10T09:00:00+09:00' },
  fixed: [],
  ...over,
});

describe('occurrences', () => {
  it('시작은 열려 있고 끝은 닫혀 있다', () => {
    const list = occurrences([fixed('a', '월세', 500_000, 10)], '2026-03-10', '2026-04-10');
    expect(list.map((o) => o.date)).toEqual(['2026-04-10']);
  });

  it('구간이 비어 있으면 아무것도 없다', () => {
    expect(occurrences([fixed('a', '월세', 1, 10)], '2026-03-10', '2026-03-10')).toEqual([]);
    expect(occurrences([fixed('a', '월세', 1, 10)], '2026-03-11', '2026-03-10')).toEqual([]);
  });

  it('여러 달에 걸쳐 매달 한 번씩 잡힌다', () => {
    const list = occurrences([fixed('a', '월세', 500_000, 5)], '2026-01-01', '2026-04-30');
    expect(list.map((o) => o.date)).toEqual(['2026-01-05', '2026-02-05', '2026-03-05', '2026-04-05']);
  });

  it('그 달에 없는 날짜는 말일로 당겨진다', () => {
    const list = occurrences([fixed('a', '카드', 100_000, 31)], '2026-01-31', '2026-03-31');
    expect(list.map((o) => o.date)).toEqual(['2026-02-28', '2026-03-31']);
  });

  it('윤년 2월도 말일로 당겨진다', () => {
    const list = occurrences([fixed('a', '카드', 100_000, 30)], '2028-01-31', '2028-02-29');
    expect(list.map((o) => o.date)).toEqual(['2028-02-29']);
  });

  it('날짜순으로 정렬된다', () => {
    const list = occurrences(
      [fixed('a', '카드', 1, 20), fixed('b', '월세', 2, 5)],
      '2026-03-01',
      '2026-03-31',
    );
    expect(list.map((o) => o.date)).toEqual(['2026-03-05', '2026-03-20']);
  });
});

describe('cycleOf', () => {
  it('급여일 당일이면 그날이 주기의 시작이다', () => {
    expect(cycleOf(25, '2026-03-25')).toEqual({ start: '2026-03-25', end: '2026-04-24' });
  });

  it('급여일 전이면 지난달 급여일에 시작한 주기다', () => {
    expect(cycleOf(25, '2026-03-24')).toEqual({ start: '2026-02-25', end: '2026-03-24' });
  });

  it('급여일이 말일보다 크면 말일로 당겨진다', () => {
    expect(cycleOf(31, '2026-02-28')).toEqual({ start: '2026-02-28', end: '2026-03-30' });
  });

  it('연말을 넘어간다', () => {
    expect(cycleOf(25, '2026-12-31')).toEqual({ start: '2026-12-25', end: '2027-01-24' });
  });

  it('주기 마지막 날 다음이 다음 급여일이다', () => {
    const cycle = cycleOf(25, '2026-03-10');
    expect(nextPayday(cycle)).toBe('2026-03-25');
    expect(cycle.end).toBe(dayInMonth(2026, 2, 24));
  });
});

describe('limitOn', () => {
  const s = state({
    balance: { amount: 1_900_000, checkedAt: '2026-03-07T09:00:00+09:00' },
    fixed: [fixed('a', '월세', 600_000, 10), fixed('b', '통신비', 55_000, 20)],
  });

  it('오늘까지의 한도는 잔고 그대로다 — 오늘 이전은 잔고가 이미 말해준다', () => {
    expect(limitOn(s, '2026-03-07', '2026-03-07')).toBe(1_900_000);
  });

  it('오늘 이전 날짜를 물어도 잔고 그대로다', () => {
    expect(limitOn(s, '2026-03-01', '2026-03-07')).toBe(1_900_000);
  });

  it('오늘 이후의 예정 지출만 빠진다', () => {
    expect(limitOn(s, '2026-03-10', '2026-03-07')).toBe(1_300_000);
    expect(limitOn(s, '2026-03-19', '2026-03-07')).toBe(1_300_000);
    expect(limitOn(s, '2026-03-20', '2026-03-07')).toBe(1_245_000);
  });

  it('오늘 날짜에 잡힌 고정 지출은 이미 잔고에 반영된 것으로 본다', () => {
    expect(limitOn(s, '2026-03-31', '2026-03-10')).toBe(1_845_000);
  });

  it('머리 숫자는 주기 마지막 날의 한도다', () => {
    // 3/7 기준 주기는 2/25~3/24. 그 사이 3/10 월세, 3/20 통신비.
    expect(headlineLimit(s, '2026-03-07')).toBe(1_245_000);
    expect(limitOn(s, cycleOf(s.payday, '2026-03-07').end, '2026-03-07')).toBe(1_245_000);
  });

  it('한도는 음수가 될 수 있다', () => {
    const tight = state({
      balance: { amount: 100_000, checkedAt: '2026-03-07T09:00:00+09:00' },
      fixed: [fixed('a', '월세', 600_000, 10)],
    });
    expect(headlineLimit(tight, '2026-03-07')).toBe(-500_000);
  });
});

describe('upcomingInCycle', () => {
  it('오늘 이후 ~ 주기 끝까지만 담는다', () => {
    const s = state({
      payday: 25,
      balance: { amount: 1_000_000, checkedAt: '2026-03-07T09:00:00+09:00' },
      fixed: [fixed('a', '월세', 600_000, 10), fixed('b', '보험', 30_000, 28)],
    });
    // 주기 2/25~3/24 이므로 3/28 보험은 다음 주기다.
    expect(upcomingInCycle(s, '2026-03-07').map((o) => o.date)).toEqual(['2026-03-10']);
  });
});

describe('settle', () => {
  it('예정에 없던 지출을 음수 diff로 잡아낸다', () => {
    const s = state({
      balance: { amount: 1_900_000, checkedAt: '2026-03-07T09:00:00+09:00' },
      fixed: [fixed('a', '월세', 600_000, 10)],
    });
    // 3/12 현재: 3/10 월세가 지나갔으니 예정대로면 1,300,000 이어야 한다.
    const result = settle(s, 1_176_000, new Date('2026-03-12T21:00:00+09:00'));
    expect(result.passedTotal).toBe(600_000);
    expect(result.expected).toBe(1_300_000);
    expect(result.diff).toBe(-124_000);
    expect(formatSignedWon(result.diff)).toBe('−124,000원');
  });

  it('예정 지출이 아직 안 지나갔으면 잔고 차이가 곧 변동 지출이다', () => {
    const s = state({
      balance: { amount: 500_000, checkedAt: '2026-03-07T09:00:00+09:00' },
      fixed: [fixed('a', '월세', 600_000, 25)],
    });
    const result = settle(s, 470_000, new Date('2026-03-09T10:00:00+09:00'));
    expect(result.passed).toEqual([]);
    expect(result.diff).toBe(-30_000);
  });

  it('같은 날 다시 적으면 그 날짜의 고정 지출은 아직 지나가지 않은 것으로 본다', () => {
    const s = state({
      balance: { amount: 500_000, checkedAt: '2026-03-10T09:00:00+09:00' },
      fixed: [fixed('a', '월세', 100_000, 10)],
    });
    const result = settle(s, 500_000, new Date('2026-03-10T23:00:00+09:00'));
    expect(result.passedTotal).toBe(0);
    expect(result.diff).toBe(0);
  });

  it('예정보다 남으면 양수 diff다', () => {
    const s = state({ balance: { amount: 300_000, checkedAt: '2026-03-01T09:00:00+09:00' } });
    const result = settle(s, 350_000, new Date('2026-03-05T09:00:00+09:00'));
    expect(result.diff).toBe(50_000);
    expect(formatSignedWon(result.diff)).toBe('+50,000원');
  });

  it('한 달을 통째로 건너뛰어도 지나간 고정 지출을 모두 센다', () => {
    const s = state({
      balance: { amount: 3_000_000, checkedAt: '2026-01-05T09:00:00+09:00' },
      fixed: [fixed('a', '월세', 600_000, 10)],
    });
    const result = settle(s, 1_000_000, new Date('2026-03-15T09:00:00+09:00'));
    // 1/10, 2/10, 3/10 세 번.
    expect(result.passedTotal).toBe(1_800_000);
    expect(result.expected).toBe(1_200_000);
    expect(result.diff).toBe(-200_000);
  });
});

describe('scheduledBetween', () => {
  it('정산과 한도가 같은 구간 규칙을 쓴다 — 이중 차감이 생기지 않는다', () => {
    const items = [fixed('a', '월세', 600_000, 10)];
    // (3/7, 3/12] 에서 지나간 것 + (3/12, 4/24] 에서 남은 것 = (3/7, 4/24] 전체
    const passed = scheduledBetween(items, '2026-03-07', '2026-03-12');
    const remaining = scheduledBetween(items, '2026-03-12', '2026-04-24');
    expect(passed + remaining).toBe(scheduledBetween(items, '2026-03-07', '2026-04-24'));
  });
});
