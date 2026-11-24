// Grava o tutorial com o Chrome do sistema (sem baixar nada):
// 1) abre o Chrome headless, 2) roda tour.js na página e captura os quadros (CDP screencast),
// 3) remonta os quadros num canvas e codifica .webm com MediaRecorder, 4) salva o arquivo.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const SAIDA = process.argv[2];
const URL_SITE = 'http://127.0.0.1:5500/index.html';
const W = 1280, H = 800, PORTA = 9333;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const perfil = join(process.env.TEMP || aqui, 'ei-gravacao-perfil'); mkdirSync(perfil, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORTA}`, `--user-data-dir=${perfil}`, `--window-size=${W},${H}`,
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });

let alvos;
for (let i = 0; i < 40; i++) { try { alvos = await (await fetch(`http://127.0.0.1:${PORTA}/json/list`)).json(); if (alvos.length) break; } catch {} await espera(250); }
const pagina = alvos.find((t) => t.type === 'page');
const ws = new WebSocket(pagina.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pendentes = new Map(); const ouvintes = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pendentes.has(m.id)) { const { r, j } = pendentes.get(m.id); pendentes.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); }
  else if (m.method) ouvintes.forEach((f) => f(m));
});
const cdp = (method, params = {}) => new Promise((r, j) => { const i = ++id; pendentes.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params })); });
const avaliar = async (expr) => { const x = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (x.exceptionDetails) throw new Error(x.exceptionDetails.exception?.description || x.exceptionDetails.text); return x.result.value; };

await cdp('Page.enable'); await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await cdp('Page.navigate', { url: URL_SITE });
await espera(5000);
// deixa o planejador no topo da tela, no modo Padrão, sem animações de entrada pendentes
await avaliar(`(async()=>{document.documentElement.style.scrollBehavior='auto';
  document.querySelector('#pl-tab-padrao')?.click();
  const r=document.querySelector('.pl-raiz'); scrollTo(0, r.getBoundingClientRect().top + scrollY - 12);
  await new Promise(r=>setTimeout(r,1500)); document.querySelectorAll('.ei-revelar').forEach(e=>e.classList.add('ei-visivel')); return 1})()`);
await espera(1200);
await avaliar(readFileSync(join(aqui, 'roteiro-gravacao.js'), 'utf8'));

// captura
const quadros = [];
ouvintes.push((m) => {
  if (m.method !== 'Page.screencastFrame') return;
  quadros.push({ t: m.params.metadata.timestamp, d: m.params.data });
  cdp('Page.screencastFrameAck', { sessionId: m.params.sessionId });
});
await cdp('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
await espera(400);
const resultado = await avaliar('window.__tour()');
await espera(600);
await cdp('Page.stopScreencast');
console.log('roteiro:', resultado, '| quadros:', quadros.length, '| duração (s):', (quadros.at(-1).t - quadros[0].t).toFixed(1));

// codificação: canvas + MediaRecorder, tocando os quadros no tempo real em que foram capturados
await cdp('Page.navigate', { url: 'about:blank' }); await espera(800);
await avaliar(`(()=>{const c=document.createElement('canvas');c.width=${W};c.height=${H};document.body.append(c);
  window.__ctx=c.getContext('2d'); const s=c.captureStream(30);
  const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';
  window.__partes=[]; window.__rec=new MediaRecorder(s,{mimeType:mime,videoBitsPerSecond:2500000});
  __rec.ondataavailable=e=>__partes.push(e.data); __rec.start(1000); return mime})()`);
const t0 = quadros[0].t, inicio = Date.now();
for (const q of quadros) {
  const alvo = (q.t - t0) * 1000 - (Date.now() - inicio);
  if (alvo > 0) await espera(alvo);
  await avaliar(`new Promise(r=>{const i=new Image();i.onload=()=>{__ctx.drawImage(i,0,0,${W},${H});r(1)};i.src='data:image/jpeg;base64,${q.d}'})`);
}
await espera(1200);
const b64 = await avaliar(`new Promise(r=>{__rec.onstop=async()=>{const b=new Blob(__partes,{type:'video/webm'});const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(b)};__rec.stop()})`);
writeFileSync(SAIDA, Buffer.from(b64, 'base64'));
console.log('salvo:', SAIDA, (Buffer.from(b64, 'base64').length / 1e6).toFixed(1), 'MB');
ws.close(); chrome.kill();
