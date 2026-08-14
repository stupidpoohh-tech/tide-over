/**
 * 사전 설치된 Chromium에 CDP로 직접 붙는 최소 드라이버.
 *
 * playwright를 쓰지 않는 이유: 이 개발 환경의 프록시에서 tarball 내려받기가
 * 계속 끊긴다. 브라우저 자체는 이미 /opt/pw-browsers 에 있으므로 그냥 붙인다.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME_CANDIDATES = [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium',
  process.env.CHROME_PATH,
];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function chromePath() {
  const found = CHROME_CANDIDATES.filter(Boolean).find((p) => existsSync(p));
  if (!found) throw new Error(`chromium을 찾지 못했습니다: ${CHROME_CANDIDATES.join(', ')}`);
  return found;
}

/**
 * 브라우저를 띄우고 조작 헬퍼를 돌려준다.
 * 페이지에 주입되는 __q/__all/__text/__byText/__set/__field/__fill 은
 * 테스트 안에서 evaluate()로 바로 쓸 수 있다.
 */
export async function launch({ port = 9222, size = '390,844', outDir = '.' } = {}) {
  const chrome = spawn(
    chromePath(),
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${mkdtempSync(join(tmpdir(), 'tideover-cdp-'))}`,
      `--window-size=${size}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  const target = await waitForPage(port);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));

  let nextId = 0;
  const pending = new Map();
  const errors = [];

  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id !== undefined) {
      const { resolve, reject } = pending.get(m.id) ?? {};
      pending.delete(m.id);
      if (m.error) reject?.(new Error(JSON.stringify(m.error)));
      else resolve?.(m.result);
      return;
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
    }
    // CSP 위반은 console API가 아니라 Log 도메인으로 들어온다.
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      errors.push(`[${m.params.entry.source}] ${m.params.entry.text}`);
    }
    if (m.method === 'Runtime.exceptionThrown') {
      errors.push(m.params.exceptionDetails.exception?.description ?? '');
    }
  });

  const send = (method, params = {}) => {
    const id = (nextId += 1);
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    }
    return r.result.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: HELPERS });

  return {
    send,
    evaluate,
    errors,
    goto: async (url) => {
      await send('Page.navigate', { url });
      await sleep(800);
    },
    shot: async (name) => {
      const { data } = await send('Page.captureScreenshot', { captureBeyondViewport: true });
      writeFileSync(join(outDir, name), Buffer.from(data, 'base64'));
    },
    /** 실제 손가락처럼 끌기 — 스와이프로 달 넘기기 같은 걸 검증할 때. */
    drag: async (fromX, fromY, toX, toY, steps = 6) => {
      const common = { button: 'left', pointerType: 'touch', buttons: 1 };
      await send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: fromX,
        y: fromY,
        clickCount: 1,
        ...common,
      });
      for (let i = 1; i <= steps; i += 1) {
        await send('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: fromX + ((toX - fromX) * i) / steps,
          y: fromY + ((toY - fromY) * i) / steps,
          ...common,
        });
      }
      await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: toX,
        y: toY,
        clickCount: 1,
        ...common,
        buttons: 0,
      });
      await sleep(350);
    },
    key: async (key) => {
      for (const type of ['keyDown', 'keyUp']) {
        await send('Input.dispatchKeyEvent', { type, key, code: key });
      }
      await sleep(300);
    },
    close: () => chrome.kill(),
  };
}

async function waitForPage(port) {
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch {
      /* 아직 안 떴다 */
    }
    await sleep(250);
  }
  throw new Error('chromium이 뜨지 않았습니다');
}

/** 결과를 모아 PASS/FAIL로 찍고, 하나라도 실패하면 종료 코드를 1로. */
export function reporter() {
  const results = [];
  return {
    check(name, ok, detail = '') {
      results.push({ name, ok });
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
    },
    finish() {
      const failed = results.filter((r) => !r.ok);
      console.log(`\n${results.length - failed.length}/${results.length} passed`);
      return failed.length === 0;
    },
  };
}

const HELPERS = `
  window.__q = (s) => document.querySelector(s);
  window.__all = (s) => [...document.querySelectorAll(s)];
  window.__text = (s) => (document.querySelector(s)?.innerText ?? '').trim();
  window.__byText = (s, t) =>
    __all(s).find((el) => el.innerText.trim() === t) ??
    __all(s).find((el) => el.innerText.trim().includes(t));
  window.__set = (el, v) => {
    const p = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(p, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  // 라벨 글자로 찾는다 — 금액도 내용도 input[type=text]라 순서로 잡으면 헷갈린다.
  window.__field = (label) =>
    __all('.dialog-row')
      .find((r) => r.querySelector('.dialog-row__label')?.textContent === label)
      ?.querySelector('input, select, textarea');
  window.__fill = (label, v) => __set(__field(label), v);
  window.__state = () => JSON.parse(localStorage.getItem('tideover.state') ?? 'null');
  window.__futureCell = (i = 0) =>
    __all('.day:not(.day--outside):not(.day--past):not(.day--today)')[i];
`;
