import type { EntryKind } from '../lib/types';

/** 설정 목록의 좁은 행에서 쓰는 압축형 구분 토글. 대화상자에서는 칩을 쓴다. */
export function KindToggle({
  value,
  onChange,
}: {
  value: EntryKind;
  onChange: (kind: EntryKind) => void;
}) {
  return (
    <div className="kind-toggle" role="group" aria-label="구분">
      <button
        type="button"
        className={`kind-toggle__btn ${value === 'expense' ? 'is-active is-expense' : ''}`}
        aria-pressed={value === 'expense'}
        onClick={() => onChange('expense')}
      >
        출금
      </button>
      <button
        type="button"
        className={`kind-toggle__btn ${value === 'income' ? 'is-active is-income' : ''}`}
        aria-pressed={value === 'income'}
        onClick={() => onChange('income')}
      >
        입금
      </button>
    </div>
  );
}
