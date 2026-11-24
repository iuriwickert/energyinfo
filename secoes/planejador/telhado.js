/**
 * telhado.js — editor de telhado (vista de cima, em metros), canvas próprio.
 * Formas prontas (duas partes, uma parte, laje) ou desenho livre com linhas de cumeeira.
 * A direção de cada parte é automática: para onde ela DESCE (perpendicular à cumeeira).
 * O norte é marcado girando a bússola sobre o desenho. Nada daqui é gravado.
 */

export const NOMES_DIRECAO = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'];
export const nomeDirecao = (az) => NOMES_DIRECAO[Math.round((((az % 360) + 360) % 360) / 45) % 8];

const EPS = 0.02;
const PAINEL = { larg: 1.13, comp: 2.28 }; // painel de 550 Wp (~2,28 × 1,13 m)
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function areaPoligono(v) {
  let s = 0;
  for (let i = 0; i < v.length; i++) { const a = v[i], b = v[(i + 1) % v.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(s) / 2;
}
function centroide(v) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < v.length; i++) {
    const p = v[i], q = v[(i + 1) % v.length], c = p[0] * q[1] - q[0] * p[1];
    a += c; cx += (p[0] + q[0]) * c; cy += (p[1] + q[1]) * c;
  }
  if (Math.abs(a) < 1e-9) return [v.reduce((s, p) => s + p[0], 0) / v.length, v.reduce((s, p) => s + p[1], 0) / v.length];
  return [cx / (3 * a), cy / (3 * a)];
}
function dentro(p, v) {
  let d = false;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    const a = v[i], b = v[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) d = !d;
  }
  return d;
}
function projetar(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return [a[0] + t * dx, a[1] + t * dy];
}
function inserirNaBorda(v, p) {
  for (let i = 0; i < v.length; i++) if (dist(v[i], p) < EPS) return i;
  for (let i = 0; i < v.length; i++) {
    const a = v[i], b = v[(i + 1) % v.length];
    if (dist(projetar(p, a, b), p) < EPS) { v.splice(i + 1, 0, [p[0], p[1]]); return i + 1; }
  }
  return -1;
}
const naAresta = (p, a, b) => dist(projetar(p, a, b), p) < EPS;

export class EditorTelhado {
  constructor(canvas, opts = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.opts = opts;
    this.forma = null; this.largura = 10; this.comprimento = 8;
    this.norte = 0; this.inclinacao = 20;
    this.partes = []; this.contorno = []; this.linha = []; this.modoLivre = null;
    this.paineis = {}; this.info = {}; this.lajePainel = { inclinacao: 20, azimute: 0 };
    this.hist = []; this.seq = 1; this.cursor = null; this.mostrarCursor = false;
    this.escala = 22; this.ox = 20; this.oy = 20;
    this._eventos();
    this.redimensionar();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.redimensionar()).observe(canvas.parentElement);
  }

  /* ---------------- estado ---------------- */
  get desenhado() { return this.partes.length > 0; }
  _salvar() { this.hist.push(JSON.stringify({ p: this.partes, c: this.contorno, f: this.forma, s: this.seq })); if (this.hist.length > 60) this.hist.shift(); }
  desfazer() {
    if (this.linha.length) { this.linha.pop(); return this.desenhar(); }
    if (this.contorno.length && !this.partes.length) { this.contorno.pop(); return this.desenhar(); }
    const h = this.hist.pop(); if (!h) return;
    const o = JSON.parse(h); this.partes = o.p; this.contorno = o.c; this.forma = o.f; this.seq = o.s;
    if (this.forma === 'livre') this.modoLivre = this.partes.length ? 'pronto' : 'contorno';
    this._mudou(true);
  }
  limpar() { this._salvar(); this.partes = []; this.contorno = []; this.linha = []; this.forma = null; this.modoLivre = null; this._mudou(true); }
  _nova(vertices, extra = {}) { return { id: 'p' + this.seq++, vertices, invertido: false, inclinacao: null, incluir: null, ...extra }; }

  /** Formas prontas: 'duas' | 'uma' | 'laje'; 'livre' começa o desenho por cliques */
  /** cumeeiraNaFrente: nas duas águas, a cumeeira fica paralela à frente (uma água para a frente, outra para o fundo) */
  setForma(forma, largura = this.largura, comprimento = this.comprimento, cumeeiraNaFrente = false) {
    this._salvar();
    this.forma = forma; this.linha = []; this.contorno = [];
    if (forma === 'livre') { this.partes = []; this.modoLivre = 'contorno'; this.escala = Math.min(this.w / 24, this.h / 18); this.ox = 16; this.oy = 16; this._mudou(true); return; }
    this.modoLivre = null;
    const W = Math.max(1, largura), L = Math.max(1, comprimento);
    this.largura = W; this.comprimento = L;
    if (forma === 'duas') {
      this.partes = W >= L || cumeeiraNaFrente
        ? [this._nova([[0, 0], [W, 0], [W, L / 2], [0, L / 2]]), this._nova([[0, L / 2], [W, L / 2], [W, L], [0, L]])]
        : [this._nova([[0, 0], [W / 2, 0], [W / 2, L], [0, L]]), this._nova([[W / 2, 0], [W, 0], [W, L], [W / 2, L]])];
    } else this.partes = [this._nova([[0, 0], [W, 0], [W, L], [0, L]])];
    if (forma === 'laje') this.inclinacao = Math.min(this.inclinacao, 5);
    this._enquadrar(); this._mudou(true);
  }
  setNorte(graus) { this.norte = ((Math.round(graus) % 360) + 360) % 360; this._mudou(false, 'norte'); }
  setInclinacao(graus) { this.inclinacao = graus; this.partes.forEach((p) => { p.inclinacao = null; }); this._mudou(false, 'inclinacao'); }
  setParte(id, campos) { const p = this.partes.find((x) => x.id === id); if (!p) return; Object.assign(p, campos); this._mudou(false, 'parte'); }
  /** Informações vindas do cálculo: { [id]: { classe, n } } e painéis da laje */
  setInfo(info) { this.info = info || {}; this.desenhar(); }
  setModoLivre(m) { if (this.forma !== 'livre') return; if (m === 'linha' && !this.partes.length) return; this.modoLivre = m; this.linha = []; this.desenhar(); this.opts.aoModo && this.opts.aoModo(m); }

  /** Vetor de descida de uma parte, no desenho (y para baixo) */
  _descida(p) {
    let melhor = null;
    for (const o of this.partes) {
      if (o === p) continue;
      for (let i = 0; i < p.vertices.length; i++) {
        const a = p.vertices[i], b = p.vertices[(i + 1) % p.vertices.length];
        let comp = 0;
        for (let j = 0; j < o.vertices.length; j++) {
          const c = o.vertices[j], d = o.vertices[(j + 1) % o.vertices.length];
          if (naAresta(c, a, b) && naAresta(d, a, b)) comp += dist(c, d);
          else if (naAresta(a, c, d) && naAresta(b, c, d)) comp += dist(a, b);
        }
        if (comp > 0.1 && (!melhor || comp > melhor.comp)) melhor = { comp, a, b };
      }
    }
    let v;
    if (melhor) {
      const dx = melhor.b[0] - melhor.a[0], dy = melhor.b[1] - melhor.a[1], l = Math.hypot(dx, dy);
      v = [-dy / l, dx / l];
      const c = centroide(p.vertices), m = [(melhor.a[0] + melhor.b[0]) / 2, (melhor.a[1] + melhor.b[1]) / 2];
      if ((c[0] - m[0]) * v[0] + (c[1] - m[1]) * v[1] < 0) v = [-v[0], -v[1]];
    } else v = [0, 1]; // sem cumeeira: desce para a frente (parte de baixo do desenho)
    return p.invertido ? [-v[0], -v[1]] : v;
  }
  /** Ângulo no desenho (0 = topo, horário) -> azimute de bússola, usando o norte marcado */
  _azimute(v) {
    const ang = (Math.atan2(v[0], -v[1]) * 180) / Math.PI;
    return (((ang - this.norte) % 360) + 360) % 360;
  }

  dados() {
    const laje = this.forma === 'laje';
    const partes = this.partes.map((p, i) => {
      const incl = laje ? this.inclinacao : (p.inclinacao ?? this.inclinacao);
      const az = this._azimute(this._descida(p));
      const areaPlanta = areaPoligono(p.vertices);
      return { id: p.id, nome: `Parte ${i + 1}`, inclinacao: incl, azimute: az, direcao: nomeDirecao(az), invertido: p.invertido, incluir: p.incluir,
        inclinacaoPropria: p.inclinacao != null, areaPlanta, areaReal: areaPlanta / Math.cos((incl * Math.PI) / 180) };
    });
    return { forma: this.forma, laje, desenhado: partes.length > 0, norte: this.norte, inclinacao: this.inclinacao, largura: this.largura, comprimento: this.comprimento, partes };
  }
  _mudou(geometria, oQue = 'forma') { this.desenhar(); this.opts.aoMudar && this.opts.aoMudar(this.dados(), oQue, geometria); }

  /* ---------------- desenho livre ---------------- */
  _dividir(face, caminho) {
    const S = caminho[0], E = caminho[caminho.length - 1], meio = caminho.slice(1, -1);
    const v = face.vertices.map((p) => [p[0], p[1]]);
    inserirNaBorda(v, S); inserirNaBorda(v, E);
    const s = v.findIndex((p) => dist(p, S) < EPS), e = v.findIndex((p) => dist(p, E) < EPS);
    if (s < 0 || e < 0 || s === e) return false;
    const arco = (i, j) => { const r = []; for (let k = i; ; k = (k + 1) % v.length) { r.push(v[k]); if (k === j) break; } return r; };
    const p1 = arco(s, e).concat(meio.slice().reverse()), p2 = arco(e, s).concat(meio);
    if (areaPoligono(p1) < 0.25 || areaPoligono(p2) < 0.25) return false;
    const i = this.partes.indexOf(face);
    this.partes.splice(i, 1, this._nova(p1, { inclinacao: face.inclinacao }), this._nova(p2, { inclinacao: face.inclinacao }));
    for (const o of this.partes) { inserirNaBorda(o.vertices, S); inserirNaBorda(o.vertices, E); }
    return true;
  }
  _fecharContorno() {
    if (this.contorno.length < 3 || areaPoligono(this.contorno) < 1) return this._dica('Desenhe uma área maior (pelo menos 3 cantos).');
    this._salvar();
    this.partes = [this._nova(this.contorno)]; this.contorno = []; this.modoLivre = 'pronto';
    this._mudou(true); this.opts.aoModo && this.opts.aoModo('pronto');
  }
  _concluirLinha(fim) {
    const caminho = this.linha.concat([fim]);
    const m = [(caminho[0][0] + caminho[1][0]) / 2, (caminho[0][1] + caminho[1][1]) / 2];
    const face = this.partes.find((a) => dentro(m, a.vertices));
    this.linha = [];
    if (!face) { this.desenhar(); return this._dica('A linha precisa atravessar o telhado.'); }
    this._salvar();
    if (!this._dividir(face, caminho)) { this.hist.pop(); this._dica('Não deu para dividir aqui: ligue dois pontos diferentes da borda.'); }
    this._mudou(true);
  }
  _pontoBorda(m) {
    const tol = 12 / this.escala; let melhor = null;
    for (const a of this.partes) for (const p of a.vertices) { const d = dist(p, m); if (d < tol && (!melhor || d < melhor.d)) melhor = { p: [p[0], p[1]], d, tipo: 'v' }; }
    if (melhor) return melhor;
    for (const a of this.partes) for (let i = 0; i < a.vertices.length; i++) {
      const A = a.vertices[i], B = a.vertices[(i + 1) % a.vertices.length], q = projetar(m, A, B), d = dist(q, m);
      if (d < tol && (!melhor || d < melhor.d)) { const g = this._grade(q), q2 = projetar(g, A, B); melhor = { p: dist(q2, g) < 0.05 ? q2 : q, d, tipo: 'a' }; }
    }
    return melhor;
  }
  _cliqueLivre(m) {
    if (this.modoLivre === 'contorno') {
      const g = this._grade(m);
      if (this.contorno.length >= 3 && dist(g, this.contorno[0]) < 12 / this.escala + 0.01) return this._fecharContorno();
      if (this.contorno.length && dist(g, this.contorno[this.contorno.length - 1]) < 0.1) return;
      this.contorno.push(g); this.desenhar(); return;
    }
    if (this.modoLivre === 'linha') {
      const b = this._pontoBorda(m);
      if (!this.linha.length) { if (b) { this.linha.push(b.p); this.desenhar(); } else this._dica('Comece a cumeeira num canto ou na borda do telhado.'); return; }
      if (b && dist(b.p, this.linha[0]) > EPS) return this._concluirLinha(b.p);
      const g = this._grade(m);
      if (!this.partes.some((a) => dentro(g, a.vertices))) return this._dica('A linha precisa ficar dentro do telhado.');
      this.linha.push(g); this.desenhar();
    }
  }
  _moverVertice(de, para) { for (const a of this.partes) for (const p of a.vertices) if (dist(p, de) < EPS) { p[0] = para[0]; p[1] = para[1]; } }

  /* ---------------- coordenadas ---------------- */
  redimensionar() {
    const box = this.cv.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const w = Math.max(200, Math.floor(box.width)), h = Math.max(160, Math.floor(box.height));
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.cv.width = w * dpr; this.cv.height = h * dpr; this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.partes.length && this.forma !== 'livre') this._enquadrar();
    this.desenhar();
  }
  _enquadrar() {
    const pts = this.partes.flatMap((a) => a.vertices).concat(this.contorno); if (!pts.length) return;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    this.escala = Math.max(4, Math.min(70, Math.min((this.w - 120) / Math.max(x1 - x0, 1), (this.h - 56) / Math.max(y1 - y0, 1))));
    this.ox = (this.w - 60 - (x1 - x0) * this.escala) / 2 - x0 * this.escala;
    this.oy = (this.h - (y1 - y0) * this.escala) / 2 - y0 * this.escala;
  }
  tela(p) { return [this.ox + p[0] * this.escala, this.oy + p[1] * this.escala]; }
  metros(s) { return [(s[0] - this.ox) / this.escala, (s[1] - this.oy) / this.escala]; }
  _grade(m, passo = 0.5) { return [Math.round(m[0] / passo) * passo, Math.round(m[1] / passo) * passo]; }
  _centroBussola() { return [this.w - 36, 36]; }

  /* ---------------- eventos (mouse, toque e teclado) ---------------- */
  _eventos() {
    const cv = this.cv;
    const pos = (ev) => { const r = cv.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
    const anguloBussola = (s) => { const c = this._centroBussola(); return (Math.atan2(s[0] - c[0], -(s[1] - c[1])) * 180) / Math.PI; };
    cv.addEventListener('pointerdown', (ev) => {
      const s = pos(ev), m = this.metros(s), c = this._centroBussola();
      if (dist(s, c) < 30) { this.girando = true; cv.setPointerCapture(ev.pointerId); this.setNorte(anguloBussola(s)); return; }
      if (this.forma === 'livre' && this.modoLivre !== 'pronto') return this._cliqueLivre(m);
      if (this.forma === 'livre') {
        const rot = (this._rotulos || []).find((r) => Math.abs(r.x - s[0]) < 26 && Math.abs(r.y - s[1]) < 11);
        if (rot) return this._editarMedida(rot);
        const v = this.partes.flatMap((a) => a.vertices).find((p) => dist(this.tela(p), s) < 10);
        if (v) { this._salvar(); this.arrasto = [v[0], v[1]]; cv.setPointerCapture(ev.pointerId); }
      }
    });
    cv.addEventListener('pointermove', (ev) => {
      const s = pos(ev), m = this.metros(s);
      if (this.girando) { this.setNorte(anguloBussola(s)); return; }
      if (this.arrasto) { const g = this._grade(m, 0.25); this._moverVertice(this.arrasto, g); this.arrasto = g; this.desenhar(); return; }
      this.mostrarCursor = false;
      this.hover = this.modoLivre === 'linha' ? (this._pontoBorda(m) || { p: this._grade(m), tipo: 'l' }) : { p: this._grade(m), tipo: 'l' };
      const sobreBussola = dist(s, this._centroBussola()) < 30;
      cv.style.cursor = sobreBussola ? 'grab' : this.forma === 'livre' && this.modoLivre !== 'pronto' ? 'crosshair' : 'default';
      if (this.forma === 'livre') this.desenhar();
    });
    const soltar = () => { if (this.girando) { this.girando = false; } if (this.arrasto) { this.arrasto = null; this._mudou(true); } };
    cv.addEventListener('pointerup', soltar);
    cv.addEventListener('pointercancel', soltar);
    cv.addEventListener('pointerleave', () => { this.hover = null; this.desenhar(); });
    cv.addEventListener('dblclick', () => { if (this.forma === 'livre' && this.modoLivre === 'contorno') this._fecharContorno(); });
    cv.addEventListener('keydown', (ev) => {
      // teclado: [ e ] giram o norte 15°; no desenho livre as setas movem o cursor e Enter marca o ponto
      if (ev.key === '[' || ev.key === ']') { ev.preventDefault(); this.setNorte(this.norte + (ev.key === ']' ? 15 : -15)); return; }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); this.desfazer(); return; }
      if (this.forma !== 'livre' || this.modoLivre === 'pronto') return;
      const passo = 0.5;
      if (!this.cursor) this.cursor = this.contorno.length ? [...this.contorno[this.contorno.length - 1]] : this._grade(this.metros([this.w / 2 - 30, this.h / 2]));
      const mov = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[ev.key];
      if (mov) { ev.preventDefault(); this.cursor = [this.cursor[0] + mov[0], this.cursor[1] + mov[1]]; this.mostrarCursor = true; this.hover = { p: this.cursor, tipo: 'l' }; this.desenhar(); return; }
      if (ev.key === 'Enter') { ev.preventDefault(); this.mostrarCursor = true; this._cliqueLivre(this.cursor); return; }
      if (ev.key === 'Escape') { this.linha = []; this.desenhar(); }
      if (ev.key === 'Backspace') { ev.preventDefault(); this.desfazer(); }
    });
  }
  _editarMedida(rot) {
    const box = this.cv.parentElement, inp = document.createElement('input');
    inp.type = 'number'; inp.step = '0.1'; inp.min = '0.5'; inp.value = rot.l.toFixed(2);
    inp.className = 'pl-medida'; inp.style.left = rot.x - 34 + 'px'; inp.style.top = rot.y - 14 + 'px';
    inp.setAttribute('aria-label', 'Medida do lado em metros');
    box.appendChild(inp); inp.focus(); inp.select();
    let feito = false;
    const fim = (ok) => {
      if (feito) return; feito = true;
      const L = parseFloat(String(inp.value).replace(',', '.')); inp.remove();
      if (!ok || !(L > 0.2) || Math.abs(L - rot.l) < 0.005) return;
      this._salvar();
      const u = [(rot.q[0] - rot.p[0]) / rot.l, (rot.q[1] - rot.p[1]) / rot.l];
      this._moverVertice([rot.q[0], rot.q[1]], [rot.p[0] + u[0] * L, rot.p[1] + u[1] * L]);
      this._mudou(true); this.cv.focus();
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') fim(true); if (e.key === 'Escape') fim(false); });
    inp.addEventListener('blur', () => fim(true));
  }
  _dica(t) { this.opts.aoDica && this.opts.aoDica(t); }

  /* ---------------- painéis desenhados ---------------- */
  _posicoesPaineis(p, laje) {
    let v, beta;
    if (laje) { const a = (this.norte * Math.PI) / 180; v = [-Math.sin(a), Math.cos(a)]; beta = this.lajePainel.inclinacao; }
    else { v = this._descida(p); beta = p.inclinacao ?? this.inclinacao; }
    // painel "em pé": lado comprido no sentido da descida (para a laje: fileiras leste-oeste com espaçamento)
    const u = [-v[1], v[0]], larg = PAINEL.larg, comp = PAINEL.comp * Math.cos((beta * Math.PI) / 180);
    const passoT = laje ? comp + PAINEL.comp * Math.sin((beta * Math.PI) / 180) * 1.2 : comp + 0.02;
    const S = p.vertices.map((q) => q[0] * u[0] + q[1] * u[1]), T = p.vertices.map((q) => q[0] * v[0] + q[1] * v[1]);
    const m = 0.3, res = [];
    const xy = (s, t) => [s * u[0] + t * v[0], s * u[1] + t * v[1]];
    for (let t = Math.min(...T) + m; t + comp <= Math.max(...T) - m + 1e-9; t += passoT) {
      for (let s = Math.min(...S) + m; s + larg <= Math.max(...S) - m + 1e-9; s += larg + 0.02) {
        const cs = [xy(s, t), xy(s + larg, t), xy(s + larg, t + comp), xy(s, t + comp)];
        const f = m - 0.05; // folga um pouco menor que a margem, para não cair exatamente sobre a borda
        const fora = [xy(s - f, t - f), xy(s + larg + f, t - f), xy(s + larg + f, t + comp + f), xy(s - f, t + comp + f)];
        if (fora.every((c) => dentro(c, p.vertices))) res.push(cs);
      }
    }
    return res;
  }

  /* ---------------- renderização ---------------- */
  desenhar() {
    const c = this.ctx, w = this.w, h = this.h; if (!w) return;
    const css = getComputedStyle(this.cv);
    const cor = (n, d) => (css.getPropertyValue(n) || '').trim() || d;
    const K = {
      fundo: cor('--pl-canvas', '#ffffff'), grade: cor('--pl-grade', '#eef0f3'), grade5: cor('--pl-grade-forte', '#dde1e7'),
      tinta: cor('--pl-texto', '#1d2433'), suave: cor('--pl-texto-2', '#5b6475'), sol: cor('--pl-sol', '#f59e0b'),
      parte: cor('--pl-parte', '#eef1f5'), painel: cor('--pl-painel', '#1e3a5f'), painelBorda: cor('--pl-painel-borda', '#9fb3c8'),
      rec: cor('--pl-q-rec', '#15803d'), pode: cor('--pl-q-pode', '#a16207'), nao: cor('--pl-q-nao', '#b91c1c'),
    };
    c.clearRect(0, 0, w, h); c.fillStyle = K.fundo; c.fillRect(0, 0, w, h);
    const m0 = this.metros([0, 0]), m1 = this.metros([w, h]);
    c.lineWidth = 1;
    for (let x = Math.floor(m0[0]); x <= m1[0]; x++) { const sx = Math.round(this.ox + x * this.escala) + 0.5; c.strokeStyle = x % 5 === 0 ? K.grade5 : K.grade; c.beginPath(); c.moveTo(sx, 0); c.lineTo(sx, h); c.stroke(); }
    for (let y = Math.floor(m0[1]); y <= m1[1]; y++) { const sy = Math.round(this.oy + y * this.escala) + 0.5; c.strokeStyle = y % 5 === 0 ? K.grade5 : K.grade; c.beginPath(); c.moveTo(0, sy); c.lineTo(w, sy); c.stroke(); }

    const laje = this.forma === 'laje';
    const caminho = (v) => { c.beginPath(); v.forEach((p, k) => { const s = this.tela(p); k ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]); }); c.closePath(); };
    this._rotulos = [];
    this.partes.forEach((p, i) => {
      const inf = this.info[p.id] || {};
      caminho(p.vertices); c.fillStyle = K.parte; c.globalAlpha = inf.excluida ? 0.45 : 1; c.fill(); c.globalAlpha = 1;
      c.strokeStyle = K.tinta; c.lineWidth = 1.5; c.stroke();
      // painéis (preenchendo primeiro as melhores partes, conforme o cálculo)
      if (inf.n > 0) {
        const pos = this._posicoesPaineis(p, laje), n = Math.min(inf.n, pos.length);
        c.fillStyle = K.painel; c.strokeStyle = K.painelBorda; c.lineWidth = 0.8;
        for (let k = 0; k < n; k++) { caminho(pos[k]); c.fill(); c.stroke(); }
        if (inf.n > pos.length) { const ct = this.tela(centroide(p.vertices)); c.fillStyle = K.tinta; c.font = '600 11px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(`+${inf.n - pos.length} painéis`, ct[0], ct[1] + 34); }
      }
    });
    // medidas das bordas externas
    c.font = '600 11px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const e of this._arestasExternas()) {
      const l = dist(e.p, e.q); if (l < 0.5 || l * this.escala < 40) continue;
      const a = this.tela(e.p), b = this.tela(e.q), x = (a[0] + b[0]) / 2, y = (a[1] + b[1]) / 2, t = `${l.toFixed(2).replace('.', ',')} m`, tw = c.measureText(t).width + 10;
      c.fillStyle = K.fundo; c.strokeStyle = K.grade5; c.lineWidth = 1; c.beginPath(); c.rect(x - tw / 2, y - 9, tw, 18); c.fill(); c.stroke();
      c.fillStyle = K.tinta; c.fillText(t, x, y);
      this._rotulos.push({ x, y, l, p: e.p, q: e.q });
    }
    c.textBaseline = 'alphabetic';
    // seta de descida + etiqueta "Parte N · selo" (desenhadas por cima das medidas)
    this.partes.forEach((p, i) => {
      const inf = this.info[p.id] || {}, ct = this.tela(centroide(p.vertices));
      const L = Math.min(28, Math.max(16, this.escala * 1.4));
      if (!laje) {
        const v = this._descida(p), a = [ct[0] - v[0] * L * 0.5, ct[1] + 10 - v[1] * L * 0.5], b = [ct[0] + v[0] * L * 0.5, ct[1] + 10 + v[1] * L * 0.5];
        c.strokeStyle = K.sol; c.fillStyle = K.sol; c.lineWidth = 3; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
        const ang = Math.atan2(v[1], v[0]);
        c.beginPath(); c.moveTo(b[0] + Math.cos(ang) * 4, b[1] + Math.sin(ang) * 4); c.lineTo(b[0] - 9 * Math.cos(ang - 0.55), b[1] - 9 * Math.sin(ang - 0.55)); c.lineTo(b[0] - 9 * Math.cos(ang + 0.55), b[1] - 9 * Math.sin(ang + 0.55)); c.closePath(); c.fill();
      }
      const selo = { recomendada: 'Recomendada', pode: 'Pode usar', nao: 'Não recomendada' }[inf.classe];
      const txt = selo ? `Parte ${i + 1} · ${selo}` : `Parte ${i + 1}`;
      c.font = '700 11px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const tw = c.measureText(txt).width + 14, ty = ct[1] - (laje ? 0 : L * 0.5 + 6);
      c.fillStyle = selo ? K[inf.classe === 'recomendada' ? 'rec' : inf.classe] : K.fundo;
      c.beginPath(); c.roundRect ? c.roundRect(ct[0] - tw / 2, ty - 9, tw, 18, 9) : c.rect(ct[0] - tw / 2, ty - 9, tw, 18); c.fill();
      c.fillStyle = selo ? '#ffffff' : K.tinta; c.fillText(txt, ct[0], ty);
      c.textBaseline = 'alphabetic';
    });
    if (this.forma === 'livre' && this.modoLivre === 'pronto') for (const a of this.partes) for (const p of a.vertices) { const s = this.tela(p); c.fillStyle = K.fundo; c.strokeStyle = K.tinta; c.lineWidth = 1.5; c.beginPath(); c.arc(s[0], s[1], 3.5, 0, 7); c.fill(); c.stroke(); }
    // desenho livre em andamento
    if (this.contorno.length || this.linha.length) {
      const pts = this.contorno.length ? this.contorno : this.linha;
      c.strokeStyle = K.sol; c.lineWidth = 2.5; if (this.linha.length) c.setLineDash([7, 5]);
      c.beginPath(); pts.forEach((p, k) => { const s = this.tela(p); k ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]); });
      if (this.hover) { const s = this.tela(this.hover.p); c.lineTo(s[0], s[1]); }
      c.stroke(); c.setLineDash([]);
      pts.forEach((p, k) => { const s = this.tela(p); c.fillStyle = k === 0 ? K.sol : K.fundo; c.strokeStyle = K.sol; c.beginPath(); c.arc(s[0], s[1], k === 0 ? 6 : 4, 0, 7); c.fill(); c.stroke(); });
    }
    if (this.hover && this.forma === 'livre' && this.modoLivre && this.modoLivre !== 'pronto') {
      const s = this.tela(this.hover.p); c.strokeStyle = K.sol; c.lineWidth = 2; c.beginPath(); c.arc(s[0], s[1], this.mostrarCursor ? 8 : 5, 0, 7); c.stroke();
    }
    if (!this.partes.length && !this.contorno.length) {
      c.fillStyle = K.suave; c.font = '12px system-ui, sans-serif'; c.textAlign = 'center';
      c.fillText(this.forma === 'livre' ? 'Clique nos cantos do telhado; clique no 1º ponto para fechar' : 'Escolha a forma do telhado ao lado', (w - 60) / 2, h / 2);
    }
    this._bussola(c, K);
    this._escala(c, K);
  }
  _arestasExternas() {
    const lista = [];
    for (const a of this.partes) for (let i = 0; i < a.vertices.length; i++) {
      const p = a.vertices[i], q = a.vertices[(i + 1) % a.vertices.length], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      let n = 0;
      for (const o of this.partes) for (let j = 0; j < o.vertices.length; j++) if (naAresta(m, o.vertices[j], o.vertices[(j + 1) % o.vertices.length])) { n++; break; }
      if (n === 1) lista.push({ p, q });
    }
    return lista;
  }
  _bussola(c, K) {
    // bússola de 56 px de diâmetro
    const [cx, cy] = this._centroBussola(), r = 28, rot = (this.norte * Math.PI) / 180;
    c.fillStyle = K.fundo; c.strokeStyle = K.grade5; c.lineWidth = 1.5; c.beginPath(); c.arc(cx, cy, r - 0.75, 0, 7); c.fill(); c.stroke();
    ['N', 'L', 'S', 'O'].forEach((d, i) => {
      const a = rot + (i * Math.PI) / 2, x = cx + Math.sin(a) * (r - 9), y = cy - Math.cos(a) * (r - 9);
      c.fillStyle = d === 'N' ? K.tinta : K.suave; c.font = `${d === 'N' ? 700 : 500} ${d === 'N' ? 12 : 11}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(d, x, y);
    });
    // ponteiro do norte (âmbar) com alça para girar
    const nx = cx + Math.sin(rot) * (r - 17), ny = cy - Math.cos(rot) * (r - 17);
    c.strokeStyle = K.sol; c.lineWidth = 3; c.beginPath(); c.moveTo(cx - Math.sin(rot) * 6, cy + Math.cos(rot) * 6); c.lineTo(nx, ny); c.stroke();
    c.fillStyle = K.sol; c.beginPath(); c.arc(cx, cy, 3, 0, 7); c.fill();
    c.textBaseline = 'alphabetic';
  }
  _escala(c, K) {
    const ops = [1, 2, 5, 10, 20], mm = ops.find((x) => x * this.escala >= 50) || 20, px = mm * this.escala;
    c.strokeStyle = K.tinta; c.lineWidth = 2; c.beginPath(); c.moveTo(12, this.h - 12); c.lineTo(12 + px, this.h - 12); c.moveTo(12, this.h - 17); c.lineTo(12, this.h - 7); c.moveTo(12 + px, this.h - 17); c.lineTo(12 + px, this.h - 7); c.stroke();
    c.fillStyle = K.tinta; c.font = '11px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(`${mm} m`, 12 + px / 2, this.h - 18);
  }
}
