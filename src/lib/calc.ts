import {
  type ISODate,
  addDays,
  addMonths,
  compareDate,
  dateOfInstant,
  dayInMonth,
  fromISODate,
  toISODate,
} from './date';
import type { Fixed, State } from './types';

export type Occurrence = { date: ISODate; fixed: Fixed };

export type Cycle = { start: ISODate; end: ISODate };

/**
 * (after, through] 구간에 잡히는 고정 지출 발생분.
 * 시작은 열려 있고 끝은 닫혀 있다 — "오늘 이후 ~ d일까지"가 그대로 이 모양이다.
 */
export function occurrences(fixed: Fixed[], after: ISODate, through: ISODate): Occurrence[] {
  if (fixed.length === 0 || compareDate(after, through) >= 0) return [];

  const start = fromISODate(after);
  const end = fromISODate(through);
  const out: Occurrence[] = [];

  let cursor = { year: start.getFullYear(), month0: start.getMonth() };
  const lastMonth = end.getFullYear() * 12 + end.getMonth();

  while (cursor.year * 12 + cursor.month0 <= lastMonth) {
    for (const item of fixed) {
      const date = dayInMonth(cursor.year, cursor.month0, item.day);
      if (compareDate(date, after) > 0 && compareDate(date, through) <= 0) {
        out.push({ date, fixed: item });
      }
    }
    cursor = addMonths(cursor.year, cursor.month0, 1);
  }

  out.sort((a, b) => compareDate(a.date, b.date) || a.fixed.name.localeCompare(b.fixed.name));
  return out;
}

export function sumOccurrences(list: Occurrence[]): number {
  return list.reduce((total, o) => total + o.fixed.amount, 0);
}

/** (after, through] 구간의 예정 지출 합. */
export function scheduledBetween(fixed: Fixed[], after: ISODate, through: ISODate): number {
  return sumOccurrences(occurrences(fixed, after, through));
}

/**
 * 오늘이 속한 주기. 급여일 ~ 다음 급여 전날.
 * 급여일이 말일보다 크면 말일로 당겨진다.
 */
export function cycleOf(payday: number, today: ISODate): Cycle {
  const d = fromISODate(today);
  let year = d.getFullYear();
  let month0 = d.getMonth();

  // 이번 달 급여일이 아직 안 왔으면 주기는 지난달 급여일에 시작한 것이다.
  if (compareDate(today, dayInMonth(year, month0, payday)) < 0) {
    ({ year, month0 } = addMonths(year, month0, -1));
  }

  const start = dayInMonth(year, month0, payday);
  const next = addMonths(year, month0, 1);
  const end = addDays(dayInMonth(next.year, next.month0, payday), -1);
  return { start, end };
}

/** 주기의 마지막 날 다음 날 = 다음 급여일. */
export function nextPayday(cycle: Cycle): ISODate {
  return addDays(cycle.end, 1);
}

/**
 * limit(d) = 현재 잔고 − (오늘 이후 ~ d일까지의 예정 지출 합)
 *
 * "예상 잔고"가 아니라 "이 날까지 쓸 수 있는 한도"다.
 * 오늘 이전은 잔고가 이미 말해주므로 계산에 들어가지 않는다.
 */
export function limitOn(state: State, date: ISODate, today: ISODate): number {
  return state.balance.amount - scheduledBetween(state.fixed, today, date);
}

/** 머리 숫자 — 다음 급여 전날까지 남는 한도. */
export function headlineLimit(state: State, today: ISODate): number {
  return limitOn(state, cycleOf(state.payday, today).end, today);
}

export type Settlement = {
  /** 직전 잔고를 적은 날. */
  since: ISODate;
  /** 그 사이 지나간 예정 지출. */
  passed: Occurrence[];
  passedTotal: number;
  /** 예정대로만 썼다면 남아 있어야 할 금액. */
  expected: number;
  /** 새로 적은 잔고 − expected. 음수면 예정에 없던 지출. */
  diff: number;
};

/**
 * 정산 diff = 새로 적은 잔고 − (직전 잔고 − 그 사이 지나간 예정 지출 합)
 *
 * 과거 지출을 입력하지 않아도 이 한 줄로 변동 지출이 전부 정산된다.
 */
export function settle(state: State, newAmount: number, now: Date = new Date()): Settlement {
  const since = dateOfInstant(state.balance.checkedAt);
  const today = toISODate(now);
  const passed = occurrences(state.fixed, since, today);
  const passedTotal = sumOccurrences(passed);
  const expected = state.balance.amount - passedTotal;
  return { since, passed, passedTotal, expected, diff: newAmount - expected };
}

/** 오늘 이후 ~ 주기 끝까지 남은 예정 지출. */
export function upcomingInCycle(state: State, today: ISODate): Occurrence[] {
  return occurrences(state.fixed, today, cycleOf(state.payday, today).end);
}

export function formatWon(n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}${Math.abs(Math.round(n)).toLocaleString('ko-KR')}원`;
}

/** 부호를 항상 붙여서 보여준다 (정산 diff 표시용). */
export function formatSignedWon(n: number): string {
  const rounded = Math.round(n);
  if (rounded === 0) return '0원';
  const sign = rounded < 0 ? '−' : '+';
  return `${sign}${Math.abs(rounded).toLocaleString('ko-KR')}원`;
}
