/**
 * parametros.js — valores-base (espelho da coleção "parametros" do Firebase, especificação seção 8).
 * O Firebase só é LIDO: carregarParametros() recebe uma função de leitura e valida as faixas,
 * porque o banco é aberto e qualquer pessoa pode alterar os valores.
 */

/** Tarifa B1 residencial convencional vigente (ANEEL Dados Abertos, "Tarifa de Aplicação",
 *  R$/MWh sem tributos), extraída em 2026-11-16 do resource_id fcf2906c-7c32-4b9b-a637-054e7a5234f4.
 *  Reserva usada porque a API da ANEEL não libera CORS para o navegador. */
const ANEEL_B1 = {
  'EAC': [715.85, 113.86, 'Energisa Acre'], 'EQUATORIAL AL': [650.34, 201.07, 'Equatorial Alagoas'],
  'CEA': [784.10, 41.05, 'CEA Equatorial'], 'Âmbar Amazonas': [594.60, 281.11, 'Amazonas Energia'],
  'COELBA': [620.08, 257.65, 'Neoenergia Coelba'], 'SULGIPE': [529.09, 189.72, 'Sulgipe'],
  'ENEL CE': [488.49, 213.26, 'Enel Ceará'], 'Neoenergia Brasília': [453.47, 380.82, 'Neoenergia Brasília'],
  'EDP ES': [506.32, 337.39, 'EDP Espírito Santo'], 'ELFSM': [490.53, 334.36, 'ELFSM'],
  'EQUATORIAL GO': [617.38, 337.01, 'Equatorial Goiás'], 'CHESP': [529.06, 290.69, 'Chesp'],
  'EQUATORIAL MA': [607.54, 281.30, 'Equatorial Maranhão'], 'EMT': [605.28, 294.14, 'Energisa Mato Grosso'],
  'EMS': [662.01, 324.59, 'Energisa Mato Grosso do Sul'], 'CEMIG-D': [593.08, 310.21, 'Cemig'],
  'EMR': [558.10, 360.89, 'Energisa Minas Rio'], 'DMED': [396.43, 221.14, 'DME Poços de Caldas'],
  'EQUATORIAL PA': [754.30, 288.92, 'Equatorial Pará'], 'EPB': [460.32, 249.38, 'Energisa Paraíba'],
  'COPEL-DIS': [457.17, 310.85, 'Copel'], 'COCEL': [441.34, 293.03, 'Cocel'],
  'Neoenergia PE': [535.21, 263.65, 'Neoenergia Pernambuco'], 'EQUATORIAL PI': [647.22, 299.47, 'Equatorial Piauí'],
  'LIGHT SESA': [578.56, 302.00, 'Light'], 'ENEL RJ': [731.72, 329.38, 'Enel Rio'],
  'COSERN': [482.36, 293.44, 'Neoenergia Cosern'], 'CEEE-D': [478.63, 343.37, 'CEEE Equatorial'],
  'RGE': [588.50, 356.11, 'RGE (CPFL)'], 'ERO': [703.59, 58.85, 'Energisa Rondônia'],
  'Âmbar Roraima': [444.78, 344.69, 'Roraima Energia'], 'CELESC': [414.04, 345.71, 'Celesc'],
  'ELETROPAULO': [472.42, 316.96, 'Enel São Paulo'], 'CPFL-PAULISTA': [449.25, 290.20, 'CPFL Paulista'],
  'CPFL-PIRATINING': [430.40, 328.42, 'CPFL Piratininga'], 'ELEKTRO': [565.27, 326.36, 'Neoenergia Elektro'],
  'EDP SP': [469.44, 332.24, 'EDP São Paulo'], 'CPFL Santa Cruz': [560.39, 252.19, 'CPFL Santa Cruz'],
  'ESS': [492.68, 321.56, 'Energisa Sul-Sudeste'], 'ESE': [482.80, 271.81, 'Energisa Sergipe'],
  'ETO': [683.27, 309.51, 'Energisa Tocantins'],
};

/** UF: nome, região, capital (coordenadas de reserva), HSP aproximado e distribuidoras (a 1ª é a principal) */
const UFS = {
  AC: ['Acre', 'N', -9.97, -67.81, 4.6, ['EAC']],
  AL: ['Alagoas', 'NE', -9.67, -35.74, 5.4, ['EQUATORIAL AL']],
  AP: ['Amapá', 'N', 0.03, -51.07, 4.9, ['CEA']],
  AM: ['Amazonas', 'N', -3.12, -60.02, 4.5, ['Âmbar Amazonas']],
  BA: ['Bahia', 'NE', -12.97, -38.50, 5.5, ['COELBA', 'SULGIPE']],
  CE: ['Ceará', 'NE', -3.73, -38.53, 5.6, ['ENEL CE']],
  DF: ['Distrito Federal', 'CO', -15.79, -47.88, 5.4, ['Neoenergia Brasília']],
  ES: ['Espírito Santo', 'SE', -20.32, -40.34, 5.0, ['EDP ES', 'ELFSM']],
  GO: ['Goiás', 'CO', -16.69, -49.26, 5.4, ['EQUATORIAL GO', 'CHESP']],
  MA: ['Maranhão', 'NE', -2.53, -44.30, 5.2, ['EQUATORIAL MA']],
  MT: ['Mato Grosso', 'CO', -15.60, -56.10, 5.3, ['EMT']],
  MS: ['Mato Grosso do Sul', 'CO', -20.47, -54.62, 5.3, ['EMS']],
  MG: ['Minas Gerais', 'SE', -19.92, -43.94, 5.3, ['CEMIG-D', 'EMR', 'DMED']],
  PA: ['Pará', 'N', -1.46, -48.49, 4.9, ['EQUATORIAL PA']],
  PB: ['Paraíba', 'NE', -7.12, -34.86, 5.6, ['EPB']],
  PR: ['Paraná', 'S', -25.43, -49.27, 4.7, ['COPEL-DIS', 'COCEL']],
  PE: ['Pernambuco', 'NE', -8.05, -34.88, 5.5, ['Neoenergia PE']],
  PI: ['Piauí', 'NE', -5.09, -42.80, 5.6, ['EQUATORIAL PI']],
  RJ: ['Rio de Janeiro', 'SE', -22.91, -43.17, 4.9, ['LIGHT SESA', 'ENEL RJ', 'EMR']],
  RN: ['Rio Grande do Norte', 'NE', -5.79, -35.21, 5.7, ['COSERN']],
  RS: ['Rio Grande do Sul', 'S', -30.03, -51.23, 4.6, ['CEEE-D', 'RGE']],
  RO: ['Rondônia', 'N', -8.76, -63.90, 4.8, ['ERO']],
  RR: ['Roraima', 'N', 2.82, -60.67, 5.0, ['Âmbar Roraima']],
  SC: ['Santa Catarina', 'S', -27.59, -48.55, 4.5, ['CELESC']],
  SP: ['São Paulo', 'SE', -23.55, -46.63, 4.9, ['ELETROPAULO', 'CPFL-PAULISTA', 'CPFL-PIRATINING', 'ELEKTRO', 'EDP SP', 'CPFL Santa Cruz', 'ESS']],
  SE: ['Sergipe', 'NE', -10.91, -37.07, 5.4, ['ESE', 'SULGIPE']],
  TO: ['Tocantins', 'N', -10.18, -48.33, 5.4, ['ETO']],
};

export const REGIOES = { N: 'Norte', NE: 'Nordeste', CO: 'Centro-Oeste', SE: 'Sudeste', S: 'Sul' };

export function parametrosPadrao() {
  const ufs = {};
  for (const [sigla, [nome, regiao, lat, lon, hsp, dist]] of Object.entries(UFS)) ufs[sigla] = { sigla, nome, regiao, lat, lon, hsp, distribuidoras: dist };
  const tarifas = {};
  for (const [sig, [tusd, te, nome]] of Object.entries(ANEEL_B1)) tarifas[sig] = { sigla: sig, nome, tusd, te };
  return {
    precoWpRegiao: { valor: { N: 4.00, NE: 3.55, CO: 3.60, SE: 3.50, S: 3.40 }, fonte: 'Estimativa (Cenário Energia 2026: R$ 3,40 a 4,20/Wp ao consumidor)', data: '2026-11-16' },
    fioB: { valor: { 2026: 0.60, 2027: 0.75, 2028: 0.90, 2029: 1.00 }, fonte: 'Lei 14.300/2022 (2029+ = 100% por prudência)', data: '2026-11-16' },
    fatorFioB: { valor: 0.28, fonte: 'Parcela do Fio B na tarifa final [assumido]', data: '2026-11-16' },
    tributos: { valor: 0.25, fonte: 'ICMS + PIS/COFINS médio [assumido]; corrija pela sua conta', data: '2026-11-16' },
    disponibilidade: { valor: { mono: 30, bi: 50, tri: 100 }, fonte: 'REN ANEEL 1.000/2021', data: '2026-11-16' },
    temperaturaRegiao: { valor: { N: [27, 32], NE: [26, 30], CO: [25, 31], SE: [22, 27], S: [19, 24] }, fonte: 'Médias aproximadas (reserva)', data: '2026-11-16' },
    ufs: { valor: ufs, fonte: 'IBGE (nomes), capitais (coordenadas de reserva), HSP aproximado (Atlas Solar)', data: '2026-11-16' },
    tarifasAneel: { valor: tarifas, fonte: 'ANEEL Dados Abertos, tarifa B1 residencial vigente', data: '2026-11-16' },
  };
}

const faixa = (v, a, b) => typeof v === 'number' && isFinite(v) && v >= a && v <= b;

/** Valida um documento lido do Firebase; devolve o valor aceito ou null (ignora o que estiver fora da faixa) */
function validar(id, valor) {
  switch (id) {
    case 'precoWpRegiao': {
      const ok = {}; for (const r of Object.keys(REGIOES)) if (faixa(valor?.[r], 2, 8)) ok[r] = valor[r];
      return Object.keys(ok).length ? ok : null;
    }
    case 'fioB': {
      const ok = {}; for (const [a, v] of Object.entries(valor || {})) if (faixa(+a, 2020, 2100) && faixa(v, 0, 1)) ok[a] = v;
      return Object.keys(ok).length ? ok : null;
    }
    case 'fatorFioB': return faixa(valor, 0, 0.6) ? valor : null;
    case 'tributos': return faixa(valor, 0, 0.5) ? valor : null;
    case 'disponibilidade': return faixa(valor?.mono, 0, 200) && faixa(valor?.bi, 0, 200) && faixa(valor?.tri, 0, 300) ? valor : null;
    default: return null; // demais tabelas: só do código (evita quebrar a página)
  }
}

/**
 * Lê a coleção "parametros" (somente leitura) e mescla sobre os padrões.
 * lerColecao: async () => [{ id, valor, fonte, data }]. Exemplo com Firebase v10 (modular):
 *   const snap = await getDocs(collection(db, 'parametros'));
 *   return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
 */
export async function carregarParametros(lerColecao) {
  const p = parametrosPadrao();
  if (typeof lerColecao !== 'function') return p;
  try {
    const docs = await Promise.race([lerColecao(), new Promise((_, rej) => setTimeout(() => rej(new Error('tempo')), 8000))]);
    for (const d of docs || []) {
      const v = validar(d.id, d.valor);
      if (v != null && p[d.id]) p[d.id] = { valor: typeof v === 'object' ? { ...p[d.id].valor, ...v } : v, fonte: String(d.fonte || p[d.id].fonte), data: String(d.data || p[d.id].data) };
    }
  } catch { /* sem Firebase: segue com os padrões */ }
  return p;
}

/** Tarifa final com tributos (R$/kWh) a partir de TUSD + TE (R$/MWh) */
export function tarifaFinal(tusd, te, tributos) { return (tusd + te) / 1000 / (1 - tributos); }
