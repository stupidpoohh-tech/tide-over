import { useMemo, useState } from 'react';
import { backupLink } from '../lib/backup';
import { formatWon, occurrences } from '../lib/calc';
import { type ISODate, addDays, compareDate, formatDate, formatInstant, todayISO } from '../lib/date';
import { copyText } from '../lib/clipboard';
import type { PersistenceStatus } from '../lib/storage';
import { type Entry, type State, describeSchedule, signedAmount } from '../lib/types';
import { EntryDialog } from './EntryDialog';
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
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);

  const today = todayISO();

  function update(patch: Partial<State>) {
    onSave({ ...state, ...patch });
  }

  /** 다음 발생일로 묶는다. 발생이 끝난 항목은 맨 아래 "지난 항목"으로. */
  const groups = useMemo(() => {
    const horizonEnd = addDays(today, 400);
    const map = new Map<string, { date: ISODate | null; items: Entry[] }>();
    for (const entry of state.entries) {
      const next = occurrences([entry], addDays(today, -1), horizonEnd)[0]?.date ?? null;
      const key = next ?? 'past';
      if (!map.has(key)) map.set(key, { date: next, items: [] });
      map.get(key)?.items.push(entry);
    }
    return [...map.values()].sort((a, b) => {
      if (a.date === null) return 1;
      if (b.date === null) return -1;
      return compareDate(a.date, b.date);
    });
  }, [state.entries, today]);

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

  const monthlyNet = state.entries
    .filter((e) => e.schedule.type === 'monthly')
    .reduce((sum, e) => sum + signedAmount(e), 0);

  return (
    <div className="screen">
      <section className="card">
        <h2 className="card__title">예정 수입·지출</h2>
        <p className="muted">
          급여도 여기서 예정 입금으로 관리합니다 — 머리 숫자는 다음 예정 입금 전날까지로
          계산됩니다. 카드를 누르면 수정할 수 있습니다.
        </p>

        {state.entries.length === 0 ? (
          <p className="muted">아직 예정된 입금·출금이 없습니다.</p>
        ) : (
          <div className="entry-cards">
            {groups.map((g) => (
              <div key={g.date ?? 'past'} className="egroup">
                <h3 className="egroup__date">{g.date ? formatDate(g.date) : '지난 항목'}</h3>
                {g.items.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className="ecard"
                    onClick={() => setEditing(entry)}
                  >
                    <span
                      className={`ecard__dot ${entry.kind === 'income' ? 'is-income' : 'is-expense'}`}
                      aria-hidden="true"
                    />
                    <span className="ecard__main">
                      <b>{entry.name || '(이름 없음)'}</b>
                      <span className="muted">{describeSchedule(entry.schedule)}</span>
                    </span>
                    <span className={`ecard__amt ${entry.kind === 'income' ? 'is-income' : ''}`}>
                      {entry.kind === 'income' ? '+' : '−'}
                      {formatWon(entry.amount)}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          className="ghost-btn ghost-btn--block entry-add"
          onClick={() => setAdding(true)}
        >
          + 예정 추가
        </button>

        <p className="total-line">
          <span>매달 반복분 합계</span>
          <b className={monthlyNet >= 0 ? 'is-income' : ''}>
            {monthlyNet >= 0 ? '+' : '−'}
            {formatWon(Math.abs(monthlyNet))}
          </b>
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

      {adding && (
        <EntryDialog
          today={today}
          onAdd={(entry) => update({ entries: [...state.entries, entry] })}
          onRemove={(id) => update({ entries: state.entries.filter((e) => e.id !== id) })}
          onClose={() => setAdding(false)}
        />
      )}

      {editing && (
        <EntryDialog
          today={today}
          initial={editing}
          onUpdate={(entry) =>
            update({ entries: state.entries.map((e) => (e.id === entry.id ? entry : e)) })
          }
          onRemove={(id) => update({ entries: state.entries.filter((e) => e.id !== id) })}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
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
