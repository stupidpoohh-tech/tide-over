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
import { type Entry, type State, signedAmount } from './types';

export type Occurrence = { date: ISODate; entry: Entry };

export type Cycle = { start: ISODate; end: ISODate };

/**
 * (after, through] 구간에 잡히는 예정 입금·출금.
 * 시작은 열려 있고 끝은 닫혀 있다 — "오늘 이후 ~ d일까지"가 그대로 이 모양이다.
 */
export function occurrences(entries: Entry[], after: ISODate, through: ISODate): Occurrence[] {
  if (entries.length === 0 || compareDate(after, through) >= 0) return [];

  const out: Occurrence[] = [];

  for (const entry of entries) {
    if (entry.schedule.type !== 'once') continue;
    const date = entry.schedule.date;
    if (compareDate(date, after) > 0 && compareDate(date, through) <= 0) {
      out.push({ date, entry });
    }
  }

  if (entries.some((e) => e.schedule.type === 'monthly')) {
    const start = fromISODate(after);
    const end = fromISODate(through);
    let cursor = { year: start.getFullYear(), month0: start.getMonth() };
    const lastMonth = end.getFullYear() * 12 + end.getMonth();

    while (cursor.year * 12 + cursor.month0 <= lastMonth) {
      for (const entry of entries) {
        if (entry.schedule.type !== 'monthly') continue;
        const date = dayInMonth(cursor.year, cursor.month0, entry.schedule.day);
        if (compareDate(date, after) > 0 && compareDate(date, through) <= 0) {
          out.push({ date, entry });
        }
      }
      cursor = addMonths(cursor.year, cursor.month0, 1);
    }
  }

  out.sort((a, b) => compareDate(a.date, b.date) || a.entry.name.localeCompare(b.entry.name));
  return out;
}

/** 입금은 더하고 출금은 뺀 순액. */
export function netOf(list: Occurrence[]): number {
  return list.reduce((total, o) => total + signedAmount(o.entry), 0);
}

export function totalIn(list: Occurrence[]): number {
  return list.reduce((t, o) => (o.entry.kind === 'income' ? t + o.entry.amount : t), 0);
}

export function totalOut(list: Occurrence[]): number {
  return list.reduce((t, o) => (o.entry.kind === 'expense' ? t + o.entry.amount : t), 0);
}

/** (after, through] 구간의 순액. */
export function netBetween(entries: Entry[], after: ISODate, through: ISODate): number {
  return netOf(occurrences(entries, after, through));
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
 * limit(d) = 현재 잔고 + (오늘 이후 ~ d일까지의 예정 입금 − 예정 출금)
 *
 * "예상 잔고"가 아니라 "이 날까지 쓸 수 있는 한도"다.
 * 오늘 이전은 잔고가 이미 말해주므로 계산에 들어가지 않는다.
 */
export function limitOn(state: State, date: ISODate, today: ISODate): number {
  return state.balance.amount + netBetween(state.entries, today, date);
}

/** 머리 숫자 — 다음 급여 전날까지 남는 한도. */
export function headlineLimit(state: State, today: ISODate): number {
  return limitOn(state, cycleOf(state.payday, today).end, today);
}

export type Settlement = {
  /** 직전 잔고를 적은 날. */
  since: ISODate;
  /** 그 사이 지나간 예정 입금·출금. */
  passed: Occurrence[];
  passedIn: number;
  passedOut: number;
  /** 예정대로만 움직였다면 남아 있어야 할 금액. */
  expected: number;
  /** 새로 적은 잔고 − expected. 음수면 예정에 없던 지출. */
  diff: number;
};

/**
 * 정산 diff = 새로 적은 잔고 − (직전 잔고 + 그 사이 지나간 예정 입금 − 예정 출금)
 *
 * 과거 지출을 입력하지 않아도 이 한 줄로 변동 지출이 전부 정산된다.
 */
export function settle(state: State, newAmount: number, now: Date = new Date()): Settlement {
  const since = dateOfInstant(state.balance.checkedAt);
  const today = toISODate(now);
  const passed = occurrences(state.entries, since, today);
  const expected = state.balance.amount + netOf(passed);
  return {
    since,
    passed,
    passedIn: totalIn(passed),
    passedOut: totalOut(passed),
    expected,
    diff: newAmount - expected,
  };
}

/** 오늘 이후 ~ 주기 끝까지 남은 예정. */
export function upcomingInCycle(state: State, today: ISODate): Occurrence[] {
  return occurrences(state.entries, today, cycleOf(state.payday, today).end);
}

/** 하루치 (전날, 그날] 구간의 예정. */
export function entriesOn(entries: Entry[], date: ISODate): Occurrence[] {
  return occurrences(entries, addDays(date, -1), date);
}

export function formatWon(n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}${Math.abs(Math.round(n)).toLocaleString('ko-KR')}원`;
}

/** 부호를 항상 붙여서 보여준다 (정산 diff·입금 표시용). */
export function formatSignedWon(n: number): string {
  const rounded = Math.round(n);
  if (rounded === 0) return '0원';
  const sign = rounded < 0 ? '−' : '+';
  return `${sign}${Math.abs(rounded).toLocaleString('ko-KR')}원`;
}
