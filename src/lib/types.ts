import type { ISODate } from './date';

export type EntryKind = 'income' | 'expense';

/**
 * 반복 규칙. 두 가지뿐이다.
 * - monthly: 매달 며칠. 그 달에 없는 날짜면 말일로 당겨진다.
 * - once: 특정 일자 한 번.
 */
export type Schedule = { type: 'monthly'; day: number } | { type: 'once'; date: ISODate };

/** 예정된 입금 또는 출금 한 건. */
export type Entry = {
  id: string;
  name: string;
  /** 항상 양수. 방향은 kind가 정한다. */
  amount: number;
  kind: EntryKind;
  schedule: Schedule;
};

export type Balance = {
  amount: number;
  /** 잔고를 옮겨 적은 시각. ISO datetime. */
  checkedAt: string;
};

export type State = {
  /** 급여일 (1–31). 말일보다 크면 말일로 당겨진다. */
  payday: number;
  balance: Balance;
  entries: Entry[];
};

/** 입금은 +, 출금은 −. 계산은 전부 이 부호를 통해서만 한다. */
export function signedAmount(entry: Entry): number {
  return entry.kind === 'income' ? entry.amount : -entry.amount;
}

export function makeInitialState(payday: number, amount: number, now = new Date()): State {
  return {
    payday,
    balance: { amount, checkedAt: now.toISOString() },
    entries: [],
  };
}

/** 알 수 없는 값이 State 모양인지 확인한다. 백업 링크·저장소 복구 경로에서 쓴다. */
export function isState(value: unknown): value is State {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;

  if (!isDay(s.payday)) return false;

  const balance = s.balance as Record<string, unknown> | undefined;
  if (typeof balance !== 'object' || balance === null) return false;
  if (typeof balance.amount !== 'number' || !Number.isFinite(balance.amount)) return false;
  if (typeof balance.checkedAt !== 'string' || Number.isNaN(Date.parse(balance.checkedAt))) {
    return false;
  }

  if (!Array.isArray(s.entries)) return false;
  return s.entries.every(isEntry);
}

function isEntry(value: unknown): value is Entry {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    e.id.length > 0 &&
    typeof e.name === 'string' &&
    typeof e.amount === 'number' &&
    Number.isFinite(e.amount) &&
    (e.kind === 'income' || e.kind === 'expense') &&
    isSchedule(e.schedule)
  );
}

function isSchedule(value: unknown): value is Schedule {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  if (s.type === 'monthly') return isDay(s.day);
  if (s.type === 'once') return typeof s.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date);
  return false;
}

function isDay(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 31;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function describeSchedule(schedule: Schedule): string {
  return schedule.type === 'monthly' ? `매달 ${schedule.day}일` : schedule.date;
}
