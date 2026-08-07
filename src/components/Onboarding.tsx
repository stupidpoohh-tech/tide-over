import { useState } from 'react';
import { type State, makeInitialState } from '../lib/types';
import { MoneyInput } from './MoneyInput';
import { WipedNotice } from './WipedNotice';

type Props = {
  wasWiped: boolean;
  onStart: (state: State) => void;
  onRestoreLink: (payload: string) => void;
};

export function Onboarding({ wasWiped, onStart, onRestoreLink }: Props) {
  const [payday, setPayday] = useState(25);
  const [amount, setAmount] = useState(0);

  return (
    <div className="screen">
      {wasWiped && <WipedNotice onRestoreLink={onRestoreLink} />}

      <section className="card">
        <h2 className="card__title">두 가지만 알려주세요</h2>
        <p className="muted">
          지금 통장에 있는 돈과 급여일. 고정 지출은 나중에 설정에서 추가하면 됩니다.
        </p>

        <label className="field">
          <span className="field__label">지금 통장 잔고</span>
          <MoneyInput value={amount} onChange={setAmount} autoFocus />
        </label>

        <label className="field field--inline">
          <span className="field__label">급여일 · 매달</span>
          <input
            type="number"
            min={1}
            max={31}
            inputMode="numeric"
            value={payday}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 1 && n <= 31) setPayday(n);
            }}
          />
          <span className="field__suffix">일</span>
        </label>

        <button
          type="button"
          className="primary-btn"
          disabled={amount <= 0}
          onClick={() => onStart(makeInitialState(payday, amount))}
        >
          시작하기
        </button>
      </section>

      <section className="card card--quiet">
        <h2 className="card__title">이 앱이 하는 일</h2>
        <p>
          과거 지출은 입력하지 않습니다. 통장 잔고를 옮겨 적는 순간 그 사이의 변동 지출이 전부
          정산된 것으로 봅니다. 달력에는 오늘 이후의 고정 지출만 있고, 보여주는 숫자는 예상
          잔고가 아니라 <b>이 날까지 쓸 수 있는 한도</b>입니다.
        </p>
      </section>
    </div>
  );
}
