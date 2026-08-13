import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, migrateToCurrent } from './storage';

const v1 = {
  payday: 25,
  balance: { amount: 1_900_000, checkedAt: '2026-03-07T09:00:00.000Z' },
  fixed: [
    { id: 'a', name: '월세', amount: 600_000, day: 10 },
    { id: 'b', name: '통신비', amount: 55_000, day: 20 },
  ],
};

describe('migrateToCurrent', () => {
  it('v1의 fixed[]를 출금 entries[]로 올린다', () => {
    const state = migrateToCurrent(v1, 1);
    expect(state).not.toBeNull();
    expect(state?.entries).toEqual([
      {
        id: 'a',
        name: '월세',
        amount: 600_000,
        kind: 'expense',
        schedule: { type: 'monthly', day: 10 },
      },
      {
        id: 'b',
        name: '통신비',
        amount: 55_000,
        kind: 'expense',
        schedule: { type: 'monthly', day: 20 },
      },
    ]);
    expect(state?.payday).toBe(25);
    expect(state?.balance).toEqual(v1.balance);
  });

  it('고정 지출이 없던 v1 데이터도 올라간다', () => {
    expect(migrateToCurrent({ ...v1, fixed: [] }, 1)?.entries).toEqual([]);
  });

  it('현재 버전 데이터는 그대로 통과한다', () => {
    const current = {
      payday: 1,
      balance: { amount: 0, checkedAt: '2026-03-07T09:00:00.000Z' },
      entries: [
        {
          id: 'x',
          name: '보너스',
          amount: 10,
          kind: 'income',
          schedule: { type: 'once', date: '2026-05-01' },
        },
      ],
    };
    expect(migrateToCurrent(current, SCHEMA_VERSION)).toEqual(current);
  });

  it('모양이 깨진 데이터는 null이다 — 덮어쓰기 전에 걸러야 한다', () => {
    expect(migrateToCurrent({ payday: 99 }, SCHEMA_VERSION)).toBeNull();
    expect(migrateToCurrent(null, SCHEMA_VERSION)).toBeNull();
    expect(migrateToCurrent({ ...v1, fixed: [{ id: 'a' }] }, 1)).toBeNull();
  });

  it('변환 경로가 없는 버전은 null이다', () => {
    expect(migrateToCurrent(v1, 0)).toBeNull();
  });
});
