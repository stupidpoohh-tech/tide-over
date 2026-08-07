import { type State, isState } from './types';

export const SCHEMA_VERSION = 1;

const SCHEMA_KEY = 'tideover.schema';
const STATE_KEY = 'tideover.state';
const BACKUP_MARK_KEY = 'tideover.backupTakenAt';
/**
 * 백업 이력은 쿠키에도 남긴다.
 * localStorage가 통째로 날아간 상황을 알아채는 게 목적인데,
 * 그 이력 자체가 같은 localStorage에만 있으면 같이 날아가서 아무 소용이 없다.
 * 쿠키가 영원하진 않지만 삭제 경로가 달라서 한쪽이 살아남을 확률이 생긴다.
 */
const BACKUP_COOKIE = 'tideover_backup';
const BACKUP_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type LoadResult =
  | { status: 'empty' }
  | { status: 'ok'; state: State }
  | { status: 'corrupt'; reason: string }
  /** 앞으로의 버전이 남긴 데이터 — 덮어쓰면 안 되니 읽기를 포기한다. */
  | { status: 'future'; version: number };

function ls(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = '__tideover_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function storageAvailable(): boolean {
  return ls() !== null;
}

export function loadState(): LoadResult {
  const store = ls();
  if (!store) return { status: 'corrupt', reason: '이 브라우저에서 저장소를 쓸 수 없습니다.' };

  const raw = store.getItem(STATE_KEY);
  if (raw === null) return { status: 'empty' };

  const version = Number(store.getItem(SCHEMA_KEY) ?? SCHEMA_VERSION);
  if (!Number.isInteger(version) || version < 1) {
    return { status: 'corrupt', reason: '스키마 버전을 읽을 수 없습니다.' };
  }
  if (version > SCHEMA_VERSION) return { status: 'future', version };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'corrupt', reason: '저장된 데이터를 해석할 수 없습니다.' };
  }

  const migrated = migrate(parsed, version);
  if (!migrated) return { status: 'corrupt', reason: '저장된 데이터의 모양이 맞지 않습니다.' };
  return { status: 'ok', state: migrated };
}

/** v -> v+1 변환. 다음 스키마 버전이 생기면 여기에 한 줄씩 늘린다. */
const MIGRATIONS: Record<number, (data: unknown) => unknown> = {};

/** 옛 버전 데이터를 현재 스키마로 끌어올린다. v1이 첫 버전이라 아직 변환은 없다. */
function migrate(data: unknown, fromVersion: number): State | null {
  let current = data;
  for (let v = fromVersion; v < SCHEMA_VERSION; v += 1) {
    const step = MIGRATIONS[v];
    if (!step) return null;
    current = step(current);
  }
  return isState(current) ? current : null;
}

export function saveState(state: State): boolean {
  const store = ls();
  if (!store) return false;
  try {
    store.setItem(STATE_KEY, JSON.stringify(state));
    store.setItem(SCHEMA_KEY, String(SCHEMA_VERSION));
    return true;
  } catch {
    return false;
  }
}

export function clearState(): void {
  const store = ls();
  if (!store) return;
  try {
    store.removeItem(STATE_KEY);
    store.removeItem(SCHEMA_KEY);
  } catch {
    /* 지우지 못해도 앱은 계속 돈다. */
  }
}

/* ---------- 백업 이력 ---------- */

export function markBackupTaken(now: Date = new Date()): void {
  const at = now.toISOString();
  const store = ls();
  try {
    store?.setItem(BACKUP_MARK_KEY, at);
  } catch {
    /* 무시 */
  }
  writeCookie(BACKUP_COOKIE, at, BACKUP_COOKIE_MAX_AGE);
}

export function lastBackupAt(): string | null {
  const store = ls();
  let fromLocal: string | null = null;
  try {
    fromLocal = store?.getItem(BACKUP_MARK_KEY) ?? null;
  } catch {
    fromLocal = null;
  }
  const fromCookie = readCookie(BACKUP_COOKIE);

  const candidates = [fromLocal, fromCookie].filter(
    (v): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v)),
  );
  if (candidates.length === 0) return null;
  return candidates.sort().at(-1) ?? null;
}

export function hasBackupHistory(): boolean {
  return lastBackupAt() !== null;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined' || !location.protocol.startsWith('http')) return;
  try {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
  } catch {
    /* 무시 */
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split('; ')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/* ---------- 저장소 영속성 ---------- */

export type PersistenceStatus = 'persisted' | 'denied' | 'unsupported' | 'unknown';

/**
 * 브라우저가 저장소를 자동으로 비우지 않게 요청한다.
 * 거절당해도 앱은 그대로 동작한다 — 백업 링크가 진짜 안전장치다.
 */
export async function requestPersistence(): Promise<PersistenceStatus> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return 'unsupported';
  try {
    if (navigator.storage.persisted && (await navigator.storage.persisted())) return 'persisted';
    return (await navigator.storage.persist()) ? 'persisted' : 'denied';
  } catch {
    return 'unknown';
  }
}
