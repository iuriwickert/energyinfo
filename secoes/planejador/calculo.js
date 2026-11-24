/**
 * calculo.js — motor de cálculo do Planejador Solar (especificação, seção 6).
 * Funções puras: sem DOM, sem rede, sem armazenamento. Usado pela interface e pelos testes.
 */

export const DIAS_REP = [17, 47, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344]; // Klein
export const DIAS_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const GSC = 1367;
const rad = (g) => (g * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const soma = (a) => a.reduce((s, x) => s + x, 0);
const media = (a) => soma(a) / a.length;

/* ------------------------------------------------------------------ */
/* Geometria solar (6.3-B)                                            */
/* ------------------------------------------------------------------ */
export function declinacao(n) { return 23.45 * Math.sin(rad((360 * (284 + n)) / 365)); }
function anguloPorDoSol(lat, dec) { return deg(Math.acos(clamp(-Math.tan(rad(lat)) * Math.tan(rad(dec)), -1, 1))); }

/** Irradiação extraterrestre diária na horizontal (kWh/m²/dia) */
export function H0(lat, n) {
  const d = declinacao(n), ws = anguloPorDoSol(lat, d), f = rad(lat), dr = rad(d);
  const j = ((24 * 3600 * GSC) / Math.PI) * (1 + 0.033 * Math.cos(rad((360 * n) / 365))) *
    (Math.cos(f) * Math.cos(dr) * Math.sin(rad(ws)) + ((Math.PI * ws) / 180) * Math.sin(f) * Math.sin(dr));
  return j / 3.6e6;
}

/** Bússola (0 = norte, 90 = leste) -> convenção das fórmulas (0 = sul, leste negativo; norte = 180) */
export function bussolaParaGamma(a) {
  let g = a - 180;
  while (g > 180) g -= 360;
  while (g <= -180) g += 360;
  return g;
}

/** Clima de reserva quando só há a média anual: GHI_mês = KT · H0_mês, com média = HSP */
export function climaSintetico(lat, hspAnual, tMed, tMax) {
  const h0 = DIAS_REP.map((n) => H0(lat, n));
  const kt = hspAnual / media(h0);
  let ghi = h0.map((h) => h * kt);
  const k = hspAnual / media(ghi);
  ghi = ghi.map((g) => g * k);
  return { lat, ghi, ghiAnual: hspAnual, t2m: Array(12).fill(tMed), t2mMax: Array(12).fill(tMax), sintetico: true };
}

/** 6.3-A: método simplificado (geração por kWp) */
export function geracaoSimplificada(clima, perdas) {
  const anual = clima.ghiAnual * 365 * (1 - perdas);
  const bruto = clima.ghi.map((g, i) => g * DIAS_MES[i]);
  const k = anual / soma(bruto);
  return { mensal: bruto.map((b) => b * k), anual };
}

/** 6.3-B: método completo (geração por kWp de uma superfície) */
export function geracaoCompleta(clima, beta, azimuteBussola, o = {}) {
  const lat = clima.lat, f = rad(lat), b = rad(beta), g = rad(bussolaParaGamma(azimuteBussola));
  const albedo = o.albedo ?? 0.2, coef = (o.coefTemp ?? -0.35) / 100, noct = o.noct ?? 45;
  const perdas = o.perdas ?? 0.14, fInv = o.fatorInversor ?? 1;
  const mensal = [];
  for (let m = 0; m < 12; m++) {
    const n = DIAS_REP[m], d = declinacao(n), dr = rad(d);
    const ws = anguloPorDoSol(lat, d), wsr = rad(ws);
    const H = clima.ghi[m], h0 = H0(lat, n);
    const KT = clamp(h0 > 0 ? H / h0 : 0.5, 0.2, 0.8);
    const fd = ws <= 81.4
      ? 1.391 - 3.560 * KT + 4.189 * KT ** 2 - 2.137 * KT ** 3
      : 1.311 - 3.022 * KT + 3.427 * KT ** 2 - 1.821 * KT ** 3;
    const Hd = H * clamp(fd, 0, 1);
    const a = 0.409 + 0.5016 * Math.sin(rad(ws - 60)), bb = 0.6609 - 0.4767 * Math.sin(rad(ws - 60));
    const den = Math.sin(wsr) - ((Math.PI * ws) / 180) * Math.cos(wsr);
    const horas = [];
    for (let h = 0; h < 24; h++) {
      const w = 15 * (h + 0.5 - 12);
      if (Math.abs(w) >= ws) continue;
      const wr = rad(w);
      horas.push({
        wr,
        rt: Math.max((Math.PI / 24) * (a + bb * Math.cos(wr)) * (Math.cos(wr) - Math.cos(wsr)) / den, 0),
        rd: Math.max((Math.PI / 24) * (Math.cos(wr) - Math.cos(wsr)) / den, 0),
      });
    }
    // ajuste do Code: normaliza a soma horária para reproduzir H e Hd do dia
    const sRt = soma(horas.map((x) => x.rt)) || 1, sRd = soma(horas.map((x) => x.rd)) || 1;
    let HT = 0;
    for (const x of horas) {
      const I = (x.rt / sRt) * H, Id = Math.min((x.rd / sRd) * Hd, I);
      const cz = Math.sin(f) * Math.sin(dr) + Math.cos(f) * Math.cos(dr) * Math.cos(x.wr);
      const ct = Math.sin(dr) * Math.sin(f) * Math.cos(b)
        - Math.sin(dr) * Math.cos(f) * Math.sin(b) * Math.cos(g)
        + Math.cos(dr) * Math.cos(f) * Math.cos(b) * Math.cos(x.wr)
        + Math.cos(dr) * Math.sin(f) * Math.sin(b) * Math.cos(g) * Math.cos(x.wr)
        + Math.cos(dr) * Math.sin(b) * Math.sin(g) * Math.sin(x.wr);
      const Rb = cz <= 0.02 ? 0 : Math.min(Math.max(0, ct) / cz, 5); // ajuste do Code: Rb limitado a 5
      HT += Math.max((I - Id) * Rb + Id * (1 + Math.cos(b)) / 2 + I * albedo * (1 - Math.cos(b)) / 2, 0);
    }
    const tDia = ((clima.t2m[m] ?? 25) + (clima.t2mMax[m] ?? 30)) / 2;
    const fT = 1 + coef * (tDia + (noct - 20) * (600 / 800) - 25);
    mensal.push(HT * DIAS_MES[m] * fT * (1 - perdas) * fInv);
  }
  return { mensal, anual: soma(mensal) };
}

/** Inclinação recomendada para painéis em laje: |latitude|, mínimo de 10° */
export function inclinacaoLaje(lat) { return Math.max(10, Math.round(Math.abs(lat))); }

/**
 * Qualidade de sol de uma superfície em relação à melhor posição no local
 * (norte, inclinação ≈ |latitude|). Limiares [assumido]: ≥ 95% recomendada; ≥ 85% pode usar.
 */
export function classificarSuperficie(clima, beta, azimute, opts = {}) {
  const ref = geracaoCompleta(clima, inclinacaoLaje(clima.lat), 0, opts).anual;
  const y = geracaoCompleta(clima, beta, azimute, opts).anual;
  const r = ref > 0 ? y / ref : 0;
  return { y, r, classe: r >= 0.95 ? 'recomendada' : r >= 0.85 ? 'pode' : 'nao' };
}

/* ------------------------------------------------------------------ */
/* Custos (6.5) e "Para onde vai o dinheiro"                          */
/* ------------------------------------------------------------------ */
export function custoSistema(kWp, precoWp) {
  if (kWp <= 0) return 0;
  return kWp * 1000 * precoWp * clamp(1.25 - 0.05 * kWp, 0.9, 1.2);
}

const TAMANHOS_INVERSOR = [1.5, 2, 3, 3.6, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 100];
export function inversorComercial(kWp, ccca = 1.2) {
  const alvo = kWp / ccca;
  return TAMANHOS_INVERSOR.find((t) => t >= alvo) ?? Math.ceil(alvo);
}

/**
 * SUPOSIÇÃO: pesos-base da divisão do custo, a calibrar com orçamentos reais.
 * A soma é 100%: sem edição, o total é exatamente o da regra 6.5.
 */
export const ITENS_CUSTO = [
  { id: 'paineis', nome: 'Painéis', peso: 0.40, unidade: 'R$/Wp' },
  { id: 'inversor', nome: 'Inversor', peso: 0.18, unidade: 'R$/kW' },
  { id: 'estrutura', nome: 'Estrutura de fixação', peso: 0.09, unidade: 'R$/painel' },
  { id: 'cabos', nome: 'Cabos, proteções e string box', peso: 0.07, unidade: 'R$/kWp' },
  { id: 'maoObra', nome: 'Mão de obra', peso: 0.14, unidade: 'R$/kWp' },
  { id: 'projeto', nome: 'Projeto e homologação', peso: 0.06, unidade: 'R$' },
  { id: 'frete', nome: 'Frete, impostos e outros', peso: 0.06, unidade: '% do total' },
];
/** SUPOSIÇÃO: custo relativo da estrutura por tipo de telhado (cerâmico = referência) */
export const FATOR_ESTRUTURA = { ceramico: 1.0, metalico: 0.8, fibrocimento: 0.9, laje: 1.35 };

/**
 * Divide o custo do sistema nos itens.
 * edicoes: { paineis: R$/Wp, inversor: R$/kW, estrutura: R$/painel, cabos: R$/kWp, maoObra: R$/kWp, projeto: R$, frete: %, tipoEstrutura }
 * Sem edição: total = regra 6.5 repartida pelos pesos. Com edição: total = soma dos itens.
 */
export function custoItens({ N, wp, precoWp, ccca = 1.2, tipoPadrao = 'ceramico', edicoes = {} }) {
  const kWp = (N * wp) / 1000;
  const base = custoSistema(kWp, precoWp);
  const invKw = inversorComercial(kWp, ccca);
  const q = { paineis: kWp * 1000, inversor: invKw, estrutura: N, cabos: kWp, maoObra: kWp, projeto: 1 };
  const unitBase = {};
  for (const it of ITENS_CUSTO) if (it.id !== 'frete') unitBase[it.id] = q[it.id] > 0 ? (base * it.peso) / q[it.id] : 0;
  unitBase.frete = 6;
  const tipo = edicoes.tipoEstrutura || tipoPadrao;
  const ed = (id) => edicoes[id] != null && isFinite(edicoes[id]);
  const editouTipo = tipo !== tipoPadrao;
  const valores = {};
  for (const it of ITENS_CUSTO) {
    if (it.id === 'frete') continue;
    let v = ed(it.id) ? edicoes[it.id] * q[it.id] : base * it.peso;
    if (it.id === 'estrutura' && editouTipo) v *= (FATOR_ESTRUTURA[tipo] ?? 1) / (FATOR_ESTRUTURA[tipoPadrao] ?? 1);
    valores[it.id] = v;
  }
  const editado = ITENS_CUSTO.some((it) => ed(it.id)) || editouTipo;
  const subtotal = soma(Object.values(valores));
  let total, frete;
  if (!editado) { frete = base * 0.06; total = base; }
  else {
    const p = (ed('frete') ? edicoes.frete : 6) / 100;
    total = subtotal / (1 - clamp(p, 0, 0.5));
    frete = total - subtotal;
  }
  valores.frete = frete;
  const itens = ITENS_CUSTO.map((it) => ({
    ...it, valor: valores[it.id], pct: total > 0 ? valores[it.id] / total : 0,
    unitario: ed(it.id) ? edicoes[it.id] : unitBase[it.id], unitarioBase: unitBase[it.id], editado: ed(it.id) || (it.id === 'estrutura' && editouTipo),
  }));
  return { base, total, itens, editado, diferenca: base > 0 ? total / base - 1 : 0, tipo, invKw };
}

/* ------------------------------------------------------------------ */
/* Lei 14.300 (6.6)                                                   */
/* ------------------------------------------------------------------ */
export function pctFioB(ano, tabela, antigo) {
  if (antigo) return 0;
  const anos = Object.keys(tabela).map(Number).sort((a, b) => a - b);
  if (ano < anos[0]) return 0;
  let v = 0;
  for (const a of anos) if (ano >= a) v = tabela[a];
  return v;
}
export function fatorValor(ano, e) {
  const s = e.autoconsumoPct / 100;
  return s + (1 - s) * (1 - pctFioB(ano, e.fioB, e.sistemaAntigo) * e.fatorFioB);
}

/* ------------------------------------------------------------------ */
/* Fluxo de caixa (6.7) e indicadores (6.8)                           */
/* ------------------------------------------------------------------ */
export function paybackInterpolado(saldos, fcs) {
  for (let y = 1; y < saldos.length; y++) {
    if (saldos[y] >= 0) return saldos[y - 1] >= 0 ? 0 : y - 1 + -saldos[y - 1] / fcs[y];
  }
  return null;
}

function fluxoDeCaixa(e, { E0, E_max, custo, T }) {
  const d1 = (e.painel.degr1 ?? 0) / 100, dA = (e.painel.degrAno ?? 0.7) / 100;
  const reaj = e.reajustePct / 100, om = (e.omPct / 100) * custo;
  const anoTroca = e.trocaInversorAno ?? 12;
  const custoTroca = e.trocaInversorCusto != null ? e.trocaInversorCusto : 0.12 * custo;
  const E1 = E0 * (1 - d1);
  const fin = e.financiamento;
  let pmt = 0, mesesFin = 0, entrada = custo;
  if (fin && fin.meses > 0) {
    entrada = clamp(fin.entrada || 0, 0, custo);
    const P = custo - entrada, i = (fin.jurosMesPct || 0) / 100;
    mesesFin = fin.meses;
    pmt = P <= 0 ? 0 : i === 0 ? P / mesesFin : (P * i) / (1 - Math.pow(1 + i, -mesesFin));
  }
  const linhas = [], saldos = [-custo], fcs = [0], saldosFin = [-entrada], fcsFin = [0];
  for (let y = 1; y <= 25; y++) {
    const ano = e.anoInicial - 1 + y;
    const E = E1 * Math.pow(1 - dA, y - 1);
    const Ty = T * Math.pow(1 + reaj, y - 1);
    const fv = fatorValor(ano, e);
    const econ = 12 * Math.min(E, E_max) * Ty * fv;
    const troca = y === anoTroca ? custoTroca : 0;
    const fc = econ - om - troca;
    saldos.push(saldos[y - 1] + fc); fcs.push(fc);
    const parcelas = pmt * clamp(mesesFin - (y - 1) * 12, 0, 12);
    saldosFin.push(saldosFin[y - 1] + fc - parcelas); fcsFin.push(fc - parcelas);
    linhas.push({ y, ano, E, T: Ty, fv, pctFioB: pctFioB(ano, e.fioB, e.sistemaAntigo), econ, om, troca, fc, saldo: saldos[y], parcelas, saldoFin: saldosFin[y] });
  }
  return { linhas, saldos, fcs, saldosFin, fcsFin, pmt, entrada, E1 };
}

function indicadores(f, e, custo) {
  const d = e.taxaDescontoPct / 100;
  const vplTaxa = (r) => soma(f.fcs.slice(1).map((fc, i) => fc / Math.pow(1 + r, i + 1))) - custo;
  let tir = null, lo = -0.5, hi = 2;
  if (vplTaxa(lo) * vplTaxa(hi) < 0) {
    for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; if (vplTaxa(lo) * vplTaxa(mid) <= 0) hi = mid; else lo = mid; }
    tir = (lo + hi) / 2;
  }
  const sd = [-custo], fd = [0];
  f.fcs.slice(1).forEach((fc, i) => { const v = fc / Math.pow(1 + d, i + 1); fd.push(v); sd.push(sd[i] + v); });
  let num = custo, den = 0;
  f.linhas.forEach((l) => { num += l.om / Math.pow(1 + d, l.y); den += (12 * l.E) / Math.pow(1 + d, l.y); });
  return { vpl: vplTaxa(d), tir, paybackDesc: paybackInterpolado(sd, fd), lcoe: den > 0 ? num / den : null };
}

/* ------------------------------------------------------------------ */
/* Entrada padrão e simulação                                         */
/* ------------------------------------------------------------------ */
export function entradaPadrao() {
  return {
    metodo: 'B', clima: null, consumoKwh: null, contaReais: null, tarifa: null, ligacao: 'bi',
    metas: { reais: null, kwh: null, coberturaPct: null, paybackAnos: null, maximo: false },
    limites: { orcamento: null, area: null, paineis: null },
    superficies: [],
    painel: { wp: 550, area: 2.58, coefTemp: -0.35, noct: 45, degr1: 2, degrAno: 0.7 },
    aproveitamento: 0.7, perdasPct: 14, efInversor: 97, ccca: 1.2, autoconsumoPct: 30, albedo: 0.2, sistemaAntigo: false,
    precoWp: 3.6, custoEdicoes: null, tipoEstrutura: 'ceramico',
    reajustePct: 6, omPct: 0.5, trocaInversorAno: 12, trocaInversorCusto: null,
    taxaDescontoPct: 10, financiamento: null, anoInicial: 2027,
    fioB: { 2026: 0.6, 2027: 0.75, 2028: 0.9, 2029: 1 }, fatorFioB: 0.28, disponibilidade: { mono: 30, bi: 50, tri: 100 },
    expert: false,
  };
}

/**
 * Simulação completa. superficies: [{ id, nome, inclinacao, azimute, areaUtil (m²) | null }]
 * (no método A só a capacidade de área importa).
 */
export function simular(parcial) {
  const p0 = entradaPadrao();
  const e = { ...p0, ...parcial, painel: { ...p0.painel, ...(parcial.painel || {}) }, metas: { ...p0.metas, ...(parcial.metas || {}) }, limites: { ...p0.limites, ...(parcial.limites || {}) } };
  const avisos = [];
  const T = e.tarifa;
  if (!(T > 0)) return { ok: false, erro: 'Falta a tarifa de energia.' };
  if (!e.clima) return { ok: false, erro: 'Falta a localização.' };

  // 6.1 consumo e metas
  let C = e.consumoKwh;
  if (!(C > 0) && e.contaReais > 0) C = e.contaReais / T;
  if (!(C > 0)) return { ok: false, erro: 'Falta o consumo (kWh) ou o valor da conta (R$).' };
  const D = e.disponibilidade[e.ligacao] ?? 50;
  const E_max = Math.max(C - D, 0);
  if (E_max <= 0) return { ok: false, erro: 'O consumo é menor que a taxa mínima da ligação: a energia solar não reduziria a conta.' };
  const fv1 = fatorValor(e.anoInicial, e);
  const metasE = [];
  if (e.metas.reais > 0) metasE.push(e.metas.reais / (T * fv1));
  if (e.metas.kwh > 0) metasE.push(e.metas.kwh);
  if (e.metas.coberturaPct > 0) metasE.push((e.metas.coberturaPct / 100) * C);
  if (e.metas.maximo) metasE.push(E_max);
  const E_meta = metasE.length ? Math.max(...metasE) : E_max;
  const E_alvo = Math.min(E_meta, E_max);
  if (E_meta > E_max + 0.5 && metasE.length && !e.metas.maximo) avisos.push('A sua meta pede mais energia do que você consome. Mostramos o máximo que faz sentido.');

  // 6.3 geração por kWp de cada superfície
  const perdas = e.perdasPct / 100, fInv = e.efInversor / 97;
  const opts = { perdas, fatorInversor: fInv, coefTemp: e.painel.coefTemp, noct: e.painel.noct, albedo: e.albedo };
  let sups = e.superficies && e.superficies.length ? e.superficies : [{ id: 'padrao', nome: 'Telhado', inclinacao: 20, azimute: 0, areaUtil: null }];
  sups = sups.map((a) => {
    const g = e.metodo === 'A' ? geracaoSimplificada(e.clima, perdas) : geracaoCompleta(e.clima, a.inclinacao, a.azimute, opts);
    return { ...a, Y: g.anual, mensalKwp: g.mensal, nMax: a.areaUtil != null ? Math.floor(a.areaUtil / e.painel.area) : Infinity };
  });
  // área digitada (sem desenho, ou menor que o desenho): limita o conjunto
  if (e.limites.area > 0) {
    const nArea = Math.floor((e.limites.area * e.aproveitamento) / e.painel.area);
    const totalDes = soma(sups.map((a) => (a.nMax === Infinity ? 0 : a.nMax)));
    if (sups.every((a) => a.nMax === Infinity) || nArea < totalDes) {
      if (sups.length === 1) sups[0].nMax = nArea;
      else { const tot = totalDes || sups.length; sups.forEach((a) => { a.nMax = Math.floor(nArea * ((a.nMax === Infinity ? 1 : a.nMax) / tot)); }); }
    }
  }

  // 6.4 dimensionamento: melhores superfícies primeiro
  const ordem = sups.slice().sort((a, b) => b.Y - a.Y);
  const pKw = e.painel.wp / 1000, alvoAnual = E_alvo * 12;
  let nMeta = 0, acum = 0;
  for (const a of ordem) {
    const yp = a.Y * pKw, falta = alvoAnual - acum;
    if (yp <= 0 || falta <= 1e-9) continue;
    const n = Math.min(Math.ceil(falta / yp - 1e-9), a.nMax === Infinity ? 1e9 : a.nMax);
    nMeta += n; acum += n * yp;
  }
  if (acum + 1e-9 < alvoAnual && ordem[0].Y > 0) nMeta += Math.ceil((alvoAnual - acum) / (ordem[0].Y * pKw));

  const custoN = (N) => (N <= 0 ? 0 : e.custoEdicoes
    ? custoItens({ N, wp: e.painel.wp, precoWp: e.precoWp, ccca: e.ccca, tipoPadrao: e.tipoEstrutura, edicoes: e.custoEdicoes }).total
    : custoSistema((N * e.painel.wp) / 1000, e.precoWp));
  const limites = [{ nome: 'área do telhado', n: soma(ordem.map((a) => (a.nMax === Infinity ? 1e9 : a.nMax))) }];
  if (e.limites.paineis > 0) limites.push({ nome: 'número máximo de painéis', n: Math.floor(e.limites.paineis) });
  if (e.limites.orcamento > 0) { let nb = 0; while (nb < 2000 && custoN(nb + 1) <= e.limites.orcamento) nb++; limites.push({ nome: 'orçamento', n: nb }); }
  let N = nMeta, limitePesou = null;
  for (const l of limites) if (l.n < N) { N = l.n; limitePesou = l.nome; }
  if (N < 1) return { ok: false, erro: 'Com esse orçamento e/ou essa área não cabe nem 1 painel. Aumente um dos limites.', limitePesou };

  let resto = N;
  const alocacao = ordem.map((a) => {
    const n = Math.min(resto, a.nMax === Infinity ? resto : a.nMax);
    resto -= n;
    return { id: a.id, nome: a.nome, n, kWp: n * pKw, Y: a.Y, anualKwh: n * pKw * a.Y, mensal: a.mensalKwp.map((v) => v * n * pKw), nMax: a.nMax, inclinacao: a.inclinacao, azimute: a.azimute };
  });
  const kWp = N * pKw;
  const geracaoMensal = Array.from({ length: 12 }, (_, m) => soma(alocacao.map((a) => a.mensal[m])));
  const E0 = soma(geracaoMensal) / 12;
  const pctMeta = Math.min(100, (Math.min(E0, E_alvo) / E_alvo) * 100);
  if (limitePesou) avisos.push(`O limite de ${limitePesou} pesou: atingimos ${pctMeta.toFixed(0)}% da meta.`);

  // 6.5 custo e divisão por item
  const custos = custoItens({ N, wp: e.painel.wp, precoWp: e.precoWp, ccca: e.ccca, tipoPadrao: e.tipoEstrutura, edicoes: e.custoEdicoes || {} });
  const custo = custos.total;

  // 6.6 / 6.7
  const f = fluxoDeCaixa(e, { E0, E_max, custo, T });
  const contaAntes = e.contaReais > 0 && !(e.consumoKwh > 0) ? e.contaReais : C * T;
  const econMes1 = Math.min(f.E1, E_max) * T * fv1;
  const contaDepois = Math.max(contaAntes - econMes1, D * T);
  const payback = paybackInterpolado(f.saldos, f.fcs);
  if (e.metas.paybackAnos > 0 && (payback == null || payback > e.metas.paybackAnos)) {
    avisos.push(`O retorno calculado (${formatarAnos(payback)}) passa do prazo que você pediu (${e.metas.paybackAnos} anos).`);
  }
  const res = {
    ok: true, avisos, metodo: e.metodo, C, D, T, E_max, E_meta, E_alvo, N, nMeta, kWp, limitePesou, pctMeta,
    alocacao, geracaoMensal, geracaoMediaMes: E0, geracaoAno1Mes: f.E1, custo, faixa: [custo * 0.85, custo * 1.15], custos,
    inversorKw: custos.invKw, areaPaineis: N * e.painel.area, areaTelhado: (N * e.painel.area) / e.aproveitamento,
    contaAntes, contaDepois, econMes1, fluxo: f.linhas, saldos: f.saldos, payback, saldo25: f.saldos[25], fv1,
    premissas: { perdasPct: e.perdasPct, reajustePct: e.reajustePct, precoWp: e.precoWp, autoconsumoPct: e.autoconsumoPct, fioB: e.fioB, fatorFioB: e.fatorFioB, anoInicial: e.anoInicial, omPct: e.omPct, degr1: e.painel.degr1, degrAno: e.painel.degrAno, painelWp: e.painel.wp, trocaInversorAno: e.trocaInversorAno },
  };
  if (e.expert) {
    Object.assign(res, indicadores(f, e, custo));
    if (e.financiamento && e.financiamento.meses > 0) {
      res.financiado = { pmt: f.pmt, entrada: f.entrada, meses: e.financiamento.meses, saldos: f.saldosFin, payback: paybackInterpolado(f.saldosFin, f.fcsFin), saldo25: f.saldosFin[25] };
    }
    const cen = (nome, dT, dP, dR) => {
      const e2 = { ...e, reajustePct: e.reajustePct + dR, trocaInversorCusto: e.trocaInversorCusto != null ? e.trocaInversorCusto * dP : null };
      const f2 = fluxoDeCaixa(e2, { E0, E_max, custo: custo * dP, T: T * dT });
      return { nome, payback: paybackInterpolado(f2.saldos, f2.fcs), saldo25: f2.saldos[25] };
    };
    res.sensibilidade = [cen('Pessimista', 0.9, 1.15, -2), cen('Base', 1, 1, 0), cen('Otimista', 1.1, 0.85, 2)];
  }
  return res;
}

export function formatarAnos(a) {
  if (a == null) return 'mais de 25 anos';
  let anos = Math.floor(a), meses = Math.round((a - anos) * 12);
  if (meses === 12) { anos++; meses = 0; }
  const pa = anos === 1 ? '1 ano' : `${anos} anos`;
  if (meses === 0) return pa;
  const pm = meses === 1 ? '1 mês' : `${meses} meses`;
  return anos === 0 ? pm : `${pa} e ${pm}`;
}

/* ------------------------------------------------------------------ */
/* Precisão estimada (6.10) — também pura                             */
/* ------------------------------------------------------------------ */
export function precisaoEstimada(s) {
  const itens = [
    { nome: 'a localização (cidade)', pts: 35, ok: !!s.temLocal },
    { nome: 'o CEP', pts: 10, ok: !!s.temCep },
    { nome: 'o consumo em kWh', pts: 10, ok: !!s.consumoKwh, parcial: s.soConta ? 5 : 0 },
    { nome: 'a tarifa da sua conta', pts: 10, ok: !!s.tarifaDigitada, parcial: s.tarifaAneel ? 5 : 0 },
    { nome: 'o desenho do telhado', pts: 10, ok: !!s.telhadoDesenhado },
    { nome: 'o norte e a inclinação do telhado', pts: 10, ok: !!s.orientacaoInformada },
  ];
  if (s.expert) {
    itens.push({ nome: 'o sombreamento', pts: 5, ok: !!s.sombreamento });
    itens.push({ nome: 'os dados do módulo/inversor', pts: 5, ok: !!s.modulo });
  }
  const total = Math.min(90, soma(itens.map((i) => (i.ok ? i.pts : i.parcial || 0))));
  const falta = itens.filter((i) => !i.ok).map((i) => ({ ...i, ganho: i.pts - (i.parcial || 0) })).sort((a, b) => b.ganho - a.ganho);
  return { total, itens, falta };
}
