import { useState } from 'react';
import { backupLink } from '../lib/backup';
import { formatWon } from '../lib/calc';
import { formatInstant } from '../lib/date';
import { copyText } from '../lib/clipboard';
import type { PersistenceStatus } from '../lib/storage';
import { type Fixed, type State, newId } from '../lib/types';
import { MoneyInput } from './MoneyInput';
import { RestoreField, extractPayload } from './WipedNotice';

type Props = {
  state: State;
  persistence: PersistenceStatus;
  canStore: boolean;
  backupTakenAt: string | null;
  onSave: (next: State) => void;
  onBackupTaken: () => void;
  onRestoreLink: (payload: string) => void;
  onReset: () => void;
  onToast: (message: string) => void;
};

export function SettingsScreen({
  state,
  persistence,
  canStore,
  backupTakenAt,
  onSave,
  onBackupTaken,
  onRestoreLink,
  onReset,
  onToast,
}: Props) {
  const [link, setLink] = useState<string | null>(null);
  const [restoreInput, setRestoreInput] = useState('');
  const [confirmingReset, setConfirmingReset] = useState(false);

  function update(patch: Partial<State>) {
    onSave({ ...state, ...patch });
  }

  function updateFixed(id: string, patch: Partial<Fixed>) {
    update({ fixed: state.fixed.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  }

  async function makeBackup() {
    const url = backupLink(state);
    setLink(url);
    onBackupTaken();
    const copied = await copyText(url);
    onToast(
      copied
        ? '백업 링크를 복사했습니다. 안전한 곳에 붙여넣어 두세요.'
        : '복사에 실패했습니다. 아래 링크를 직접 복사해 주세요.',
    );
  }

  return (
    <div className="screen">
      <section className="card">
        <h2 className="card__title">급여일</h2>
        <label className="field field--inline">
          <span className="field__label">매달</span>
          <input
            type="number"
            min={1}
            max={31}
            inputMode="numeric"
            value={state.payday}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 1 && n <= 31) update({ payday: n });
            }}
          />
          <span className="field__suffix">일</span>
        </label>
        <p className="muted">
          주기는 급여일부터 다음 급여 전날까지입니다. 급여일이 그 달 말일보다 크면 말일로
          당겨집니다.
        </p>
      </section>

      <section className="card">
        <h2 className="card__title">고정 지출</h2>
        <p className="muted">
          매달 같은 날 빠져나가는 돈만 넣으세요. 변동 지출은 넣지 않습니다.
        </p>

        {state.fixed.length > 0 && (
          <ul className="fixed-list">
            {state.fixed.map((f) => (
              <li key={f.id} className="fixed-row">
                <input
                  className="fixed-row__name"
                  type="text"
                  value={f.name}
                  placeholder="이름"
                  onChange={(e) => updateFixed(f.id, { name: e.target.value })}
                />
                <div className="fixed-row__amount">
                  <MoneyInput value={f.amount} onChange={(v) => updateFixed(f.id, { amount: v })} />
                </div>
                <div className="fixed-row__day">
                  <input
                    type="number"
                    min={1}
                    max={31}
                    inputMode="numeric"
                    value={f.day}
                    aria-label={`${f.name} 결제일`}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isInteger(n) && n >= 1 && n <= 31) updateFixed(f.id, { day: n });
                    }}
                  />
                  <span>일</span>
                </div>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  aria-label={`${f.name} 삭제`}
                  onClick={() => update({ fixed: state.fixed.filter((x) => x.id !== f.id) })}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <AddFixed onAdd={(f) => update({ fixed: [...state.fixed, f] })} />

        <p className="total-line">
          매달 고정 지출 합계 <b>{formatWon(state.fixed.reduce((s, f) => s + f.amount, 0))}</b>
        </p>
      </section>

      <section className="card">
        <h2 className="card__title">백업</h2>
        <p>
          이 앱은 서버에 아무것도 보내지 않습니다. 데이터는 이 브라우저에만 있고, 브라우저가
          저장소를 비우면 같이 사라집니다. 백업 링크는 <b>상태 전체를 주소에 담은 것</b>이라,
          링크만 있으면 어디서든 그대로 복원됩니다.
        </p>

        <button type="button" className="primary-btn" onClick={() => void makeBackup()}>
          백업 링크 복사
        </button>

        {backupTakenAt && (
          <p className="muted">마지막 백업 링크 생성: {formatInstant(backupTakenAt)}</p>
        )}

        {link && (
          <label className="field">
            <span className="field__label">백업 링크</span>
            <textarea readOnly rows={3} value={link} onFocus={(e) => e.currentTarget.select()} />
          </label>
        )}

        <hr className="rule" />

        <RestoreField
          label="백업 링크로 복원"
          value={restoreInput}
          onChange={setRestoreInput}
          onSubmit={() => {
            const payload = extractPayload(restoreInput);
            if (!payload) {
              onToast('백업 링크를 찾을 수 없습니다.');
              return;
            }
            onRestoreLink(payload);
            setRestoreInput('');
          }}
        />
        <p className="muted">기존 데이터가 있으면 덮어쓰기 전에 한 번 더 물어봅니다.</p>
      </section>

      <section className="card card--quiet">
        <h2 className="card__title">저장소 상태</h2>
        <dl className="status-list">
          <div>
            <dt>저장 위치</dt>
            <dd>{canStore ? '이 브라우저 (localStorage)' : '사용할 수 없음'}</dd>
          </div>
          <div>
            <dt>영속 저장</dt>
            <dd>{describePersistence(persistence)}</dd>
          </div>
        </dl>
        {persistence !== 'persisted' && (
          <p className="muted">
            영속 저장이 켜지지 않아도 앱은 그대로 동작합니다. 다만 저장 공간이 부족하면 브라우저가
            데이터를 비울 수 있으니 백업 링크를 만들어 두세요.
          </p>
        )}
      </section>

      <section className="card card--danger">
        <h2 className="card__title">초기화</h2>
        {confirmingReset ? (
          <>
            <p>이 기기에 저장된 데이터를 지웁니다. 백업 링크가 없으면 되돌릴 수 없습니다.</p>
            <div className="row">
              <button
                type="button"
                className="danger-btn"
                onClick={() => {
                  onReset();
                  setConfirmingReset(false);
                }}
              >
                지우기
              </button>
              <button type="button" className="ghost-btn" onClick={() => setConfirmingReset(false)}>
                취소
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="ghost-btn" onClick={() => setConfirmingReset(true)}>
            모든 데이터 지우기
          </button>
        )}
      </section>
    </div>
  );
}

function AddFixed({ onAdd }: { onAdd: (f: Fixed) => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  const [day, setDay] = useState(1);

  const valid = name.trim().length > 0 && amount > 0;

  return (
    <form
      className="fixed-row fixed-row--add"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onAdd({ id: newId(), name: name.trim(), amount, day });
        setName('');
        setAmount(0);
        setDay(1);
      }}
    >
      <input
        className="fixed-row__name"
        type="text"
        value={name}
        placeholder="예: 월세"
        aria-label="고정 지출 이름"
        onChange={(e) => setName(e.target.value)}
      />
      <div className="fixed-row__amount">
        <MoneyInput value={amount} onChange={setAmount} />
      </div>
      <div className="fixed-row__day">
        <input
          type="number"
          min={1}
          max={31}
          inputMode="numeric"
          value={day}
          aria-label="결제일"
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isInteger(n) && n >= 1 && n <= 31) setDay(n);
          }}
        />
        <span>일</span>
      </div>
      <button type="submit" className="icon-btn" aria-label="고정 지출 추가" disabled={!valid}>
        +
      </button>
    </form>
  );
}

function describePersistence(status: PersistenceStatus): string {
  switch (status) {
    case 'persisted':
      return '켜짐';
    case 'denied':
      return '꺼짐 (브라우저가 거절)';
    case 'unsupported':
      return '이 브라우저는 지원하지 않습니다';
    default:
      return '확인 중';
  }
}
