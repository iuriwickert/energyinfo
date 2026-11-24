/**
 * apis.js — coleta rápida (especificação, seção 5). Só APIs públicas, com limite de 8 s e reserva.
 * PRIVACIDADE: nada é gravado (nem localStorage, nem Firebase). O cache vive só na memória da aba.
 *
 * CORS testado em 2026-11-16 (origem localhost):
 *   BrasilAPI, ViaCEP, IBGE, NASA POWER, Open-Meteo (geocodificação e arquivo): liberados.
 *   ANEEL Dados Abertos: responde, mas sem Access-Control-Allow-Origin -> bloqueado no navegador.
 *   Por isso a tarifa cai na tabela da ANEEL embutida em parametros.js (extraída em 2026-11-16).
 */
import { tarifaFinal } from './parametros.js';

const ESPERA_MS = 8000;
const memoria = new Map(); // cache só em memória

async function buscarJson(url) {
  if (memoria.has(url)) return memoria.get(url);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ESPERA_MS);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    memoria.set(url, j);
    return j;
  } finally { clearTimeout(t); }
}

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** CEP -> { cidade, uf, lat, lon } (lat/lon podem vir nulos) */
export async function buscarCep(cep) {
  cep = String(cep).replace(/\D/g, '');
  if (cep.length !== 8) throw new Error('cep-invalido');
  try {
    const d = await buscarJson(`https://brasilapi.com.br/api/cep/v2/${cep}`);
    const c = d.location && d.location.coordinates;
    const lat = c && c.latitude ? parseFloat(c.latitude) : NaN, lon = c && c.longitude ? parseFloat(c.longitude) : NaN;
    return { cidade: d.city, uf: d.state, lat: isFinite(lat) ? lat : null, lon: isFinite(lon) ? lon : null, fonte: 'BrasilAPI' };
  } catch (e) {
    const d = await buscarJson(`https://viacep.com.br/ws/${cep}/json/`);
    if (d.erro) throw new Error('cep-invalido');
    return { cidade: d.localidade, uf: d.uf, lat: null, lon: null, fonte: 'ViaCEP' };
  }
}

/** Plano B de coordenadas: geocodificação da cidade (Open-Meteo) */
export async function geocodificar(cidade, nomeUF) {
  const d = await buscarJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=10&language=pt&countryCode=BR`);
  const lista = d.results || [];
  const achou = lista.find((r) => norm(r.admin1) === norm(nomeUF) && norm(r.name) === norm(cidade)) || lista.find((r) => norm(r.admin1) === norm(nomeUF));
  if (!achou) throw new Error('sem-coordenadas');
  return { lat: achou.latitude, lon: achou.longitude };
}

export async function ibgeEstados() {
  const d = await buscarJson('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
  return d.map((e) => ({ sigla: e.sigla, nome: e.nome, regiao: e.regiao.sigla }));
}
export async function ibgeMunicipios(uf) {
  const d = await buscarJson(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
  return d.map((m) => m.nome);
}

const MESES_API = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Clima mensal: NASA POWER (principal) ou Open-Meteo (reserva) */
export async function buscarClima(lat, lon) {
  try {
    const d = await buscarJson(`https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN,T2M,T2M_MAX&community=RE&longitude=${lon.toFixed(3)}&latitude=${lat.toFixed(3)}&format=JSON`);
    const p = d.properties.parameter;
    const un = String(d.parameters?.ALLSKY_SFC_SW_DWN?.units || 'kW-hr/m^2/day').toLowerCase();
    const conv = un.includes('mj') ? 1 / 3.6 : 1; // lê a unidade da própria resposta
    const ghi = MESES_API.map((m) => p.ALLSKY_SFC_SW_DWN[m] * conv);
    if (ghi.some((g) => !(g > 0 && g < 12))) throw new Error('dados-invalidos');
    return { lat, ghi, ghiAnual: p.ALLSKY_SFC_SW_DWN.ANN * conv, t2m: MESES_API.map((m) => p.T2M[m]), t2mMax: MESES_API.map((m) => p.T2M_MAX[m]), fonte: 'NASA POWER' };
  } catch {
    const ano = new Date().getFullYear() - 1;
    const d = await buscarJson(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&start_date=${ano}-01-01&end_date=${ano}-12-31&daily=shortwave_radiation_sum,temperature_2m_mean,temperature_2m_max&timezone=auto`);
    const s = Array(12).fill(0), t = Array(12).fill(0), tx = Array(12).fill(0), n = Array(12).fill(0);
    d.daily.time.forEach((dia, i) => {
      if (d.daily.shortwave_radiation_sum[i] == null) return;
      const m = parseInt(dia.slice(5, 7), 10) - 1;
      s[m] += d.daily.shortwave_radiation_sum[i] / 3.6; t[m] += d.daily.temperature_2m_mean[i]; tx[m] += d.daily.temperature_2m_max[i]; n[m]++;
    });
    const ghi = s.map((v, i) => v / n[i]);
    return { lat, ghi, ghiAnual: ghi.reduce((a, b) => a + b, 0) / 12, t2m: t.map((v, i) => v / n[i]), t2mMax: tx.map((v, i) => v / n[i]), fonte: 'Open-Meteo.com' };
  }
}

/* ---------------- ANEEL ---------------- */
/**
 * Tarifa B1 residencial da distribuidora, pela tabela da ANEEL embutida em parametros.js.
 * A API da ANEEL não libera CORS para o navegador (testado em 2026-11-16): chamá-la só
 * deixaria um erro no console a cada busca, então o site usa direto a tabela extraída dela.
 * Retorna { tarifa (R$/kWh com tributos), sigla, nome, fonte }.
 */
export async function buscarTarifa(sigla, parametros) {
  const trib = parametros.tributos.valor;
  const t = parametros.tarifasAneel.valor[sigla];
  if (!t) throw new Error('sem-tarifa');
  return { tarifa: tarifaFinal(t.tusd, t.te, trib), sigla, nome: t.nome, fonte: `ANEEL (tabela de ${parametros.tarifasAneel.data.split('-').reverse().join('/')})` };
}
