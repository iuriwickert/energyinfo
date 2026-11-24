/**
 * graficos.js — gráficos em SVG desenhados em PIXELS REAIS (6.9).
 * Cada função recebe a largura real do contêiner (W) e usa altura fixa; o viewBox é igual ao
 * tamanho em px, então o texto nunca escala com a janela. A interface redesenha com ResizeObserver.
 */
import { MESES, formatarAnos } from './calculo.js';

export const ALTURA = 220;
export const fmtR = (v) => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
const fmtK = (v) => {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
  if (a >= 1e3) return (v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' mil';
  return Math.round(v).toLocaleString('pt-BR');
};
function escala(min, max, n = 4) {
  const span = max - min || 1, p0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(p0)));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= p0);
  const lo = Math.floor(min / passo) * passo, hi = Math.ceil(max / passo) * passo, ticks = [];
  for (let v = lo; v <= hi + passo / 2; v += passo) ticks.push(+v.toFixed(6));
  return { lo, hi, ticks };
}
const abre = (W, H, rotulo) => `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${rotulo}">`;
const larguraTexto = (t, px = 12) => t.length * px * 0.56; // estimativa para posicionar rótulos

/** Saldo acumulado em 25 anos */
export function saldo(series, payback, W, H = ALTURA) {
  const m = { l: 52, r: 30, t: 10, b: 24 };
  const todos = series.flatMap((s) => s.valores);
  const e = escala(Math.min(0, ...todos), Math.max(0, ...todos));
  const x = (i) => m.l + (i / 25) * (W - m.l - m.r), y = (v) => m.t + (1 - (v - e.lo) / (e.hi - e.lo)) * (H - m.t - m.b);
  let s = abre(W, H, 'Saldo acumulado em 25 anos');
  e.ticks.forEach((t) => { s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" class="pl-g-grade"/><text x="${m.l - 6}" y="${y(t) + 4}" class="pl-g-eixo" text-anchor="end">${fmtK(t)}</text>`; });
  for (let a = 0; a <= 25; a += 5) s += `<text x="${x(a)}" y="${H - 6}" class="pl-g-eixo" text-anchor="${a === 25 ? 'end' : a === 0 ? 'start' : 'middle'}">${a === 0 ? 'hoje' : a === 25 ? '25 anos' : a}</text>`;
  s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}" class="pl-g-zero"/>`;
  series.forEach((se, k) => { s += `<polyline points="${se.valores.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}" class="pl-g-linha${k ? ' pl-g-linha2' : ''}"/>`; });
  if (payback != null && payback <= 25) {
    const px = x(payback), py = y(0), txt = `retorno: ${formatarAnos(payback)}`, tw = larguraTexto(txt);
    // a linha sobe da esquerda para a direita: acima-esquerda e abaixo-direita do ponto ficam livres
    const cabeEsq = px - 10 - tw >= m.l;
    const tx = cabeEsq ? px - 10 : Math.min(px + 10, W - m.r - tw);
    const ty = cabeEsq ? py - 10 : Math.min(py + 18, H - m.b - 4);
    s += `<circle cx="${px}" cy="${py}" r="4.5" class="pl-g-marca"/><text x="${tx}" y="${ty}" class="pl-g-rotulo" text-anchor="${cabeEsq ? 'end' : 'start'}">${txt}</text>`;
  }
  if (series.length > 1) s += series.map((se, k) => `<g transform="translate(${m.l + 8 + k * 110},${m.t + 4})"><line x1="0" x2="16" y1="0" y2="0" class="pl-g-linha${k ? ' pl-g-linha2' : ''}"/><text x="21" y="4" class="pl-g-eixo">${se.nome}</text></g>`).join('');
  return s + '</svg>';
}

/** Conta antes x depois: duas barras de no máximo 72 px */
export function conta(antes, depois, W, H = ALTURA) {
  const m = { t: 24, b: 22 }, bw = Math.min(72, W / 4), gap = Math.min(56, W / 5), x0 = (W - 2 * bw - gap) / 2, hh = H - m.t - m.b, max = Math.max(antes, 1);
  const barra = (v, i, cls, rot) => {
    const h = Math.max((v / max) * hh, 1), x = x0 + i * (bw + gap), yy = m.t + hh - h;
    return `<rect x="${x}" y="${yy}" width="${bw}" height="${h}" rx="4" class="${cls}"/><text x="${x + bw / 2}" y="${yy - 6}" class="pl-g-valor" text-anchor="middle">${fmtR(v)}</text><text x="${x + bw / 2}" y="${H - 6}" class="pl-g-eixo" text-anchor="middle">${rot}</text>`;
  };
  return `${abre(W, H, `Conta de luz: hoje ${fmtR(antes)}, com energia solar ${fmtR(depois)}`)}${barra(antes, 0, 'pl-g-barra2', 'Hoje')}${barra(depois, 1, 'pl-g-destaque', 'Com solar')}</svg>`;
}

/** Geração mês a mês: 12 barras + linha de consumo tracejada com rótulo pequeno à direita */
export function mensal(valores, consumo, W, H = ALTURA) {
  const m = { l: 44, r: 8, t: 22, b: 22 };
  const e = escala(0, Math.max(...valores, consumo || 0));
  const bw = (W - m.l - m.r) / 12, y = (v) => m.t + (1 - v / e.hi) * (H - m.t - m.b);
  let s = abre(W, H, 'Geração mês a mês');
  e.ticks.forEach((t) => { s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" class="pl-g-grade"/><text x="${m.l - 6}" y="${y(t) + 4}" class="pl-g-eixo" text-anchor="end">${fmtK(t)}</text>`; });
  valores.forEach((v, i) => {
    const x = m.l + i * bw + bw * 0.18, w = bw * 0.64;
    s += `<rect x="${x}" y="${y(v)}" width="${w}" height="${y(0) - y(v)}" rx="2" class="pl-g-barra"><title>${MESES[i]}: ${Math.round(v)} kWh</title></rect>`;
    s += `<text x="${x + w / 2}" y="${H - 6}" class="pl-g-eixo" text-anchor="middle">${MESES[i]}</text>`;
  });
  // linha de consumo; o rótulo fica no canto superior direito, acima da área do gráfico (sem cruzar barras)
  if (consumo) s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(consumo)}" y2="${y(consumo)}" class="pl-g-consumo"/><line x1="${W - m.r - 150}" x2="${W - m.r - 134}" y1="8" y2="8" class="pl-g-consumo"/><text x="${W - m.r}" y="12" class="pl-g-eixo" text-anchor="end">consumo ${Math.round(consumo)} kWh</text>`;
  return s + '</svg>';
}

/** Sensibilidade do retorno (expert) — altura pelo número de cenários */
export function sensibilidade(cen, W) {
  const linha = 30, H = cen.length * linha + 20, m = { l: 84, r: 120 }, max = Math.max(...cen.map((c) => c.payback ?? 25), 1);
  let s = abre(W, H, 'Sensibilidade do retorno');
  cen.forEach((c, i) => {
    const v = c.payback ?? 25, w = Math.max(2, (v / max) * (W - m.l - m.r)), yy = i * linha;
    s += `<text x="${m.l - 8}" y="${yy + 18}" class="pl-g-eixo" text-anchor="end">${c.nome}</text><rect x="${m.l}" y="${yy + 5}" width="${w}" height="18" rx="3" class="${c.nome === 'Base' ? 'pl-g-destaque' : 'pl-g-barra2'}"/><text x="${m.l + w + 6}" y="${yy + 18}" class="pl-g-rotulo">${formatarAnos(c.payback)}</text>`;
  });
  return s + `<text x="0" y="${H - 4}" class="pl-g-eixo">Pessimista: tarifa −10%, preço +15%, reajuste −2 p.p.</text></svg>`;
}
export const alturaSensibilidade = (n) => n * 30 + 20;

/** Barra empilhada de 28 px (Para onde vai o dinheiro) */
export const CORES_CUSTO = ['pl-c1', 'pl-c2', 'pl-c3', 'pl-c4', 'pl-c5', 'pl-c6', 'pl-c7'];
export function custoEmpilhado(itens, W, H = 28) {
  let x = 0, s = abre(W, H, 'Divisão do investimento por item');
  itens.forEach((it, i) => {
    const w = it.pct * W;
    s += `<rect x="${x.toFixed(1)}" y="0" width="${Math.max(w - 2, 0).toFixed(1)}" height="${H}" rx="2" class="${CORES_CUSTO[i]}"><title>${it.nome}: ${(it.pct * 100).toFixed(1)}%</title></rect>`;
    x += w;
  });
  return s + '</svg>';
}
