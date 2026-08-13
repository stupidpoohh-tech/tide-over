import { useMemo, useRef, useState } from 'react';
import {
  type Horizon,
  type Occurrence,
  entriesOn,
  formatWon,
  headlineLimit,
  horizonOf,
  limitOn,
  totalIn,
  totalOut,
  upcomingInHorizon,
} from '../lib/calc';
import {
  type ISODate,
  addMonths,
  compareDate,
  dateOfInstant,
  daysInMonth,
  diffDays,
  formatDate,
  formatShortDate,
  fromISODate,
  toISODate,
} from '../lib/date';
import type { Entry, State } from '../lib/types';
import { EntryDialog } from './EntryDialog';
import { SettleDialog } from './SettleDialog';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 이 정도는 밀어야 달을 넘긴다. 셀을 누르려다 손이 흔들린 것과 구분해야 한다. */
const SWIPE_DISTANCE = 55;

type Props = {
  state: State;
  today: ISODate;
  onSave: (next: State) => void;
};

export function CalendarScreen({ state, today, onSave }: Props) {
  const todayDate = fromISODate(today);
  const [month, setMonth] = useState(() => ({
    year: todayDate.getFullYear(),
    month0: todayDate.getMonth(),
  }));
  const [selected, setSelected] = useState<ISODate | null>(null);
  const [editingBalance, setEditingBalance] = useState(false);

  const horizon = useMemo(() => horizonOf(state.entries, today), [state.entries, today]);
  const headline = useMemo(() => headlineLimit(state, today), [state, today]);
  const upcoming = useMemo(() => upcomingInHorizon(state, today), [state, today]);
  const upcomingIn = totalIn(upcoming);
  const upcomingOut = totalOut(upcoming);
  const daysLeft = diffDays(today, horizon.end);

  const cells = useMemo(
    () => buildMonth(state, month.year, month.month0, today, horizon),
    [state, month, today, horizon],
  );

  const viewingThisMonth =
    month.year === todayDate.getFullYear() && month.month0 === todayDate.getMonth();

  const selectedCell = selected ? cells.find((c) => c?.date === selected) : undefined;

  const step = (n: number) => setMonth((m) => addMonths(m.year, m.month0, n));
  const swipe = useSwipe(step);

  function addEntry(entry: Entry) {
    onSave({ ...state, entries: [...state.entries, entry] });
  }

  function removeEntry(id: string) {
    onSave({ ...state, entries: state.entries.filter((e) => e.id !== id) });
  }

  return (
    <div className="screen">
      <section className="headline card">
        <p className="headline__label">
          {horizon.nextIncome
            ? `다음 입금(${formatShortDate(horizon.nextIncome)}) 전날까지`
            : '앞으로 30일'}
        </p>
        <button
          type="button"
          className={`headline__amount ${headline < 0 ? 'is-negative' : ''}`}
          onClick={() => setEditingBalance(true)}
          aria-label="통장 잔고 다시 적기"
        >
          {formatWon(headline)}
        </button>
        <p className="headline__sub">이 돈으로 {daysLeft + 1}일 버팁니다</p>

        <dl className="headline__breakdown">
          <div>
            <dt>통장 잔고</dt>
            <dd>
              <button type="button" className="editable" onClick={() => setEditingBalance(true)}>
                {formatWon(state.balance.amount)}
              </button>
              <span className="muted">
                {' '}
                · {formatShortDate(dateOfInstant(state.balance.checkedAt))} 기록
              </span>
            </dd>
          </div>
          {upcomingIn > 0 && (
            <div>
              <dt>남은 예정 입금</dt>
              <dd className="is-income">+ {formatWon(upcomingIn)}</dd>
            </div>
          )}
          <div>
            <dt>남은 예정 출금</dt>
            <dd>{upcomingOut === 0 ? '없음' : `− ${formatWon(upcomingOut)}`}</dd>
          </div>
        </dl>

        {!horizon.nextIncome && (
          <p className="headline__note">
            예정 입금이 없어 30일 기준으로 보여줍니다. 급여를 예정 입금으로 넣으면 "다음
            입금까지"로 계산됩니다.
          </p>
        )}

        <p className="headline__note">
          이건 예상 잔고가 아니라 <b>쓸 수 있는 한도</b>입니다. 변동 지출은 넣지 않습니다 —{' '}
          <button type="button" className="linkish" onClick={() => setEditingBalance(true)}>
            잔고를 다시 적으면
          </button>{' '}
          그때 한 번에 정산됩니다.
        </p>
      </section>

      <section className="card">
        <header className="month-nav">
          <button type="button" className="icon-btn" aria-label="이전 달" onClick={() => step(-1)}>
            ‹
          </button>
          <h2>
            {month.year}년 {month.month0 + 1}월
          </h2>
          {/* 자리를 늘 차지하게 두어 제목이 흔들리지도, 다음 달 버튼과 겹치지도 않는다. */}
          <button
            type="button"
            className="ghost-btn month-nav__today"
            aria-hidden={viewingThisMonth}
            tabIndex={viewingThisMonth ? -1 : 0}
            style={viewingThisMonth ? { visibility: 'hidden' } : undefined}
            onClick={() => setMonth({ year: todayDate.getFullYear(), month0: todayDate.getMonth() })}
          >
            오늘
          </button>
          <button type="button" className="icon-btn" aria-label="다음 달" onClick={() => step(1)}>
            ›
          </button>
        </header>

        <div className="weekday-row" aria-hidden="true">
          {WEEKDAYS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>

        <div className="grid" role="grid" {...swipe}>
          {cells.map((cell, i) => {
            if (cell === null) return <span key={`blank-${i}`} className="day day--blank" />;
            const col = i % 7;
            const bandStart = cell.inBand && (col === 0 || !cells[i - 1]?.inBand);
            const bandEnd = cell.inBand && (col === 6 || !cells[i + 1]?.inBand);
            return (
              <button
                type="button"
                key={cell.date}
                className={[
                  'day',
                  cell.isPast ? 'day--past' : '',
                  cell.isToday ? 'day--today' : '',
                  cell.inBand ? 'day--band' : '',
                  bandStart ? 'day--band-start' : '',
                  bandEnd ? 'day--band-end' : '',
                  selected === cell.date ? 'is-selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  if (swipe.moved()) return; // 밀어서 달을 넘기는 중이었다
                  setSelected((s) => (s === cell.date ? null : cell.date));
                }}
                aria-label={`${formatDate(cell.date)}${
                  cell.isPast ? '' : `, 한도 ${formatWon(cell.limit)}`
                }`}
              >
                <span className="day__num">{fromISODate(cell.date).getDate()}</span>
                {cell.items.map((o) => (
                  <span
                    key={o.entry.id}
                    className={`day__item ${o.entry.kind === 'income' ? 'is-income' : ''}`}
                  >
                    <span className="day__item-name">{o.entry.name}</span>
                    <span className="day__item-amt">
                      {o.entry.kind === 'income' ? '+' : '−'}
                      {compact(o.entry.amount)}
                    </span>
                  </span>
                ))}
                {!cell.isPast && (
                  <span className={`day__limit ${cell.limit < 0 ? 'is-negative' : ''}`}>
                    {compact(cell.limit)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="legend">
          {horizon.nextIncome
            ? `색칠된 구간이 오늘부터 다음 입금(${formatShortDate(horizon.nextIncome)}) 전날까지입니다.`
            : '색칠된 구간이 오늘부터 30일 뒤까지입니다.'}
          {' 날짜를 누르면 그 날의 예정을 넣을 수 있고, 좌우로 밀면 달이 넘어갑니다.'}
        </p>
      </section>

      <section className="card">
        <h2 className="card__title">
          {horizon.nextIncome ? '다음 입금 전날까지 남은 예정' : '앞으로 30일 예정'}
        </h2>
        {upcoming.length === 0 ? (
          <p className="muted">
            {state.entries.length === 0
              ? '아직 예정된 입금·출금이 없습니다. 달력에서 날짜를 누르거나 설정에서 추가하세요.'
              : '이 구간에 예정된 입금·출금이 없습니다.'}
          </p>
        ) : (
          <ul className="list">
            {upcoming.map((o) => (
              <li key={`${o.date}-${o.entry.id}`}>
                <span className="list__date">{formatShortDate(o.date)}</span>
                <span className="list__name">{o.entry.name}</span>
                <span className={`list__amount ${o.entry.kind === 'income' ? 'is-income' : ''}`}>
                  {o.entry.kind === 'income' ? '+' : '−'}
                  {formatWon(o.entry.amount)}
                </span>
                <span className="list__after">→ {formatWon(limitOn(state, o.date, today))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedCell && (
        <EntryDialog
          day={{
            date: selectedCell.date,
            limit: selectedCell.limit,
            items: selectedCell.items,
            isPast: selectedCell.isPast,
            isToday: selectedCell.isToday,
          }}
          today={today}
          onAdd={addEntry}
          onRemove={removeEntry}
          onClose={() => setSelected(null)}
        />
      )}

      {editingBalance && (
        <SettleDialog state={state} onSave={onSave} onClose={() => setEditingBalance(false)} />
      )}
    </div>
  );
}

/** 좌우로 미는 동작을 달 이동으로 바꾼다. 세로 스크롤은 그대로 둔다. */
function useSwipe(step: (n: number) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY };
      moved.current = false;
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!start.current) return;
      if (Math.abs(e.clientX - start.current.x) > 12) moved.current = true;
    },
    onPointerUp: (e: React.PointerEvent) => {
      const from = start.current;
      start.current = null;
      if (!from) return;
      const dx = e.clientX - from.x;
      const dy = e.clientY - from.y;
      // 가로로 충분히, 그리고 세로보다 뚜렷하게 움직였을 때만 넘긴다.
      if (Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) {
        step(dx < 0 ? 1 : -1);
      }
      // click은 pointerup 직후 같은 태스크에서 온다. 그 뒤에 지워야
      // 밀린 표시가 남아서 다음 키보드 조작까지 삼키는 일이 없다.
      setTimeout(() => {
        moved.current = false;
      }, 0);
    },
    onPointerCancel: () => {
      start.current = null;
      moved.current = false;
    },
    moved: () => moved.current,
  };
}

type Cell = {
  date: ISODate;
  limit: number;
  items: Occurrence[];
  isPast: boolean;
  isToday: boolean;
  /** 오늘부터 머리 숫자 끝점까지 — 달력에서 색으로 이어 보여주는 구간. */
  inBand: boolean;
};

function buildMonth(
  state: State,
  year: number,
  month0: number,
  today: ISODate,
  horizon: Horizon,
): (Cell | null)[] {
  const total = daysInMonth(year, month0);
  const leading = new Date(year, month0, 1).getDay();

  const cells: (Cell | null)[] = Array.from({ length: leading }, () => null);

  for (let day = 1; day <= total; day += 1) {
    const date = toISODate(new Date(year, month0, day));
    cells.push({
      date,
      limit: limitOn(state, date, today),
      items: entriesOn(state.entries, date),
      isPast: compareDate(date, today) < 0,
      isToday: date === today,
      inBand: compareDate(date, today) >= 0 && compareDate(date, horizon.end) <= 0,
    });
  }

  return cells;
}

/** 달력 칸은 좁아서 만 단위로 줄여 쓴다. */
function compact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 10_000_000) return `${sign}${(abs / 10_000).toFixed(0)}만`;
  if (abs >= 10_000) return `${sign}${trim(abs / 10_000)}만`;
  if (abs >= 1_000) return `${sign}${trim(abs / 1_000)}천`;
  return `${sign}${abs}`;
}

function trim(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '');
}
