import { useState } from 'react';
import { formatSignedWon, formatWon, settle } from '../lib/calc';
import { dateOfInstant, formatInstant, formatShortDate } from '../lib/date';
import type { State } from '../lib/types';
import { MoneyInput } from './MoneyInput';
import { WipedNotice } from './WipedNotice';

type Props = {
  state: State;
  wasWiped: boolean;
  onRestoreLink: (payload: string) => void;
  onSave: (next: State) => void;
};

export function SettleScreen({ state, wasWiped, onRestoreLink, onSave }: Props) {
  const [amount, setAmount] = useState(state.balance.amount);
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);

  const result = settle(state, amount);
  const checkedAtDate = dateOfInstant(state.balance.checkedAt);

  function save() {
    const now = new Date();
    onSave({ ...state, balance: { amount, checkedAt: now.toISOString() } });
    setSaved(result.diff);
    setTouched(false);
  }

  return (
    <div className="screen">
      {wasWiped && <WipedNotice onRestoreLink={onRestoreLink} />}

      <section className="card">
        <h2 className="card__title">지금 통장 잔고</h2>
        <p className="muted">
          통장에 찍힌 숫자를 그대로 옮겨 적으세요. 그 사이 쓴 돈은 입력하지 않아도 됩니다.
        </p>

        <label className="field">
          <span className="field__label">잔고</span>
          <MoneyInput
            id="settle-amount"
            value={amount}
            autoFocus
            onChange={(v) => {
              setAmount(v);
              setTouched(true);
              setSaved(null);
            }}
          />
        </label>

        <div className="ledger">
          <div className="ledger__row">
            <span>직전 잔고</span>
            <span>
              {formatWon(state.balance.amount)}
              <em className="muted"> · {formatInstant(state.balance.checkedAt)}</em>
            </span>
          </div>
          <div className="ledger__row">
            <span>그 사이 지나간 예정 지출</span>
            <span>{result.passedTotal === 0 ? '없음' : `− ${formatWon(result.passedTotal)}`}</span>
          </div>
          {result.passed.length > 0 && (
            <ul className="mini-list mini-list--indent">
              {result.passed.map((o, i) => (
                <li key={`${o.date}-${o.fixed.id}-${i}`}>
                  <span>
                    <span className="muted">{formatShortDate(o.date)}</span> {o.fixed.name}
                  </span>
                  <span>−{formatWon(o.fixed.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="ledger__row ledger__row--total">
            <span>예정대로였다면</span>
            <span>{formatWon(result.expected)}</span>
          </div>
        </div>

        {(touched || saved !== null) && (
          <p className={`diff ${result.diff < 0 ? 'is-negative' : result.diff > 0 ? 'is-positive' : ''}`}>
            {result.diff < 0 ? (
              <>
                예정에 없던 지출 <b>{formatSignedWon(result.diff)}</b>
              </>
            ) : result.diff > 0 ? (
              <>
                예정보다 남았습니다 <b>{formatSignedWon(result.diff)}</b>
              </>
            ) : (
              <>예정과 정확히 같습니다</>
            )}
          </p>
        )}

        <button
          type="button"
          className="primary-btn"
          disabled={!touched}
          onClick={save}
        >
          잔고 적기
        </button>

        {saved !== null && !touched && (
          <p className="ok-note">
            잔고를 적었습니다. 지금부터의 한도는 이 숫자에서 다시 계산됩니다.
          </p>
        )}
      </section>

      <section className="card card--quiet">
        <h2 className="card__title">왜 지출을 입력하지 않나요?</h2>
        <p>
          입력의 원자는 지출이 아니라 잔고입니다. 통장 잔고를 옮겨 적는 순간,{' '}
          {formatShortDate(checkedAtDate)} 이후의 모든 변동 지출이 한 번에 정산된 것으로 봅니다.
          달력에는 오늘 이후의 고정 지출만 남습니다.
        </p>
      </section>
    </div>
  );
}
