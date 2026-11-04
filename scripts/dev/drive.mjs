// Drive the running dev server in headless Chrome: press keys, collect errors, screenshot.
// Usage: node scripts/dev/drive.mjs <out.png> "<keys separated by space>" [waitMs]
// Requires Chrome started with --remote-debugging-port=9222.
import { writeFileSync } from 'node:fs';

const [out, keys = '', waitMs = '1500'] = process.argv.slice(2);
const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send('Runtime.enable');
await send('Page.enable');
await send('Page.reload', { ignoreCache: true });
await sleep(4000);
for (const k of keys.split(' ').filter(Boolean)) {
  const code = k.length === 1 ? `Key${k.toUpperCase()}` : k;
  const keyCode = k.length === 1 ? k.toUpperCase().charCodeAt(0) : { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 }[k];
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: keyCode });
  await sleep(120);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: keyCode });
  await sleep(120);
}
await sleep(Number(waitMs));
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
ws.close();
