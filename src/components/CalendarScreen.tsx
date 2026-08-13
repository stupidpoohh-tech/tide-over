import { useMemo, useState } from 'react';
import {
  type Horizon,
  type Occurrence,
  entriesOn,
  formatWon,
  headlineLimit,
  horizonOf,
  limitOn,
  netOf,
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

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

type Props = {
  state: State;
  today: ISODate;
  onSave: (next: State) => void;
  onGoSettle: () => void;
};

export function CalendarScreen({ state, today, onSave, onGoSettle }: Props) {
  const todayDate = fromISODate(today);
  const [month, setMonth] = useState(() => ({
    year: todayDate.getFullYear(),
    month0: todayDate.getMonth(),
  }));
  const [selected, setSelected] = useState<ISODate | null>(null);

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
        <p className={`headline__amount ${headline < 0 ? 'is-negative' : ''}`}>
          {formatWon(headline)}
        </p>
        <p className="headline__sub">이 돈으로 {daysLeft + 1}일 버팁니다</p>

        <dl className="headline__breakdown">
          <div>
            <dt>통장 잔고</dt>
            <dd>
              {formatWon(state.balance.amount)}
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
          <button type="button" className="linkish" onClick={onGoSettle}>
            잔고를 다시 적으면
          </button>{' '}
          그때 한 번에 정산됩니다.
        </p>
      </section>

      <section className="card">
        <header className="month-nav">
          <button
            type="button"
            className="icon-btn"
            aria-label="이전 달"
            onClick={() => setMonth((m) => addMonths(m.year, m.month0, -1))}
          >
            ‹
          </button>
          <h2>
            {month.year}년 {month.month0 + 1}월
          </h2>
          <button
            type="button"
            className="icon-btn"
            aria-label="다음 달"
            onClick={() => setMonth((m) => addMonths(m.year, m.month0, 1))}
          >
            ›
          </button>
          {!viewingThisMonth && (
            <button
              type="button"
              className="ghost-btn month-nav__today"
              onClick={() =>
                setMonth({ year: todayDate.getFullYear(), month0: todayDate.getMonth() })
              }
            >
              오늘
            </button>
          )}
        </header>

        <div className="weekday-row" aria-hidden="true">
          {WEEKDAYS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>

        <div className="grid" role="grid">
          {cells.map((cell, i) =>
            cell === null ? (
              <span key={`blank-${i}`} className="day day--blank" />
            ) : (
              <button
                type="button"
                key={cell.date}
                className={[
                  'day',
                  cell.isPast ? 'day--past' : '',
                  cell.isToday ? 'day--today' : '',
                  cell.isHorizonEnd ? 'day--cycle-end' : '',
                  selected === cell.date ? 'is-selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setSelected((s) => (s === cell.date ? null : cell.date))}
                aria-label={`${formatDate(cell.date)}${
                  cell.isPast ? '' : `, 한도 ${formatWon(cell.limit)}`
                }`}
              >
                <span className="day__num">{fromISODate(cell.date).getDate()}</span>
                {cell.items.length > 0 && (
                  <span className={`day__net ${cell.net >= 0 ? 'is-income' : ''}`}>
                    {cell.net >= 0 ? '+' : '−'}
                    {compact(Math.abs(cell.net))}
                  </span>
                )}
                {!cell.isPast && (
                  <span className={`day__limit ${cell.limit < 0 ? 'is-negative' : ''}`}>
                    {compact(cell.limit)}
                  </span>
                )}
              </button>
            ),
          )}
        </div>

        <p className="legend">
          <span className="legend__item legend__item--today">오늘</span>
          <span className="legend__item legend__item--end">
            {horizon.nextIncome ? '다음 입금 전날' : '30일 뒤'}
          </span>
          <span className="legend__hint">날짜를 누르면 그 날의 예정을 넣을 수 있습니다.</span>
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
    </div>
  );
}

type Cell = {
  date: ISODate;
  limit: number;
  net: number;
  items: Occurrence[];
  isPast: boolean;
  isToday: boolean;
  isHorizonEnd: boolean;
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
    const items = entriesOn(state.entries, date);
    cells.push({
      date,
      limit: limitOn(state, date, today),
      net: netOf(items),
      items,
      isPast: compareDate(date, today) < 0,
      isToday: date === today,
      isHorizonEnd: date === horizon.end,
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
