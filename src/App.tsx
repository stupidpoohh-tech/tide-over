import { useEffect, useState } from 'react';
import { CalendarScreen } from './components/CalendarScreen';
import { Onboarding } from './components/Onboarding';
import { RestoreDialog } from './components/RestoreDialog';
import { SettingsScreen } from './components/SettingsScreen';
import { SettleScreen } from './components/SettleScreen';
import { todayISO } from './lib/date';
import { useStore } from './store';

type Tab = 'calendar' | 'settle' | 'settings';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'calendar', label: '달력' },
  { id: 'settle', label: '정산' },
  { id: 'settings', label: '설정' },
];

export default function App() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>('calendar');
  const today = useToday();

  if (!store.ready) return <div className="boot" aria-busy="true" />;

  const { state } = store;

  return (
    <div className="app">
      <header className="app__header">
        <h1>잔고 캘린더</h1>
        {state && (
          <nav className="tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`tab ${tab === t.id ? 'is-active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      {store.loadIssue && (
        <p className="banner banner--warn" role="alert">
          {store.loadIssue}
        </p>
      )}
      {!store.canStore && (
        <p className="banner banner--warn" role="alert">
          이 브라우저에서는 저장이 되지 않습니다(시크릿 모드일 수 있습니다). 창을 닫으면 입력한
          내용이 사라집니다.
        </p>
      )}

      <main>
        {state === null ? (
          <Onboarding
            wasWiped={store.wasWiped}
            onStart={store.setState}
            onRestoreLink={store.offerRestore}
          />
        ) : tab === 'calendar' ? (
          <CalendarScreen
            state={state}
            today={today}
            onSave={store.setState}
            onGoSettle={() => setTab('settle')}
          />
        ) : tab === 'settle' ? (
          <SettleScreen
            state={state}
            wasWiped={store.wasWiped}
            onRestoreLink={store.offerRestore}
            onSave={store.setState}
          />
        ) : (
          <SettingsScreen
            state={state}
            persistence={store.persistence}
            canStore={store.canStore}
            backupTakenAt={store.backupTakenAt}
            onSave={store.setState}
            onBackupTaken={store.noteBackupTaken}
            onRestoreLink={store.offerRestore}
            onReset={store.reset}
            onToast={store.showToast}
          />
        )}
      </main>

      {store.pendingRestore && (
        <RestoreDialog
          incoming={store.pendingRestore.state}
          exportedAt={store.pendingRestore.exportedAt}
          current={state}
          onConfirm={store.confirmRestore}
          onCancel={store.cancelRestore}
        />
      )}

      {store.toast && (
        <div className="toast" role="status" onClick={store.dismissToast}>
          {store.toast}
        </div>
      )}
    </div>
  );
}

/**
 * 오늘이 바뀌면 화면도 바뀌어야 한다 — 이 앱의 경계는 전부 오늘 기준이라
 * 자정을 넘긴 탭을 그대로 두면 어제의 한도를 보여주게 된다.
 */
function useToday(): string {
  const [today, setToday] = useState(() => todayISO());

  useEffect(() => {
    let timer = 0;

    const check = () => {
      setToday((prev) => {
        const now = todayISO();
        return now === prev ? prev : now;
      });
      schedule();
    };

    const schedule = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      window.clearTimeout(timer);
      // 브라우저 타이머는 백그라운드에서 밀리므로 1초 여유를 둔다.
      timer = window.setTimeout(check, midnight.getTime() - now.getTime() + 1000);
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };

    schedule();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return today;
}
