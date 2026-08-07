/** 매달 반복되는 고정 지출 한 건. */
export type Fixed = {
  id: string;
  name: string;
  amount: number;
  /** 매달 며칠 (1–31). 그 달에 없는 날짜면 말일로 당겨서 잡힌다. */
  day: number;
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
  fixed: Fixed[];
};

export function makeInitialState(payday: number, amount: number, now = new Date()): State {
  return {
    payday,
    balance: { amount, checkedAt: now.toISOString() },
    fixed: [],
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

  if (!Array.isArray(s.fixed)) return false;
  return s.fixed.every((item) => {
    if (typeof item !== 'object' || item === null) return false;
    const f = item as Record<string, unknown>;
    return (
      typeof f.id === 'string' &&
      f.id.length > 0 &&
      typeof f.name === 'string' &&
      typeof f.amount === 'number' &&
      Number.isFinite(f.amount) &&
      isDay(f.day)
    );
  });
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
