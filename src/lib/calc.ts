import {
  type ISODate,
  addDays,
  addMonths,
  compareDate,
  dateOfInstant,
  dayInMonth,
  diffDays,
  fromISODate,
  toISODate,
} from './date';
import { type Entry, type State, signedAmount } from './types';

export type Occurrence = { date: ISODate; entry: Entry };

/**
 * (after, through] 구간에 잡히는 예정 입금·출금.
 * 시작은 열려 있고 끝은 닫혀 있다 — "오늘 이후 ~ d일까지"가 그대로 이 모양이다.
 */
export function occurrences(entries: Entry[], after: ISODate, through: ISODate): Occurrence[] {
  if (entries.length === 0 || compareDate(after, through) >= 0) return [];

  const out: Occurrence[] = [];

  for (const entry of entries) {
    const s = entry.schedule;

    if (s.type === 'once') {
      if (compareDate(s.date, after) > 0 && compareDate(s.date, through) <= 0) {
        out.push({ date: s.date, entry });
      }
    } else if (s.type === 'every') {
      if (s.days < 1) continue; // 잘못된 데이터로 무한 루프를 돌지 않게
      // anchor + k·days 중 after보다 뒤인 첫 k로 바로 점프한다.
      const gap = diffDays(s.anchor, after);
      const k = gap >= 0 ? Math.floor(gap / s.days) + 1 : 0;
      let date = addDays(s.anchor, k * s.days);
      while (compareDate(date, through) <= 0) {
        out.push({ date, entry });
        date = addDays(date, s.days);
      }
    } else {
      // monthly: 구간에 걸친 달을 돌며 그 달의 지정일(없으면 말일)을 잡는다.
      const start = fromISODate(after);
      const end = fromISODate(through);
      let cursor = { year: start.getFullYear(), month0: start.getMonth() };
      const lastMonth = end.getFullYear() * 12 + end.getMonth();
      while (cursor.year * 12 + cursor.month0 <= lastMonth) {
        const date = dayInMonth(cursor.year, cursor.month0, s.day);
        if (compareDate(date, after) > 0 && compareDate(date, through) <= 0) {
          out.push({ date, entry });
        }
        cursor = addMonths(cursor.year, cursor.month0, 1);
      }
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
 * 머리 숫자의 끝점. 급여일 설정은 없고, 급여도 그냥 예정 입금이다.
 * 다음 예정 입금이 있으면 그 전날까지, 없으면 30일 기준으로 본다.
 */
export type Horizon = { end: ISODate; nextIncome: ISODate | null };

/** 매달 반복이 말일로 당겨져도 최소 한 번은 잡히는 넉넉한 탐색 범위. */
const SEARCH_DAYS = 400;
const FALLBACK_DAYS = 30;

export function horizonOf(entries: Entry[], today: ISODate): Horizon {
  const incomes = entries.filter((e) => e.kind === 'income');
  const next = occurrences(incomes, today, addDays(today, SEARCH_DAYS))[0]?.date;
  if (next) return { end: addDays(next, -1), nextIncome: next };
  return { end: addDays(today, FALLBACK_DAYS), nextIncome: null };
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

/** 머리 숫자 — 다음 입금 전날(또는 30일 뒤)까지 남는 한도. */
export function headlineLimit(state: State, today: ISODate): number {
  return limitOn(state, horizonOf(state.entries, today).end, today);
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

/** 오늘 이후 ~ 머리 숫자 끝점까지 남은 예정. */
export function upcomingInHorizon(state: State, today: ISODate): Occurrence[] {
  return occurrences(state.entries, today, horizonOf(state.entries, today).end);
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
