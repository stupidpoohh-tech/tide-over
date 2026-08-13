import { useId, useState } from 'react';
import { type Occurrence, formatWon } from '../lib/calc';
import { type ISODate, addDays, compareDate, formatDate, fromISODate } from '../lib/date';
import { type Entry, type EntryKind, newId } from '../lib/types';
import { Modal, ModalHeader } from './Modal';
import { MoneyInput } from './MoneyInput';

/** 달력 셀에서 열렸을 때 그 날의 맥락. 설정에서 열면 없다. */
export type DayContext = {
  date: ISODate;
  limit: number;
  items: Occurrence[];
  isPast: boolean;
  isToday: boolean;
};

type Props = {
  day?: DayContext;
  today: ISODate;
  onAdd: (entry: Entry) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
};

export function EntryDialog({ day, today, onAdd, onRemove, onClose }: Props) {
  const titleId = useId();

  const [kind, setKind] = useState<EntryKind>('expense');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  const [repeats, setRepeats] = useState(false);
  const [date, setDate] = useState<ISODate>(() => day?.date ?? addDays(today, 1));

  /**
   * 예정은 오늘 이후에만 존재한다. 오늘까지는 잔고가 이미 말해주고 있어서,
   * 오늘 이전 날짜에 한 번짜리 예정을 넣으면 아무 데도 반영되지 않는다.
   * 매달 반복은 이번 달 날짜가 지났어도 다음 달에 잡히므로 막지 않는다.
   */
  const dateTooEarly = !repeats && date !== '' && compareDate(date, today) <= 0;
  const canSubmit = name.trim().length > 0 && amount > 0 && date !== '' && !dateTooEarly;
  /** 오늘까지의 날짜는 잔고가 말해주는 구간이라 폼을 열지 않는다. */
  const readOnly = Boolean(day && (day.isPast || day.isToday));

  const repeatDay = date === '' ? 1 : fromISODate(date).getDate();

  function submit() {
    if (!canSubmit) return;
    onAdd({
      id: newId(),
      name: name.trim(),
      amount,
      kind,
      schedule: repeats ? { type: 'monthly', day: repeatDay } : { type: 'once', date },
    });
    onClose();
  }

  return (
    <Modal titleId={titleId} onClose={onClose}>
      <ModalHeader
        titleId={titleId}
        badge={day ? formatDate(day.date) : '예정'}
        title={readOnly ? '이 날의 예정' : '새로 만들기'}
        onClose={onClose}
      />

      {day && !day.isPast && (
        <p className="modal__note">
          이 날까지 쓸 수 있는 한도 <b>{formatWon(day.limit)}</b>
        </p>
      )}

      {day && day.items.length > 0 && (
        <ul className="dialog-items">
          {day.items.map((o) => (
            <li key={o.entry.id}>
              <span className="dialog-items__name">
                {o.entry.name}
                {o.entry.schedule.type === 'monthly' && <em className="tag">매달</em>}
              </span>
              <span className="dialog-items__right">
                <span className={o.entry.kind === 'income' ? 'is-income' : 'is-expense'}>
                  {o.entry.kind === 'income' ? '+' : '−'}
                  {formatWon(o.entry.amount)}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    className="icon-btn icon-btn--small icon-btn--danger"
                    aria-label={`${o.entry.name} 삭제`}
                    onClick={() => onRemove(o.entry.id)}
                  >
                    ×
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {readOnly ? (
        <>
          <p className="muted">
            {day?.isPast
              ? '오늘 이전입니다. 지난 일은 달력이 아니라 통장 잔고가 말해줍니다.'
              : '오늘까지는 통장 잔고가 말해줍니다. 예정은 내일 날짜부터 넣을 수 있습니다.'}
          </p>
          <div className="modal__actions">
            <button type="button" className="ghost-btn" onClick={onClose}>
              닫기
            </button>
          </div>
        </>
      ) : (
          <form
            className="dialog-form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="dialog-row">
              <span className="dialog-row__label">유형</span>
              <div className="chips">
                <KindChip
                  label="예상 입금"
                  tone="income"
                  active={kind === 'income'}
                  onClick={() => setKind('income')}
                />
                <KindChip
                  label="나갈 돈"
                  tone="expense"
                  active={kind === 'expense'}
                  onClick={() => setKind('expense')}
                />
              </div>
            </div>

            <label className="dialog-row">
              <span className="dialog-row__label">금액</span>
              <MoneyInput value={amount} onChange={setAmount} placeholder="금액 입력" />
            </label>

            <label className="dialog-row">
              <span className="dialog-row__label">날짜</span>
              <input
                type="date"
                value={date}
                min={repeats ? undefined : addDays(today, 1)}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>

            <div className="dialog-row">
              <span className="dialog-row__label">반복</span>
              <div className="chips">
                <button
                  type="button"
                  className={`chip ${!repeats ? 'is-active' : ''}`}
                  aria-pressed={!repeats}
                  onClick={() => setRepeats(false)}
                >
                  한 번
                </button>
                <button
                  type="button"
                  className={`chip ${repeats ? 'is-active' : ''}`}
                  aria-pressed={repeats}
                  onClick={() => setRepeats(true)}
                >
                  매달 {repeatDay}일
                </button>
              </div>
            </div>

            <label className="dialog-row">
              <span className="dialog-row__label">내용</span>
              <input
                type="text"
                value={name}
                placeholder="내용을 적어보세요…"
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            {dateTooEarly && (
              <p className="dialog-warn">
                오늘까지는 통장 잔고가 말해줍니다. 한 번짜리 예정은 내일 날짜부터 넣을 수
                있습니다.
              </p>
            )}

            <div className="modal__actions">
              <button type="button" className="ghost-btn" onClick={onClose}>
                취소
              </button>
              <button type="submit" className="solid-btn" disabled={!canSubmit}>
                추가
              </button>
            </div>
          </form>
      )}
    </Modal>
  );
}

function KindChip({
  label,
  tone,
  active,
  onClick,
}: {
  label: string;
  tone: 'income' | 'expense';
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`chip chip--dot chip--${tone} ${active ? 'is-active' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="chip__dot" aria-hidden="true" />
      {label}
    </button>
  );
}
