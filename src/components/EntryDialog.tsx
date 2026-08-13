import { useId, useState } from 'react';
import { type Occurrence, formatWon } from '../lib/calc';
import {
  type ISODate,
  addDays,
  compareDate,
  formatDate,
  fromISODate,
  todayISO,
  toISODate,
} from '../lib/date';
import {
  type Entry,
  type EntryKind,
  type Schedule,
  type SpanColor,
  SPAN_COLORS,
  SPAN_COLOR_LABEL,
  newId,
  spanColorOf,
} from '../lib/types';
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

type Repeat = Schedule['type'];

type Props = {
  day?: DayContext;
  today: ISODate;
  /** 새로 만들 때 날짜 칸의 기본값. */
  defaultDate?: ISODate;
  /** 있으면 수정 모드 — 폼이 이 항목으로 채워진다. */
  initial?: Entry;
  onAdd?: (entry: Entry) => void;
  onUpdate?: (entry: Entry) => void;
  onRemove: (id: string) => void;
  /** 목록의 항목을 눌러 수정으로 넘어갈 때. */
  onEdit?: (entry: Entry) => void;
  onClose: () => void;
};

export function EntryDialog({
  day,
  today,
  defaultDate,
  initial,
  onAdd,
  onUpdate,
  onRemove,
  onEdit,
  onClose,
}: Props) {
  const titleId = useId();

  const [kind, setKind] = useState<EntryKind>(initial?.kind ?? 'expense');
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial?.amount ?? 0);
  const [repeat, setRepeat] = useState<Repeat>(initial?.schedule.type ?? 'once');
  const [everyDays, setEveryDays] = useState(
    initial?.schedule.type === 'every' ? initial.schedule.days : 7,
  );
  const [date, setDate] = useState<ISODate>(() => {
    if (initial) return startDateOf(initial.schedule);
    return defaultDate ?? day?.date ?? addDays(today, 1);
  });
  const [spanEnd, setSpanEnd] = useState<ISODate>(() =>
    initial?.schedule.type === 'span'
      ? initial.schedule.end
      : addDays(defaultDate ?? day?.date ?? today, 7),
  );
  const [color, setColor] = useState<SpanColor>(() =>
    initial ? spanColorOf(initial) : 'rose',
  );

  /** 오늘까지의 날짜는 잔고가 말해주는 구간이라 폼을 열지 않는다. */
  const readOnly = Boolean(day && (day.isPast || day.isToday));

  /**
   * 새로 넣는 한 번짜리만 미래 날짜를 요구한다. 반복·기간은 시작이 과거여도
   * 앞으로의 발생분이 잡히고, 기존 항목 수정은 과거 날짜 그대로 저장할 수 있다.
   */
  const dateTooEarly = !initial && repeat === 'once' && date !== '' && compareDate(date, today) <= 0;
  const spanBroken = repeat === 'span' && (spanEnd === '' || compareDate(date, spanEnd) > 0);
  const canSubmit =
    name.trim().length > 0 && amount > 0 && date !== '' && !dateTooEarly && !spanBroken;

  const dayOfMonth = date === '' ? 1 : fromISODate(date).getDate();

  function submit() {
    if (!canSubmit) return;
    const schedule: Schedule =
      repeat === 'monthly'
        ? { type: 'monthly', day: dayOfMonth }
        : repeat === 'every'
          ? { type: 'every', days: everyDays, anchor: date }
          : repeat === 'span'
            ? { type: 'span', start: date, end: spanEnd }
            : { type: 'once', date };
    const entry: Entry = {
      id: initial?.id ?? newId(),
      name: name.trim(),
      amount,
      kind,
      schedule,
      ...(repeat === 'span' ? { color } : {}),
    };
    if (initial) onUpdate?.(entry);
    else onAdd?.(entry);
    onClose();
  }

  return (
    <Modal titleId={titleId} onClose={onClose}>
      <ModalHeader
        titleId={titleId}
        badge={day ? formatDate(day.date) : '예정'}
        title={readOnly ? '이 날의 예정' : initial ? '수정' : '새로 만들기'}
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
              <button
                type="button"
                className="dialog-items__name"
                onClick={() => onEdit?.(o.entry)}
                disabled={!onEdit}
              >
                {o.entry.name}
                {o.entry.schedule.type === 'monthly' && <em className="tag">매달</em>}
                {o.entry.schedule.type === 'every' && (
                  <em className="tag">{o.entry.schedule.days}일마다</em>
                )}
                {o.entry.schedule.type === 'span' && <em className="tag">기간</em>}
              </button>
              <span className="dialog-items__right">
                <span className={o.entry.kind === 'income' ? 'is-income' : 'is-expense'}>
                  {o.entry.kind === 'income' ? '+' : '−'}
                  {formatWon(o.entry.schedule.type === 'span' ? o.entry.amount : o.amount)}
                  {o.entry.schedule.type === 'span' && <span className="muted"> 기간 전체</span>}
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
            <span className="dialog-row__label">{repeat === 'span' ? '시작' : '날짜'}</span>
            <input
              type="date"
              value={date}
              min={!initial && repeat === 'once' ? addDays(today, 1) : undefined}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>

          <div className="dialog-row">
            <span className="dialog-row__label">반복</span>
            <div className="chips">
              <RepeatChip active={repeat === 'once'} onClick={() => setRepeat('once')}>
                한 번
              </RepeatChip>
              <RepeatChip active={repeat === 'monthly'} onClick={() => setRepeat('monthly')}>
                매달 {dayOfMonth}일
              </RepeatChip>
              <RepeatChip active={repeat === 'every'} onClick={() => setRepeat('every')}>
                {repeat === 'every' ? `${everyDays}일마다` : '며칠마다'}
              </RepeatChip>
              <RepeatChip active={repeat === 'span'} onClick={() => setRepeat('span')}>
                기간
              </RepeatChip>
            </div>
          </div>

          {repeat === 'every' && (
            <div className="dialog-row">
              <span className="dialog-row__label" aria-hidden="true" />
              <span className="every-edit">
                <input
                  type="number"
                  min={1}
                  max={365}
                  inputMode="numeric"
                  aria-label="반복 주기"
                  value={everyDays}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isInteger(n) && n >= 1 && n <= 365) setEveryDays(n);
                  }}
                />
                <span>일마다 · {date || '날짜'}부터</span>
              </span>
            </div>
          )}

          {repeat === 'span' && (
            <>
              <div className="dialog-row">
                <span className="dialog-row__label">끝</span>
                <input
                  type="date"
                  aria-label="기간 끝"
                  value={spanEnd}
                  min={date || undefined}
                  onChange={(e) => setSpanEnd(e.target.value)}
                />
              </div>
              <div className="dialog-row">
                <span className="dialog-row__label">색</span>
                <div className="chips">
                  {SPAN_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`swatch swatch--${c} ${color === c ? 'is-active' : ''}`}
                      aria-pressed={color === c}
                      aria-label={SPAN_COLOR_LABEL[c]}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          <label className="dialog-row">
            <span className="dialog-row__label">내용</span>
            <input
              type="text"
              value={name}
              placeholder={repeat === 'span' ? '예: 생활비' : '내용을 적어보세요…'}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          {dateTooEarly && (
            <p className="dialog-warn">
              오늘까지는 통장 잔고가 말해줍니다. 한 번짜리 예정은 내일 날짜부터 넣을 수 있습니다.
            </p>
          )}

          <div className="modal__actions">
            {initial && (
              <button
                type="button"
                className="ghost-btn ghost-btn--danger modal__delete"
                onClick={() => {
                  onRemove(initial.id);
                  onClose();
                }}
              >
                삭제
              </button>
            )}
            <button type="button" className="ghost-btn" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="solid-btn" disabled={!canSubmit}>
              {initial ? '저장' : '추가'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** 스케줄에서 폼의 날짜 칸에 넣을 기준일. */
function startDateOf(schedule: Schedule): ISODate {
  if (schedule.type === 'once') return schedule.date;
  if (schedule.type === 'every') return schedule.anchor;
  if (schedule.type === 'span') return schedule.start;
  return monthlyToDate(schedule.day);
}

/** 매달 N일의 다음 발생일. */
export function monthlyToDate(day: number): ISODate {
  const today = fromISODate(todayISO());
  const candidate = new Date(today.getFullYear(), today.getMonth(), day);
  if (candidate < today) candidate.setMonth(candidate.getMonth() + 1);
  return toISODate(candidate);
}

function RepeatChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`chip ${active ? 'is-active' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
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
