import { useState } from 'react';
import { type Entry, type State, makeInitialState, newId } from '../lib/types';
import { MoneyInput } from './MoneyInput';
import { WipedNotice } from './WipedNotice';

type Props = {
  wasWiped: boolean;
  onStart: (state: State) => void;
  onRestoreLink: (payload: string) => void;
};

export function Onboarding({ wasWiped, onStart, onRestoreLink }: Props) {
  const [amount, setAmount] = useState(0);
  const [payday, setPayday] = useState(25);
  const [salary, setSalary] = useState(0);

  function start() {
    /**
     * 급여일은 별도 설정이 아니라 '급여'라는 예정 입금으로 저장된다.
     * 금액을 비워두면 0원 — 주기 계산에는 영향 없이 기준일 역할만 한다.
     */
    const entries: Entry[] = [
      {
        id: newId(),
        name: '급여',
        amount: salary,
        kind: 'income',
        schedule: { type: 'monthly', day: payday },
      },
    ];
    onStart(makeInitialState(amount, entries));
  }

  return (
    <div className="screen">
      {wasWiped && <WipedNotice onRestoreLink={onRestoreLink} />}

      <section className="card">
        <h2 className="card__title">두 가지만 알려주세요</h2>
        <p className="muted">
          지금 통장에 있는 돈과 급여일. 나머지 예정 지출·수입은 나중에 달력이나 설정에서 추가하면
          됩니다.
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

        <label className="field">
          <span className="field__label">월급 (선택 — 나중에 설정에서 넣어도 됩니다)</span>
          <MoneyInput value={salary} onChange={setSalary} />
        </label>

        <button type="button" className="primary-btn" disabled={amount <= 0} onClick={start}>
          시작하기
        </button>
        <p className="muted">
          급여일은 '급여'라는 예정 입금으로 저장됩니다. 머리 숫자는 다음 입금 전날까지로
          계산됩니다.
        </p>
      </section>

      <section className="card card--quiet">
        <h2 className="card__title">이 앱이 하는 일</h2>
        <p>
          과거 지출은 입력하지 않습니다. 통장 잔고를 옮겨 적는 순간 그 사이의 변동 지출이 전부
          정산된 것으로 봅니다. 달력에는 오늘 이후의 예정 입금·출금만 있고, 보여주는 숫자는 예상
          잔고가 아니라 <b>이 날까지 쓸 수 있는 한도</b>입니다.
        </p>
      </section>
    </div>
  );
}
