import { useState } from 'react';
import { type ISODate, fromISODate } from '../lib/date';
import { type Entry, type EntryKind, type Schedule, newId } from '../lib/types';
import { MoneyInput } from './MoneyInput';

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

type Props = {
  /**
   * 달력 셀에서 열렸을 때 그 날짜.
   * 주면 날짜는 이미 정해진 것이므로, 한 번인지 매달인지만 고르게 한다.
   */
  fixedDate?: ISODate;
  defaultKind?: EntryKind;
  onAdd: (entry: Entry) => void;
  onCancel?: () => void;
};

export function EntryForm({ fixedDate, defaultKind = 'expense', onAdd, onCancel }: Props) {
  const [kind, setKind] = useState<EntryKind>(defaultKind);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  // 설정 화면에서 넣는 건 대개 매달 반복이고, 달력 셀에서 넣는 건 그 날 한 번이다.
  const [repeats, setRepeats] = useState(() => !fixedDate);
  const [day, setDay] = useState(() => (fixedDate ? fromISODate(fixedDate).getDate() : 1));
  const [date, setDate] = useState<ISODate>(() => fixedDate ?? '');

  const valid = name.trim().length > 0 && amount > 0 && (repeats || fixedDate || date !== '');

  function submit() {
    if (!valid) return;
    const schedule: Schedule = repeats
      ? { type: 'monthly', day: fixedDate ? fromISODate(fixedDate).getDate() : day }
      : { type: 'once', date: fixedDate ?? date };
    onAdd({ id: newId(), name: name.trim(), amount, kind, schedule });
    setName('');
    setAmount(0);
  }

  return (
    <form
      className="entry-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <KindToggle value={kind} onChange={setKind} />

      <div className="entry-form__main">
        <input
          type="text"
          value={name}
          placeholder={kind === 'income' ? '예: 부수입' : '예: 월세'}
          aria-label="이름"
          onChange={(e) => setName(e.target.value)}
        />
        <MoneyInput value={amount} onChange={setAmount} />
      </div>

      {fixedDate ? (
        <label className="checkbox">
          <input type="checkbox" checked={repeats} onChange={(e) => setRepeats(e.target.checked)} />
          <span>매달 {fromISODate(fixedDate).getDate()}일 반복</span>
        </label>
      ) : (
        <div className="entry-form__schedule">
          <select
            value={repeats ? 'monthly' : 'once'}
            aria-label="반복"
            onChange={(e) => setRepeats(e.target.value === 'monthly')}
          >
            <option value="monthly">매달</option>
            <option value="once">특정 일자</option>
          </select>
          {repeats ? (
            <span className="entry-form__day">
              <input
                type="number"
                min={1}
                max={31}
                inputMode="numeric"
                value={day}
                aria-label="반복일"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isInteger(n) && n >= 1 && n <= 31) setDay(n);
                }}
              />
              <span>일</span>
            </span>
          ) : (
            <input
              type="date"
              value={date}
              aria-label="날짜"
              onChange={(e) => setDate(e.target.value)}
            />
          )}
        </div>
      )}

      <div className="entry-form__actions">
        <button type="submit" className="primary-btn" disabled={!valid}>
          추가
        </button>
        {onCancel && (
          <button type="button" className="ghost-btn" onClick={onCancel}>
            취소
          </button>
        )}
      </div>
    </form>
  );
}
