import { useMemo, useState } from 'react';
import {
  type Occurrence,
  cycleOf,
  formatWon,
  headlineLimit,
  limitOn,
  nextPayday,
  occurrences,
  sumOccurrences,
  upcomingInCycle,
} from '../lib/calc';
import {
  type ISODate,
  compareDate,
  daysInMonth,
  dateOfInstant,
  formatDate,
  formatShortDate,
  fromISODate,
  toISODate,
  addMonths,
  diffDays,
} from '../lib/date';
import type { State } from '../lib/types';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

type Props = {
  state: State;
  today: ISODate;
  onGoSettle: () => void;
};

export function CalendarScreen({ state, today, onGoSettle }: Props) {
  const todayDate = fromISODate(today);
  const [month, setMonth] = useState(() => ({
    year: todayDate.getFullYear(),
    month0: todayDate.getMonth(),
  }));
  const [selected, setSelected] = useState<ISODate | null>(null);

  const cycle = useMemo(() => cycleOf(state.payday, today), [state.payday, today]);
  const payday = nextPayday(cycle);
  const headline = useMemo(() => headlineLimit(state, today), [state, today]);
  const upcoming = useMemo(() => upcomingInCycle(state, today), [state, today]);
  const upcomingTotal = sumOccurrences(upcoming);
  const daysLeft = diffDays(today, cycle.end);

  const cells = useMemo(
    () => buildMonth(state, month.year, month.month0, today),
    [state, month, today],
  );

  const viewingThisMonth =
    month.year === todayDate.getFullYear() && month.month0 === todayDate.getMonth();

  const selectedCell = selected ? cells.find((c) => c?.date === selected) : undefined;

  return (
    <div className="screen">
      <section className="headline card">
        <p className="headline__label">
          다음 급여({formatShortDate(payday)}) 전날까지
        </p>
        <p className={`headline__amount ${headline < 0 ? 'is-negative' : ''}`}>
          {formatWon(headline)}
        </p>
        <p className="headline__sub">
          이 돈으로 {daysLeft < 0 ? '오늘까지' : `${daysLeft + 1}일`} 버팁니다
        </p>

        <dl className="headline__breakdown">
          <div>
            <dt>통장 잔고</dt>
            <dd>
              {formatWon(state.balance.amount)}
              <span className="muted"> · {formatShortDate(dateOfInstant(state.balance.checkedAt))} 기록</span>
            </dd>
          </div>
          <div>
            <dt>남은 예정 지출</dt>
            <dd>{upcomingTotal === 0 ? '없음' : `− ${formatWon(upcomingTotal)}`}</dd>
          </div>
        </dl>

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
                  cell.isCycleEnd ? 'day--cycle-end' : '',
                  cell.isPayday ? 'day--payday' : '',
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
                {cell.spend > 0 && <span className="day__spend">−{compact(cell.spend)}</span>}
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
          <span className="legend__item legend__item--end">주기 마지막 날</span>
          <span className="legend__item legend__item--payday">급여일</span>
        </p>

        {selectedCell && (
          <div className="day-detail">
            <h3>{formatDate(selectedCell.date)}</h3>
            {selectedCell.isPast ? (
              <p className="muted">
                오늘 이전입니다. 지난 일은 달력이 아니라 통장 잔고가 말해줍니다.
              </p>
            ) : (
              <>
                <p className="day-detail__limit">
                  이 날까지 쓸 수 있는 한도 <b>{formatWon(selectedCell.limit)}</b>
                </p>
                {selectedCell.items.length > 0 ? (
                  <ul className="mini-list">
                    {selectedCell.items.map((o) => (
                      <li key={o.fixed.id}>
                        <span>{o.fixed.name}</span>
                        <span>−{formatWon(o.fixed.amount)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">이 날 예정된 고정 지출은 없습니다.</p>
                )}
              </>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="card__title">이번 주기에 남은 예정 지출</h2>
        {upcoming.length === 0 ? (
          <p className="muted">
            {state.fixed.length === 0
              ? '아직 고정 지출을 등록하지 않았습니다. 설정에서 추가할 수 있습니다.'
              : '다음 급여일까지 예정된 지출이 없습니다.'}
          </p>
        ) : (
          <ul className="list">
            {upcoming.map((o) => (
              <li key={`${o.date}-${o.fixed.id}`}>
                <span className="list__date">{formatShortDate(o.date)}</span>
                <span className="list__name">{o.fixed.name}</span>
                <span className="list__amount">−{formatWon(o.fixed.amount)}</span>
                <span className="list__after">
                  → {formatWon(limitOn(state, o.date, today))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type Cell = {
  date: ISODate;
  limit: number;
  spend: number;
  items: Occurrence[];
  isPast: boolean;
  isToday: boolean;
  isCycleEnd: boolean;
  isPayday: boolean;
};

function buildMonth(state: State, year: number, month0: number, today: ISODate): (Cell | null)[] {
  const total = daysInMonth(year, month0);
  const leading = new Date(year, month0, 1).getDay();
  const cycle = cycleOf(state.payday, today);
  const payday = nextPayday(cycle);

  const cells: (Cell | null)[] = Array.from({ length: leading }, () => null);

  for (let day = 1; day <= total; day += 1) {
    const date = toISODate(new Date(year, month0, day));
    const items = occurrences(state.fixed, addDayBefore(date), date);
    cells.push({
      date,
      limit: limitOn(state, date, today),
      spend: sumOccurrences(items),
      items,
      isPast: compareDate(date, today) < 0,
      isToday: date === today,
      isCycleEnd: date === cycle.end,
      isPayday: date === payday || date === cycle.start,
    });
  }

  return cells;
}

/** 하루짜리 구간을 (전날, 그날]로 만들기 위한 헬퍼. */
function addDayBefore(date: ISODate): ISODate {
  const d = fromISODate(date);
  d.setDate(d.getDate() - 1);
  return toISODate(d);
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
