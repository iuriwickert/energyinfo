/**
 * ui.js — interface do Planejador Solar (v3). Ponto de entrada: initPlanejador(elementoRaiz, opcoes).
 * Os três modos usam o MESMO estado: trocar de modo não perde nada.
 * Privacidade: o estado vive só na memória da página (nada em localStorage nem no Firebase).
 */
import * as C from './calculo.js';
import * as API from './apis.js';
import { carregarParametros, REGIOES } from './parametros.js';
import { EditorTelhado, nomeDirecao } from './telhado.js';
import { criarCasinha } from './casinha.js';
import * as G from './graficos.js';
import * as H from './historico.js';

const fmtR = G.fmtR;
const fmtN = (v, d = 0) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function num(v) {
  if (v == null) return null;
  let s = String(v).trim(); if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s); return isFinite(n) ? n : NaN;
}
const getK = (o, k) => k.split('.').reduce((a, p) => (a == null ? a : a[p]), o);
const setK = (o, k, v) => { const ps = k.split('.'); const u = ps.pop(); ps.reduce((a, p) => a[p], o)[u] = v; };
const mascaraCep = (v) => { const d = String(v).replace(/\D/g, '').slice(0, 8); return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d; };

const ICONES = {
  tutorial: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10" cy="10" r="7.5"/><path d="M8.5 7v6l5-3z" fill="currentColor" stroke-linejoin="round"/></svg>',
  facilitado: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 15h4v-4h4V7h4"/><circle cx="4" cy="15" r="1.2" fill="currentColor"/></svg>',
  padrao: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10" cy="10" r="3.2"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/></svg>',
  expert: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 5h12M4 10h12M4 15h12"/><circle cx="7" cy="5" r="1.6" fill="currentColor"/><circle cx="13" cy="10" r="1.6" fill="currentColor"/><circle cx="9" cy="15" r="1.6" fill="currentColor"/></svg>',
  lapis: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M10.5 2.5l3 3L6 13H3v-3z"/></svg>',
};
const SVG_FORMA = {
  duas: '<svg viewBox="0 0 22 14" aria-hidden="true"><rect x="1" y="1" width="20" height="12" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M1 7h20" stroke="currentColor" stroke-width="1.4"/></svg>',
  uma: '<svg viewBox="0 0 22 14" aria-hidden="true"><rect x="1" y="1" width="20" height="12" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M11 4v6" stroke="currentColor" stroke-width="1.4"/></svg>',
  laje: '<svg viewBox="0 0 22 14" aria-hidden="true"><rect x="1" y="1" width="20" height="12" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 5h4M5 9h4M13 5h4M13 9h4" stroke="currentColor" stroke-width="1.8"/></svg>',
  livre: '<svg viewBox="0 0 22 14" aria-hidden="true"><path d="M1 1h12v5h8v7H1z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
};
const NOMES_FORMA = { duas: 'Duas partes', uma: 'Uma parte', laje: 'Laje (plano)', livre: 'Desenhar livre' };

const CAMPOS_EXPERT = {
  modulo: [['painel.wp', 'Potência', 'Wp', 300, 750, 550], ['painel.ef', 'Eficiência', '%', 15, 25, 21.3], ['painel.area', 'Área', 'm²', 1, 3.5, 2.58],
    ['painel.coefTemp', 'Coef. temperatura', '%/°C', -0.6, -0.2, -0.35], ['painel.noct', 'NOCT', '°C', 40, 50, 45], ['painel.degr1', 'Degradação 1º ano', '%', 0, 5, 2],
    ['painel.degrAno', 'Degradação anual', '%/ano', 0.2, 1.5, 0.7]],
  inversor: [['inv.ef', 'Eficiência', '%', 90, 99.5, 97], ['inv.kw', 'Potência', 'kW', 0.5, 100, null], ['inv.ccca', 'Relação CC/CA', '×', 0.8, 1.6, 1.2],
    ['inv.anoTroca', 'Ano da troca', 'ano', 1, 25, 12], ['inv.custoTroca', 'Custo da troca', 'R$', 0, 100000, null]],
  perdas: [['perda.sujeira', 'Sujeira', '%', 0, 20, 4], ['perda.sombra', 'Sombreamento', '%', 0, 40, 3], ['perda.cabos', 'Cabos', '%', 0, 10, 3],
    ['perda.descas', 'Descasamento', '%', 0, 10, 2], ['perda.indisp', 'Indisponibilidade', '%', 0, 10, 2]],
  financas: [['fin.precoWp', 'Preço-base instalado', 'R$/Wp', 2, 8, 'regiao'], ['fin.om', 'Manutenção anual', '% inv.', 0, 5, 0.5],
    ['fin.desconto', 'Taxa de desconto', '% a.a.', 0, 30, 10], ['fin.reajuste', 'Reajuste da tarifa', '% a.a.', 0, 20, 6],
    ['fin.autoconsumo', 'Consumo de dia', '%', 0, 100, 30], ['fin.albedo', 'Albedo do solo', '', 0, 0.9, 0.2],
    ['fin.aproveitamento', 'Aproveitamento', '%', 30, 95, 70], ['fin.entrada', 'Entrada', 'R$', 0, 500000, null],
    ['fin.juros', 'Juros', '% a.m.', 0, 5, null], ['fin.meses', 'Prazo', 'meses', 1, 240, null]],
};
const DEF = {}; Object.values(CAMPOS_EXPERT).flat().forEach((c) => { DEF[c[0]] = c[5]; });
const CASAS_CUSTO = { paineis: 2, inversor: 0, estrutura: 0, cabos: 0, maoObra: 0, projeto: 0, frete: 1 };
const TIPOS_ESTRUTURA = { ceramico: 'Cerâmico', metalico: 'Metálico', fibrocimento: 'Fibrocimento', laje: 'Laje' };
const TELHADO_PADRAO = { forma: 'duas', largura: 10, comprimento: 8 };

function estadoInicial() {
  return {
    modo: 'padrao', loc: null, clima: null, climaFonte: '', climaMedia: false,
    tarifa: null, tarifaFonte: null, tarifaRotulo: '', distSigla: null, distNome: null, hspUsuario: null, tempUsuario: null,
    consumoKwh: null, contaReais: null, ligacao: 'bi',
    metas: { reais: null, kwh: null, coberturaPct: null, paybackAnos: null }, maximo: false,
    limites: { orcamento: null, area: null, paineis: null }, areaEditada: false,
    telhadoTipo: 'comum', telhado: null, telhadoTocado: false, norteTocado: false, inclTocado: false, passoTelhado: 'forma', porParte: false,
    lajeManual: false, lajePainel: { inclinacao: null, azimute: 0 },
    expert: {}, sistemaAntigo: false, custoEd: {}, tipoEstrutura: null, abaAvancada: 'modulo',
    facil: { passo: 0, objetivos: new Set(), usarKwh: false, porLista: false, cep: '', uf: '', cidade: '', tel: null },
    res: null, invalidos: new Set(), listaLocal: false,
  };
}

export async function initPlanejador(raiz, opcoes = {}) {
  const P = await carregarParametros(opcoes.lerParametros);
  const UFS = P.ufs.valor;
  let S = estadoInicial();
  const $ = (s) => raiz.querySelector(s), $$ = (s) => Array.from(raiz.querySelectorAll(s));
  raiz.classList.add('pl-raiz');
  // Conta e banco vêm de fora (a casca): sem eles, o planejador funciona e só não salva.
  const banco = opcoes.banco || null;
  const usuario = () => (typeof opcoes.usuario === 'function' ? opcoes.usuario() : null);
  const abrirLogin = () => opcoes.abrirLogin?.();

  /* ======================= MONTAGEM ======================= */
  const campo = (k, rot, o = {}) => `<label class="pl-campo"><span class="pl-rotulo">${rot}</span><span class="pl-entrada">${o.pre ? `<span class="pl-un pl-un-pre">${o.pre}</span>` : ''}<input data-k="${k}"${o.exp ? ' data-exp="1"' : ''} data-min="${o.min}" data-max="${o.max}" inputmode="decimal" autocomplete="off" placeholder="${o.ph ?? ''}">${o.un ? `<span class="pl-un">${o.un}</span>` : ''}</span><span class="pl-erro"></span></label>`;
  const opcoesUF = (sel) => Object.entries(REGIOES).map(([r, nome]) => `<optgroup label="${nome}">${Object.values(UFS).filter((u) => u.regiao === r).sort((a, b) => a.nome.localeCompare(b.nome)).map((u) => `<option value="${u.sigla}"${sel === u.sigla ? ' selected' : ''}>${u.sigla} · ${u.nome}</option>`).join('')}</optgroup>`).join('');

  raiz.innerHTML = `
  <header class="pl-cab">
    <div><h2 id="pl-titulo">Planeje sua energia solar</h2><p class="pl-cab-sub">Quantos painéis, quanto custa e quando se paga</p></div>
    <div class="pl-cab-acoes">
    <button class="pl-btn" id="pl-historico" type="button">Histórico</button>
    <div class="pl-modos" role="tablist" aria-label="Modo de uso">
      <span class="pl-modos-ind" aria-hidden="true"></span>
      ${[['tutorial', 'Tutorial', 'Veja como usar'], ['padrao', 'Padrão', 'Metas e telhado'], ['expert', 'Expert', 'Todos os parâmetros']].map(([m, n, d]) =>
        `<button class="pl-modo" role="tab" id="pl-tab-${m}" data-modo="${m}" aria-controls="pl-corpo" aria-selected="false" tabindex="-1" title="${d}">${ICONES[m]}<span class="pl-modo-nome">${n}</span><span class="pl-modo-dica">${d}</span></button>`).join('')}
    </div>
    </div>
  </header>
  <div id="pl-corpo" role="tabpanel">
    <div class="pl-grade">
      <div class="pl-col">
        <article class="pl-card" aria-labelledby="pl-t-metas">
          <div class="pl-card-cab"><h3 class="pl-card-titulo" id="pl-t-metas">Metas</h3><span class="pl-card-nota">uma ou mais</span></div>
          <div class="pl-campos pl-campos-2">
            ${campo('metas.reais', 'Reduzir a conta', { pre: 'R$', un: '/mês', min: 1, max: 5000 })}
            ${campo('metas.kwh', 'Gerar', { un: 'kWh/mês', min: 1, max: 5000 })}
            ${campo('metas.coberturaPct', 'Cobrir do consumo', { un: '%', min: 1, max: 100 })}
            ${campo('metas.paybackAnos', 'Se pagar em até', { un: 'anos', min: 1, max: 25 })}
          </div>
        </article>
        <article class="pl-card" aria-labelledby="pl-t-lim">
          <div class="pl-card-cab"><h3 class="pl-card-titulo" id="pl-t-lim">Limitações</h3></div>
          <div class="pl-campos">
            ${campo('limites.orcamento', 'Orçamento máximo', { pre: 'R$', min: 3000, max: 500000 })}
            ${campo('limites.area', 'Área disponível', { un: 'm²', min: 2, max: 1000 }).replace('Área disponível', 'Área disponível <span id="pl-area-orig"></span>')}
            ${campo('limites.paineis', 'Máximo de painéis', { un: 'painéis', min: 1, max: 200 })}
            <div class="pl-campo"><span class="pl-rotulo" id="pl-rot-lig">Tipo de ligação (está na conta de luz)</span>
              <div class="pl-seg pl-seg-largo" role="group" aria-labelledby="pl-rot-lig" id="pl-ligacao">
                <button data-v="mono" aria-pressed="false">Monofásica</button><button data-v="bi" aria-pressed="true">Bifásica</button><button data-v="tri" aria-pressed="false">Trifásica</button>
              </div></div>
          </div>
        </article>
      </div>
      <div class="pl-col">
        <article class="pl-card" aria-labelledby="pl-t-local">
          <div class="pl-card-cab"><h3 class="pl-card-titulo" id="pl-t-local">Local e consumo</h3>
            <div class="pl-local-acoes"><span class="pl-msg" id="pl-msg-local" role="status" aria-live="polite"></span><button class="pl-link" id="pl-alterna-local">Não sei o CEP</button></div></div>
          <div class="pl-local-linha">
            <div class="pl-campo">
              <span class="pl-rotulo" id="pl-rot-local">CEP</span>
              <div class="pl-local-cep" data-local="cep"><span class="pl-entrada"><input id="pl-cep" inputmode="numeric" autocomplete="off" placeholder="00000-000" maxlength="9" aria-labelledby="pl-rot-local"></span><button class="pl-btn" id="pl-buscar" aria-label="Buscar dados do CEP">Buscar</button></div>
              <div class="pl-local-lista" data-local="lista" hidden>
                <select class="pl-select" id="pl-uf" aria-label="Estado (agrupado por região)"><option value="">UF</option>${opcoesUF('')}</select>
                <select class="pl-select" id="pl-cidade" aria-label="Cidade" disabled><option value="">Cidade</option></select>
              </div>
            </div>
            ${campo('consumoKwh', 'Consumo médio', { un: 'kWh/mês', min: 50, max: 5000 })}
            ${campo('contaReais', 'ou valor da conta', { pre: 'R$', un: '/mês', min: 30, max: 5000 })}
          </div>
          <div class="pl-etiquetas" id="pl-etiquetas" aria-label="Dados encontrados para o local"></div>
          <p class="pl-nota-cep">Usamos o CEP só para buscar dados da sua região. Não guardamos o seu endereço.</p>
        </article>
        <article class="pl-card pl-area" aria-labelledby="pl-t-area">
          <div class="pl-card-cab"><h3 class="pl-card-titulo" id="pl-t-area">Área disponível</h3>
            <div class="pl-seg" role="tablist" aria-label="Ajustes do telhado" id="pl-passos">
              <button role="tab" data-passo="forma" aria-selected="true">Forma</button><button role="tab" data-passo="norte" aria-selected="false">Norte</button><button role="tab" data-passo="inclinacao" aria-selected="false">Inclinação</button>
            </div></div>
          <div class="pl-casa" id="pl-casinha"></div>
          <div id="pl-passo-conteudo"></div>
          <div class="pl-tela"><canvas id="pl-canvas" tabindex="0" aria-label="Desenho do telhado visto de cima. Teclas [ e ] giram o norte; no desenho livre, setas movem o cursor e Enter marca um canto."></canvas></div>
          <div class="pl-partes" id="pl-partes" aria-live="polite"></div>
        </article>
      </div>
      <div class="pl-col">
        <article class="pl-card" id="pl-stats" aria-labelledby="pl-t-stats">
          <div class="pl-card-cab"><h3 class="pl-card-titulo" id="pl-t-stats">Sua simulação</h3></div>
          <div aria-live="polite" id="pl-precisao">
            <div class="pl-medidor" title="Nota informal de confiança, não é margem de erro."><span class="pl-medidor-rot">Dados preenchidos</span><div class="pl-medidor-barra"><span id="pl-prec-barra"></span></div><span class="pl-medidor-num" id="pl-prec-num">0%</span></div>
          </div>
          <ul class="pl-falta" id="pl-prec-falta" aria-label="O que falta para subir a precisão"></ul>
          <p class="pl-ajuda">Precisão estimada: nota informal de confiança, não é margem de erro.</p>
        </article>
        <article class="pl-card" id="pl-avancado" aria-labelledby="pl-t-av" hidden>
          <div class="pl-card-cab"><h3 class="pl-card-titulo" id="pl-t-av">Dados avançados</h3><span class="pl-card-nota">vazio = padrão</span></div>
          <div class="pl-abas-mini" role="tablist" aria-label="Grupos de dados avançados">
            ${[['modulo', 'Módulo'], ['inversor', 'Inversor'], ['perdas', 'Perdas'], ['custos', 'Custos'], ['financas', 'Finanças']].map(([k, n]) => `<button role="tab" data-aba-av="${k}" aria-selected="false">${n}</button>`).join('')}
          </div>
          <div id="pl-av-painel"></div>
        </article>
        <div class="pl-acao">
          <button class="pl-simular" id="pl-simular" disabled>Fazer simulação</button>
          <div class="pl-acao-linha"><span class="pl-selo" id="pl-selo">Precisão 0%</span><span id="pl-falta-linha" aria-live="polite"></span></div>
          <p class="pl-ajuda">Estimativa de planejamento, não é orçamento.</p>
        </div>
      </div>
    </div>
    <div class="pl-facil" id="pl-facil" hidden></div>
    <div class="pl-tutorial" id="pl-tutorial" hidden>
      <div class="pl-tutorial-texto">
        <p class="pl-tutorial-chamada">Tutorial · 1 minuto</p>
        <h3 class="pl-tutorial-titulo">Veja uma simulação do começo ao fim</h3>
        <p class="pl-tutorial-apoio">O vídeo mostra o modo Padrão: o CEP, a conta de luz, as perguntas do telhado, a meta e o resultado. Depois é só fazer a sua.</p>
        <ol class="pl-tutorial-passos"><li>Local e conta de luz</li><li>Perguntas do telhado</li><li>Sua meta</li><li>Resultado</li></ol>
        <button class="pl-simular pl-tutorial-ir" type="button" id="pl-tutorial-ir">Fazer a minha simulação</button>
      </div>
      <div class="pl-tutorial-video"><video id="pl-tutorial-video" src="secoes/planejador/tutorial/tutorial-padrao.webm" controls playsinline muted preload="metadata" aria-label="Vídeo tutorial do planejador no modo Padrão"></video></div>
    </div>
  </div>
  <div class="pl-sobre" id="pl-sobre" hidden><div class="pl-dialogo" role="dialog" aria-modal="true" aria-labelledby="pl-res-titulo" id="pl-dialogo"></div></div>`;

  /* ======================= LOCALIZAÇÃO ======================= */
  function climaEfetivo() {
    if (!S.clima) return null;
    const c = { ...S.clima, ghi: S.clima.ghi.slice(), t2m: S.clima.t2m.slice(), t2mMax: S.clima.t2mMax.slice() };
    if (S.hspUsuario > 0) { const k = S.hspUsuario / c.ghiAnual; c.ghi = c.ghi.map((g) => g * k); c.ghiAnual = S.hspUsuario; }
    if (S.tempUsuario != null) { const d = S.tempUsuario - c.t2m.reduce((a, b) => a + b, 0) / 12; c.t2m = c.t2m.map((t) => t + d); c.t2mMax = c.t2mMax.map((t) => t + d); }
    return c;
  }
  async function definirDistribuidora(sigla) {
    S.distSigla = sigla;
    try {
      const t = await API.buscarTarifa(sigla, P);
      S.distNome = t.nome;
      if (S.tarifaFonte !== 'usuario') { S.tarifa = t.tarifa; S.tarifaFonte = 'aneel'; S.tarifaRotulo = t.fonte; }
      return null;
    } catch { S.distNome = sigla; return 'Não conseguimos buscar a tarifa; digite o valor da sua conta.'; }
  }
  async function finalizarLocal(info) {
    const u = UFS[info.uf] || null, avisos = [];
    let { lat, lon } = info;
    if (lat == null || lon == null) {
      try { ({ lat, lon } = await API.geocodificar(info.cidade, u ? u.nome : '')); }
      catch { if (u) { lat = u.lat; lon = u.lon; avisos.push('Usamos as coordenadas da capital.'); } }
    }
    if (lat == null) throw new Error('sem-local');
    S.loc = { cep: info.cep || null, cidade: info.cidade, uf: u ? u.sigla : null, lat, lon, origem: info.origem };
    try { S.clima = await API.buscarClima(lat, lon); S.climaFonte = S.clima.fonte; S.climaMedia = false; }
    catch {
      const base = u || UFS.DF, t = P.temperaturaRegiao.valor[base.regiao];
      S.clima = C.climaSintetico(lat, base.hsp, t[0], t[1]); S.climaFonte = 'média da região'; S.climaMedia = true;
      avisos.push('Usamos uma média da sua região.');
    }
    S.hspUsuario = null; S.tempUsuario = null;
    if (u) { const a = await definirDistribuidora(u.distribuidoras[0]); if (a) avisos.push(a); }
    return avisos;
  }
  const localizarPorCep = async (cep) => finalizarLocal({ ...(await API.buscarCep(cep)), cep: cep.replace(/\D/g, ''), origem: 'cep' });
  const localizarPorCidade = (uf, cidade) => finalizarLocal({ uf, cidade, lat: null, lon: null, origem: 'cidade' });
  async function preencherCidades(sel, uf, atual) {
    sel.disabled = true; sel.innerHTML = '<option>Carregando…</option>';
    let cidades;
    try { cidades = await API.ibgeMunicipios(uf); } catch { cidades = []; }
    sel.innerHTML = '<option value="">Cidade</option>' + cidades.map((c) => `<option${c === atual ? ' selected' : ''}>${esc(c)}</option>`).join('');
    sel.disabled = !cidades.length;
    if (!cidades.length) msgLocal('Não conseguimos carregar as cidades.', true);
  }
  function msgLocal(t, erro = false) { const m = $('#pl-msg-local'); m.textContent = t; m.title = t; m.className = 'pl-msg' + (erro ? ' pl-msg-erro' : ''); }
  async function buscarPorCep() {
    const cep = $('#pl-cep').value.replace(/\D/g, '');
    if (cep.length !== 8) return msgLocal('Esse CEP não parece certo. Confira os 8 números.', true);
    msgLocal('Buscando os dados da sua região…'); $('#pl-buscar').disabled = true;
    try { const av = await localizarPorCep(cep); msgLocal(av.join(' ') || 'Dados encontrados.'); }
    catch (e) { msgLocal(e.message === 'cep-invalido' ? 'Esse CEP não parece certo. Confira os 8 números.' : 'Não achamos esse CEP; escolha a cidade.', true); }
    finally { $('#pl-buscar').disabled = false; atualizar(); }
  }

  /* ======================= ENTRADA DO CÁLCULO ======================= */
  const precoWpRegiao = () => P.precoWpRegiao.valor[S.loc && S.loc.uf ? UFS[S.loc.uf].regiao : 'SE'];
  const ex = (k) => {
    const v = S.modo === 'expert' ? S.expert[k] : null;
    if (v != null && isFinite(v)) return v;
    return DEF[k] === 'regiao' ? precoWpRegiao() : DEF[k];
  };
  const perdasExpert = () => ['perda.sujeira', 'perda.sombra', 'perda.cabos', 'perda.descas', 'perda.indisp'].reduce((s, k) => s + ex(k), 0);
  const climaOuPadrao = () => climaEfetivo() || C.climaSintetico(-15.79, 5.4, 25, 31);
  const latAtual = () => climaOuPadrao().lat;
  const ehLaje = () => (S.telhado && S.telhado.desenhado ? S.telhado.laje : S.telhadoTipo === 'laje');
  function painelLaje() {
    if (S.modo === 'expert' && S.lajeManual) return { inclinacao: S.lajePainel.inclinacao ?? C.inclinacaoLaje(latAtual()), azimute: S.lajePainel.azimute ?? 0 };
    return { inclinacao: C.inclinacaoLaje(latAtual()), azimute: 0 };
  }
  let cacheClasses = { chave: '', valor: {} };
  function classes() {
    if (!S.telhado || !S.telhado.desenhado) return {};
    const cl = climaOuPadrao(), laje = S.telhado.laje, pl = painelLaje();
    const chave = JSON.stringify([cl.lat, cl.ghiAnual, laje, pl, S.telhado.partes.map((p) => [p.id, p.inclinacao, Math.round(p.azimute), p.incluir])]);
    if (chave === cacheClasses.chave) return cacheClasses.valor;
    const out = {};
    for (const p of S.telhado.partes) {
      const q = laje ? C.classificarSuperficie(cl, pl.inclinacao, pl.azimute) : C.classificarSuperficie(cl, p.inclinacao, p.azimute);
      out[p.id] = { classe: q.classe, r: q.r, incluida: p.incluir ?? q.classe !== 'nao' };
    }
    cacheClasses = { chave, valor: out };
    return out;
  }
  function superficies(metodo, cls) {
    if (metodo !== 'B' || !S.telhado || !S.telhado.desenhado) {
      const lat = Math.abs(latAtual());
      return ehLaje() ? [{ id: 'padrao', nome: 'Laje', ...painelLaje(), areaUtil: null }] : [{ id: 'padrao', nome: 'Telhado', inclinacao: Math.max(10, Math.min(20, lat)), azimute: 0, areaUtil: null }];
    }
    const aprov = ex('fin.aproveitamento') / 100, pl = painelLaje();
    return S.telhado.partes.filter((p) => cls[p.id] && cls[p.id].incluida).map((p) => ({
      id: p.id, nome: p.nome, inclinacao: S.telhado.laje ? pl.inclinacao : p.inclinacao, azimute: S.telhado.laje ? pl.azimute : p.azimute, areaUtil: p.areaReal * aprov,
    }));
  }
  function custoEdicoes() {
    if (S.modo !== 'expert') return null;
    const ed = { ...S.custoEd };
    if (S.tipoEstrutura) ed.tipoEstrutura = S.tipoEstrutura;
    return Object.keys(ed).length ? ed : null;
  }
  function entrada(metodo) {
    const expert = S.modo === 'expert' && metodo === 'B', cls = classes();
    const e = {
      metodo, expert, clima: climaEfetivo(), tarifa: S.tarifa, ligacao: S.ligacao, consumoKwh: S.consumoKwh, contaReais: S.contaReais,
      metas: { ...S.metas, maximo: S.maximo && !Object.values(S.metas).some((v) => v > 0) },
      limites: { ...S.limites }, superficies: superficies(metodo, cls), precoWp: precoWpRegiao(), anoInicial: new Date().getFullYear() + 1,
      fioB: P.fioB.valor, fatorFioB: P.fatorFioB.valor, disponibilidade: P.disponibilidade.valor, tipoEstrutura: ehLaje() ? 'laje' : 'ceramico',
    };
    if (metodo === 'B' && S.telhado && S.telhado.desenhado && !S.areaEditada) e.limites.area = null;
    if (expert) {
      const wp = ex('painel.wp'), ef = ex('painel.ef');
      Object.assign(e, {
        painel: { wp, area: S.expert['painel.area'] != null ? ex('painel.area') : (S.expert['painel.wp'] != null || S.expert['painel.ef'] != null ? wp / (10 * ef) : 2.58), coefTemp: ex('painel.coefTemp'), noct: ex('painel.noct'), degr1: ex('painel.degr1'), degrAno: ex('painel.degrAno') },
        perdasPct: perdasExpert(), efInversor: ex('inv.ef'), ccca: ex('inv.ccca'), autoconsumoPct: ex('fin.autoconsumo'), albedo: ex('fin.albedo'), sistemaAntigo: S.sistemaAntigo,
        precoWp: ex('fin.precoWp'), reajustePct: ex('fin.reajuste'), omPct: ex('fin.om'), taxaDescontoPct: ex('fin.desconto'), aproveitamento: ex('fin.aproveitamento') / 100,
        trocaInversorAno: ex('inv.anoTroca'), trocaInversorCusto: S.expert['inv.custoTroca'] ?? null, custoEdicoes: custoEdicoes(),
      });
      if (S.expert['fin.meses'] > 0) e.financiamento = { entrada: S.expert['fin.entrada'] || 0, jurosMesPct: S.expert['fin.juros'] || 0, meses: S.expert['fin.meses'] };
    }
    return { e, cls };
  }

  /* ======================= REQUISITOS E PRECISÃO ======================= */
  const temMeta = () => S.maximo || Object.values(S.metas).some((v) => v > 0);
  // o telhado que já vem desenhado só conta como limitação depois que o usuário ajusta
  const temLimite = () => S.limites.orcamento > 0 || S.limites.paineis > 0 || (S.limites.area > 0 && S.areaEditada) || S.telhadoTocado;
  function faltaMinimo() {
    const f = [];
    if (!S.loc || !S.clima) f.push('local');
    if (!(S.consumoKwh > 0) && !(S.contaReais > 0)) f.push('consumo ou conta');
    if (S.loc && !(S.tarifa > 0)) f.push('tarifa');
    if (!temMeta() && !temLimite()) f.push('uma meta ou limitação');
    if (S.telhado && S.telhado.desenhado && !Object.values(classes()).some((c) => c.incluida)) f.push('uma parte do telhado marcada');
    return f;
  }
  function precisao() {
    return C.precisaoEstimada({
      temLocal: !!S.loc, temCep: S.loc && S.loc.origem === 'cep', consumoKwh: S.consumoKwh > 0, soConta: S.contaReais > 0,
      tarifaDigitada: S.tarifaFonte === 'usuario', tarifaAneel: S.tarifaFonte === 'aneel',
      telhadoDesenhado: S.telhadoTocado, orientacaoInformada: !!(S.telhado && S.telhado.desenhado && S.norteTocado && (S.telhado.laje || S.inclTocado)),
      expert: S.modo === 'expert', sombreamento: S.expert['perda.sombra'] != null,
      modulo: ['painel.wp', 'painel.ef', 'painel.coefTemp', 'painel.noct', 'inv.ef'].some((k) => S.expert[k] != null),
    });
  }
  const NOMES_FALTA = { 'a localização (cidade)': 'Local (CEP ou cidade)', 'o CEP': 'CEP', 'o consumo em kWh': 'Consumo em kWh', 'a tarifa da sua conta': 'Tarifa da sua conta', 'o desenho do telhado': 'Ajustar o telhado', 'o norte e a inclinação do telhado': 'Norte e inclinação', 'o sombreamento': 'Sombreamento', 'os dados do módulo/inversor': 'Módulo/inversor' };

  /* ======================= CAMPOS ======================= */
  function validarInput(inp) {
    const c = inp.closest('.pl-campo'), err = c && c.querySelector('.pl-erro');
    const v = num(inp.value), min = parseFloat(inp.dataset.min), max = parseFloat(inp.dataset.max);
    const msg = v != null && (isNaN(v) || v < min || v > max) ? `Entre ${fmtN(min, min % 1 ? 2 : 0)} e ${fmtN(max, max % 1 ? 2 : 0)}` : '';
    if (c) c.classList.toggle('pl-invalido', !!msg);
    if (err) err.textContent = msg;
    inp.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg) S.invalidos.add(inp.dataset.k); else S.invalidos.delete(inp.dataset.k);
    return msg ? undefined : v;
  }
  raiz.addEventListener('input', (ev) => {
    const inp = ev.target;
    if (!inp.matches('input[data-k]')) return;
    const v = validarInput(inp), k = inp.dataset.k;
    if (inp.dataset.exp) { if (v == null) delete S.expert[k]; else S.expert[k] = v; }
    else setK(S, k, v === undefined ? null : v);
    if (k === 'limites.area') S.areaEditada = v != null;
    atualizar();
  });
  function sincronizarCampos() {
    $$('.pl-grade input[data-k]').forEach((inp) => {
      if (document.activeElement === inp) return;
      const v = inp.dataset.exp ? S.expert[inp.dataset.k] : getK(S, inp.dataset.k);
      inp.value = v == null ? '' : String(+(+v).toFixed(2)).replace('.', ',');
    });
    $$('#pl-ligacao button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === S.ligacao)));
    if (S.loc && S.loc.cep && document.activeElement !== $('#pl-cep')) $('#pl-cep').value = mascaraCep(S.loc.cep);
    $('#pl-area-orig').textContent = S.telhado && S.telhado.desenhado && !S.areaEditada ? '(do desenho)' : '';
  }

  /* ======================= ETIQUETAS ======================= */
  function renderEtiquetas() {
    const c = climaEfetivo(), l = S.loc;
    // etiquetas compactas (uma linha): o nome completo vai no title e no rótulo acessível
    const et = [
      { k: 'cidade', nome: 'Cidade', valor: l ? `${l.cidade}/${l.uf || '?'}` : null },
      { k: 'hsp', nome: 'Incidência solar', curto: 'Sol', valor: c ? `${fmtN(c.ghiAnual, 2)} kWh/m²·dia` : null, usuario: !!S.hspUsuario, fonte: S.hspUsuario ? 'digitada' : S.climaFonte },
      { k: 'tarifa', nome: 'Tarifa local', curto: 'Tarifa', valor: S.tarifa ? `R$ ${fmtN(S.tarifa, 2)}/kWh` : null, usuario: S.tarifaFonte === 'usuario', fonte: S.tarifaFonte === 'usuario' ? 'digitada' : `${S.tarifaRotulo || ''}, com tributos estimados de ${fmtN(P.tributos.valor * 100)}%` },
      { k: 'dist', nome: 'Distribuidora', valor: S.distNome },
      { k: 'temp', nome: 'Temperatura média', curto: 'Temp.', valor: c ? `${fmtN(c.t2m.reduce((a, b) => a + b, 0) / 12, 1)} °C` : null, usuario: S.tempUsuario != null },
    ];
    $('#pl-etiquetas').innerHTML = et.map((e) => {
      const tit = e.valor ? `${e.nome}: ${e.valor}${e.fonte ? ` (${e.fonte})` : ''}` : `${e.nome}: digitar`;
      return `<span class="pl-etiqueta${e.valor ? '' : ' pl-vazia'}${e.usuario ? ' pl-usuario' : ''}" data-et="${e.k}" title="${esc(tit)}"><b>${esc(e.valor || e.curto || e.nome)}</b><button type="button" aria-label="Corrigir ${e.nome}${e.valor ? ` (${esc(e.valor)})` : ''}">${ICONES.lapis}</button></span>`;
    }).join('');
  }
  function editarEtiqueta(k, el) {
    if (k === 'cidade') { alternarLocal(true); $('#pl-uf').focus(); return; }
    if ((k === 'hsp' || k === 'temp' || k === 'dist') && !S.loc) return msgLocal('Informe o local primeiro.', true);
    const b = el.querySelector('b');
    if (k === 'dist') {
      const lista = UFS[S.loc.uf] ? UFS[S.loc.uf].distribuidoras : [];
      b.innerHTML = `<select aria-label="Distribuidora">${lista.map((s) => `<option value="${esc(s)}"${s === S.distSigla ? ' selected' : ''}>${esc(P.tarifasAneel.valor[s]?.nome || s)}</option>`).join('')}</select>`;
      const sel = b.querySelector('select'); sel.focus();
      sel.addEventListener('change', async () => { await definirDistribuidora(sel.value); atualizar(); });
      sel.addEventListener('blur', () => atualizar());
      return;
    }
    const c = climaEfetivo();
    const atual = { hsp: c && c.ghiAnual, tarifa: S.tarifa, temp: c && c.t2m.reduce((a, b2) => a + b2, 0) / 12 }[k];
    b.innerHTML = `<input inputmode="decimal" aria-label="Novo valor" value="${atual == null ? '' : String(+(+atual).toFixed(2)).replace('.', ',')}">`;
    const inp = b.querySelector('input'); inp.focus(); inp.select();
    let feito = false;
    const fim = (ok) => {
      if (feito) return; feito = true;
      if (ok) {
        const v = num(inp.value), fx = { hsp: [2, 8], tarifa: [0.3, 3], temp: [5, 40] }[k];
        if (v != null && !isNaN(v) && v >= fx[0] && v <= fx[1]) {
          if (k === 'hsp') S.hspUsuario = v; if (k === 'tarifa') { S.tarifa = v; S.tarifaFonte = 'usuario'; } if (k === 'temp') S.tempUsuario = v;
          msgLocal('');
        } else if (v != null) msgLocal(`Digite entre ${fmtN(fx[0], 2)} e ${fmtN(fx[1], 2)}.`, true);
      }
      atualizar();
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') fim(true); if (e.key === 'Escape') fim(false); });
    inp.addEventListener('blur', () => fim(true));
  }
  function alternarLocal(lista) {
    S.listaLocal = lista;
    raiz.querySelector('[data-local="cep"]').hidden = lista;
    raiz.querySelector('[data-local="lista"]').hidden = !lista;
    $('#pl-rot-local').textContent = lista ? 'Estado e cidade' : 'CEP';
    $('#pl-alterna-local').textContent = lista ? 'Usar o CEP' : 'Não sei o CEP';
  }

  /* ======================= EDITOR DE TELHADO ======================= */
  let iniciando = true;
  const editor = new EditorTelhado($('#pl-canvas'), {
    aoMudar: (d, oQue, geometria) => {
      S.telhado = d;
      if (!iniciando) {
        if (oQue === 'norte') S.norteTocado = true;
        if (oQue === 'inclinacao') S.inclTocado = true;
        if (geometria) S.telhadoTocado = true;
      }
      if (geometria && !S.areaEditada) S.limites.area = d.desenhado ? Math.round(d.partes.reduce((s, p) => s + p.areaReal, 0) * 10) / 10 : null;
      if (geometria) renderPasso();
      renderPartes(); editorInfo(); sincronizarCampos(); atualizar();
    },
    aoDica: (t) => { const el = $('#pl-dica'); if (el) el.textContent = t; },
    aoModo: () => renderPasso(),
  });
  // modo Padrão: perguntas com a casinha ilustrada, alimentando o mesmo editor
  const casinha = criarCasinha($('#pl-casinha'), editor, (m) => {
    if ('frente' in m) S.norteTocado = true;
    if ('incl' in m) S.inclTocado = true;
    S.telhadoTocado = true;
  });
  function editorInfo() {
    const cls = classes(), info = {};
    for (const [id, c] of Object.entries(cls)) info[id] = { classe: c.classe, excluida: !c.incluida, n: 0 };
    const r = S.res && S.res.ok ? S.res : null;
    if (r) for (const a of r.alocacao) if (info[a.id]) info[a.id].n = a.n;
    editor.lajePainel = painelLaje();
    editor.setInfo(info);
  }
  const entradaFaixa = (id, valor, pre, un, rotulo, largo) => `<label class="pl-entrada${largo ? ' pl-entrada-larga' : ''}">${pre ? `<span class="pl-un pl-un-pre">${pre}</span>` : ''}<input id="${id}" inputmode="decimal" value="${valor}" aria-label="${rotulo}">${un ? `<span class="pl-un">${un}</span>` : ''}</label>`;
  function renderPasso() {
    const p = S.passoTelhado, box = $('#pl-passo-conteudo'), d = editor.dados();
    $$('#pl-passos button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.passo === p)));
    let h = '';
    if (p === 'forma') {
      const f = editor.forma;
      h = `<div class="pl-faixa"><div class="pl-seg" role="group" aria-label="Forma do telhado">${Object.keys(NOMES_FORMA).map((k) => `<button class="pl-forma" data-forma="${k}" aria-pressed="${f === k}">${SVG_FORMA[k]}${k === 'livre' ? 'Livre' : k === 'laje' ? 'Laje' : NOMES_FORMA[k]}</button>`).join('')}</div>` +
        (f && f !== 'livre' ? `${entradaFaixa('pl-larg', fmtN(d.largura, 1), 'L', 'm', 'Largura em metros')}${entradaFaixa('pl-comp', fmtN(d.comprimento, 1), 'C', 'm', 'Comprimento em metros')}` : '') +
        (f === 'livre' ? `<button class="pl-btn" id="pl-livre-linha" ${editor.desenhado ? '' : 'disabled'}>+ Cumeeira</button><button class="pl-btn" id="pl-desfazer">Desfazer</button><button class="pl-btn" id="pl-limpar">Limpar</button>` : '') + '</div>' +
        (f === 'livre' ? `<p class="pl-ajuda" id="pl-dica">${editor.modoLivre === 'contorno' ? 'Clique nos cantos e no 1º ponto para fechar (teclado: setas e Enter).' : editor.modoLivre === 'linha' ? 'Cumeeira: clique na borda, nos pontos internos e termine na borda.' : 'Arraste os cantos ou clique numa medida para digitar.'}</p>` : '');
    } else if (p === 'norte') {
      h = `<div class="pl-faixa"><button class="pl-btn" id="pl-n-menos" aria-label="Girar o norte 15 graus para a esquerda">⟲ 15°</button><button class="pl-btn" id="pl-n-mais" aria-label="Girar o norte 15 graus para a direita">⟳ 15°</button>
        ${entradaFaixa('pl-norte', d.norte, 'N', '°', 'Direção do norte em graus a partir do topo do desenho')}<button class="pl-link" id="pl-n-zero">Norte para cima</button></div>
        <p class="pl-ajuda">Gire a bússola até o desenho ficar como a sua casa vista de cima. No mapa do celular, o norte é para cima.</p>`;
    } else if (d.laje) {
      const pl = painelLaje();
      h = `<div class="pl-faixa"><span class="pl-ajuda">Laje: painéis em suportes,</span><b style="font-size:13px">virados para o ${nomeDirecao(pl.azimute)}, ${fmtN(pl.inclinacao)}°${S.lajeManual && S.modo === 'expert' ? '' : ' (recomendado)'}</b>
        ${S.modo === 'expert' ? `<label class="pl-check"><input type="checkbox" id="pl-laje-manual"${S.lajeManual ? ' checked' : ''}> Definir manualmente</label>` : ''}</div>
        ${S.modo === 'expert' && S.lajeManual ? `<div class="pl-faixa">${entradaFaixa('pl-laje-incl', fmtN(pl.inclinacao), 'Incl.', '°', 'Inclinação dos painéis', true)}${entradaFaixa('pl-laje-az', fmtN(pl.azimute), 'Dir.', '°', 'Direção dos painéis em graus, 0 é norte', true)}</div>` : ''}`;
    } else {
      h = `<div class="pl-faixa"><div class="pl-seg" role="group" aria-label="Atalhos de inclinação">${[['Laje', 5], ['Comum', 20], ['Alto', 30]].map(([n, v]) => `<button data-incl="${v}" aria-pressed="${d.inclinacao === v}">${n} ~${v}°</button>`).join('')}</div>
        ${entradaFaixa('pl-incl', fmtN(d.inclinacao), '', '°', 'Inclinação do telhado em graus')}
        ${d.partes.length > 1 ? `<button class="pl-link" id="pl-por-parte" aria-expanded="${S.porParte}">Ajustar por parte</button>` : ''}</div>
        ${S.porParte && d.partes.length > 1 ? `<div class="pl-por-parte">${d.partes.map((x) => entradaFaixa(`pl-ip-${x.id}`, fmtN(x.inclinacao), x.nome.replace('Parte ', 'P'), '°', `Inclinação da ${x.nome}`, true).replace('<input', `<input data-incl-parte="${x.id}"`)).join('')}</div>` : ''}`;
    }
    box.innerHTML = h;
    const q = (s) => box.querySelector(s);
    box.querySelectorAll('[data-forma]').forEach((b) => b.onclick = () => { S.telhadoTocado = true; editor.setForma(b.dataset.forma); });
    const aplicar = () => { const w = num(q('#pl-larg').value), l = num(q('#pl-comp').value); if (w >= 1 && w <= 100 && l >= 1 && l <= 100) editor.setForma(editor.forma, w, l); else renderPasso(); };
    if (q('#pl-larg')) { q('#pl-larg').onchange = aplicar; q('#pl-comp').onchange = aplicar; }
    if (q('#pl-livre-linha')) q('#pl-livre-linha').onclick = () => { editor.setModoLivre('linha'); editor.cv.focus(); };
    if (q('#pl-desfazer')) q('#pl-desfazer').onclick = () => editor.desfazer();
    if (q('#pl-limpar')) q('#pl-limpar').onclick = () => editor.setForma('livre');
    if (q('#pl-n-menos')) {
      const n = q('#pl-norte');
      q('#pl-n-menos').onclick = () => { editor.setNorte(editor.norte - 15); n.value = editor.norte; };
      q('#pl-n-mais').onclick = () => { editor.setNorte(editor.norte + 15); n.value = editor.norte; };
      q('#pl-n-zero').onclick = () => { editor.setNorte(0); n.value = 0; };
      n.onchange = () => { const v = num(n.value); if (v != null && !isNaN(v)) editor.setNorte(v); n.value = editor.norte; };
    }
    box.querySelectorAll('[data-incl]').forEach((b) => b.onclick = () => { editor.setInclinacao(+b.dataset.incl); renderPasso(); });
    if (q('#pl-incl')) q('#pl-incl').onchange = (e) => { const v = num(e.target.value); if (v >= 0 && v <= 60) { editor.setInclinacao(v); renderPasso(); } else e.target.value = fmtN(editor.inclinacao); };
    if (q('#pl-por-parte')) q('#pl-por-parte').onclick = () => { S.porParte = !S.porParte; renderPasso(); };
    box.querySelectorAll('[data-incl-parte]').forEach((i) => i.onchange = () => { const v = num(i.value); if (v >= 0 && v <= 60) { S.inclTocado = true; editor.setParte(i.dataset.inclParte, { inclinacao: v }); } });
    if (q('#pl-laje-manual')) q('#pl-laje-manual').onchange = (e) => { S.lajeManual = e.target.checked; renderPasso(); editorInfo(); atualizar(); };
    if (q('#pl-laje-incl')) {
      q('#pl-laje-incl').onchange = (e) => { const v = num(e.target.value); if (v >= 0 && v <= 60) S.lajePainel.inclinacao = v; renderPasso(); editorInfo(); atualizar(); };
      q('#pl-laje-az').onchange = (e) => { const v = num(e.target.value); if (v >= 0 && v < 360) S.lajePainel.azimute = v; renderPasso(); editorInfo(); atualizar(); };
    }
  }
  function renderPartes() {
    const d = S.telhado, box = $('#pl-partes');
    if (!d || !d.desenhado) { box.innerHTML = ''; return; }
    const cls = classes(), pl = painelLaje(), r = S.res && S.res.ok ? S.res : null;
    const selo = { recomendada: ['pl-q-rec', 'Recomendada'], pode: ['pl-q-pode', 'Pode usar'], nao: ['pl-q-nao', 'Não recomendada'] };
    box.innerHTML = d.partes.map((p) => {
      const c = cls[p.id], [qc, qn] = selo[c.classe], n = r ? (r.alocacao.find((a) => a.id === p.id)?.n ?? 0) : null;
      const dir = d.laje ? `painéis p/ o ${nomeDirecao(pl.azimute)}` : `olha para o ${p.direcao}`;
      return `<div class="pl-parte${c.incluida ? '' : ' pl-fora'}"><b>${p.nome}</b><span>${dir}${d.laje ? '' : ` <button class="pl-link" data-inverter="${p.id}" title="Use se a seta estiver ao contrário">inverter</button>`}</span><span>${fmtN(p.areaReal, 1)} m²</span><span>${n == null ? '—' : `${n} ${n === 1 ? 'painel' : 'painéis'}`}</span><span class="pl-q ${qc}">${qn}</span><label class="pl-check"><input type="checkbox" data-incluir="${p.id}"${c.incluida ? ' checked' : ''} aria-label="Usar a ${p.nome}">usar</label></div>`;
    }).join('');
    box.querySelectorAll('[data-inverter]').forEach((b) => b.onclick = () => { const p = editor.partes.find((x) => x.id === b.dataset.inverter); editor.setParte(p.id, { invertido: !p.invertido }); });
    box.querySelectorAll('[data-incluir]').forEach((i) => i.onchange = () => editor.setParte(i.dataset.incluir, { incluir: i.checked }));
  }

  /* ======================= DADOS AVANÇADOS (expert) ======================= */
  function renderAvancado() {
    const aba = S.abaAvancada, box = $('#pl-av-painel');
    $$('[data-aba-av]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.abaAv === aba)));
    if (aba === 'custos') return renderCustos();
    const lista = CAMPOS_EXPERT[aba];
    box.innerHTML = `<div class="pl-campos pl-campos-2">${lista.map(([k, rot, un, mi, ma, def]) => campo(k, rot, { un, min: mi, max: ma, exp: true, ph: def === 'regiao' ? fmtN(precoWpRegiao(), 2) : def == null ? '—' : String(def).replace('.', ',') })).join('')}</div>` +
      (aba === 'perdas' ? `<p class="pl-ajuda" style="margin-top:6px">Soma: ${fmtN(perdasExpert(), 1)}% (substitui o padrão de 14%).</p>` : '') +
      (aba === 'financas' ? `<label class="pl-check" style="margin-top:8px"><input type="checkbox" id="pl-antigo"${S.sistemaAntigo ? ' checked' : ''}> Sistema anterior a 2023 (isento do Fio B)</label>` : '');
    sincronizarCampos();
    if ($('#pl-antigo')) $('#pl-antigo').onchange = (e) => { S.sistemaAntigo = e.target.checked; atualizar(); };
  }
  function custosAtuais() {
    const r = S.res && S.res.ok ? S.res : null;
    return C.custoItens({ N: r ? r.N : 8, wp: S.modo === 'expert' ? ex('painel.wp') : 550, precoWp: S.modo === 'expert' ? ex('fin.precoWp') : precoWpRegiao(), ccca: ex('inv.ccca'), tipoPadrao: ehLaje() ? 'laje' : 'ceramico', edicoes: custoEdicoes() || {} });
  }
  function renderCustos() {
    const box = $('#pl-av-painel'), c = custosAtuais(), padrao = ehLaje() ? 'laje' : 'ceramico';
    box.innerHTML = c.itens.map((it) => `<div class="pl-custo-linha"><span class="pl-custo-nome"><span title="${it.nome}">${it.id === 'cabos' ? 'Cabos e proteções' : it.id === 'projeto' ? 'Projeto e homolog.' : it.id === 'frete' ? 'Frete e outros' : it.id === 'estrutura' ? 'Estrutura' : it.nome}</span>${it.id === 'estrutura' ? `<select class="pl-select" id="pl-tipo-estr" aria-label="Tipo de telhado da estrutura">${Object.entries(TIPOS_ESTRUTURA).map(([k, n]) => `<option value="${k}"${(S.tipoEstrutura || padrao) === k ? ' selected' : ''}>${n}</option>`).join('')}</select>` : ''}</span><span class="pl-peso">${fmtN(it.peso * 100)}%</span>
      <label class="pl-entrada"><span class="pl-sr">${it.nome} em ${it.unidade}</span><input data-custo="${it.id}" inputmode="decimal" value="${fmtN(it.unitario, CASAS_CUSTO[it.id])}"><span class="pl-un">${it.unidade.replace(' do total', '')}</span></label></div>`).join('') +
      `<div class="pl-custo-total" aria-live="polite"><span>Total${S.res && S.res.ok ? ` (${S.res.N} painéis)` : ' (referência: 8 painéis)'}</span><span>${fmtR(c.total)}${c.editado ? ` · ${c.diferenca >= 0 ? '+' : '−'}${fmtN(Math.abs(c.diferenca) * 100)}% vs. média` : ''}</span></div>
      <p class="pl-ajuda">${c.editado ? '<button class="pl-link" id="pl-custo-reset">Voltar aos valores-base</button> · ' : ''}Pesos-base: suposição a calibrar.</p>`;
    box.querySelectorAll('[data-custo]').forEach((i) => i.onchange = () => { const v = num(i.value); if (v != null && !isNaN(v) && v >= 0) S.custoEd[i.dataset.custo] = v; else delete S.custoEd[i.dataset.custo]; atualizar(); renderCustos(); });
    box.querySelector('#pl-tipo-estr').onchange = (e) => { S.tipoEstrutura = e.target.value === padrao ? null : e.target.value; atualizar(); renderCustos(); };
    if (box.querySelector('#pl-custo-reset')) box.querySelector('#pl-custo-reset').onclick = () => { S.custoEd = {}; S.tipoEstrutura = null; atualizar(); renderCustos(); };
  }

  /* ======================= ATUALIZAÇÃO ======================= */
  let timer = null;
  function atualizar() {
    renderEtiquetas();
    const p = precisao(), falta = faltaMinimo(), invalido = S.invalidos.size > 0;
    $('#pl-prec-barra').style.width = (p.total / 90) * 100 + '%';
    $('#pl-prec-num').textContent = p.total + '%';
    $('#pl-prec-falta').innerHTML = p.falta.slice(0, 4).map((i) => `<li><span>${NOMES_FALTA[i.nome] || i.nome}</span><b>+${i.ganho}%</b></li>`).join('');
    $('#pl-selo').textContent = `Precisão ${p.total}%`;
    $('#pl-simular').disabled = falta.length > 0 || invalido;
    $('#pl-falta-linha').textContent = invalido ? 'Corrija os campos em vermelho.' : falta.length ? 'Falta: ' + falta.join(', ') + '.' : 'Pronto para simular.';
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (S.modo !== 'facilitado' && !falta.length && !invalido) S.res = C.simular(entrada('B').e); else if (S.modo !== 'facilitado') S.res = null;
      editorInfo(); renderPartes();
      if (S.modo === 'expert' && S.abaAvancada === 'custos' && !raiz.querySelector('[data-custo]:focus')) renderCustos();
    }, 200);
  }

  /* ======================= RESULTADO SOBREPOSTO ======================= */
  let focoAntes = null, abaRes = 'resumo', observadores = [];
  let vista = null;           // 'resultado' | 'historico' | null (o que está aberto por cima)
  let salvamento = null;      // { r, simples, modo, entradas, estado }
  let itemAberto = null;      // simulação do histórico aberta em "Ver resultado"
  function abrirSobre() {
    if ($('#pl-sobre').hidden) focoAntes = document.activeElement;
    $('#pl-sobre').hidden = false;
  }
  function abrirResultado(r, simples) {
    abrirSobre();
    vista = 'resultado';
    abaRes = 'resumo';
    if (r.ok && !r.salvo) {
      salvamento = { r, simples, modo: simples ? 'facilitado' : S.modo, entradas: H.montarEntradas(S, telhadoParaSalvar()), estado: null };
      salvarAtual();
    }
    renderResultado(r, simples);
    const t = $('#pl-dialogo').querySelector('[data-aba-res="resumo"]'); if (t) t.focus();
  }
  function fecharResultado() {
    observadores.forEach((o) => o.disconnect()); observadores = [];
    // anima a saída e só depois esconde
    const sobre = $('#pl-sobre');
    sobre.classList.add('ei-saindo');
    setTimeout(() => { sobre.classList.remove('ei-saindo'); sobre.hidden = true; }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
    vista = null; itemAberto = null;
    if (focoAntes && focoAntes.isConnected) focoAntes.focus({ preventScroll: true });
  }

  /* ----- Salvar no histórico (só com login; nunca a localização) ----- */
  function telhadoParaSalvar() {
    return {
      forma: editor.forma, largura: editor.largura, comprimento: editor.comprimento, norte: editor.norte, inclinacao: editor.inclinacao,
      partes: editor.partes.map((p) => ({ vertices: p.vertices, invertido: p.invertido, inclinacao: p.inclinacao, incluir: p.incluir })),
    };
  }
  async function salvarAtual() {
    const sv = salvamento;
    if (!sv || !banco) return;
    const u = usuario();
    if (!u) { sv.estado = 'visitante'; return atualizarFaixa(); }
    if (sv.estado === 'salvando' || sv.estado === 'salvo') return;
    sv.estado = 'salvando'; atualizarFaixa();
    try {
      const resp = await H.salvar(banco, u.uid, { modo: sv.modo, entradas: sv.entradas, resultado: H.montarResultado(sv.r) });
      sv.estado = resp.cheio ? 'cheio' : 'salvo';
    } catch (erro) {
      console.error('Não foi possível salvar a simulação.', erro);
      sv.estado = 'erro';
    }
    atualizarFaixa();
    if (vista === 'historico') renderHistorico();
  }
  function faixaSalvar() {
    const sv = salvamento;
    if (!banco || !sv) return '';
    if (sv.estado === 'visitante') return `<div class="pl-salvar pl-salvar-alerta"><span>Você não está logado. <b>Nada será salvo</b> sem fazer login.</span><button class="pl-btn" type="button" data-entrar>Entrar</button></div>`;
    if (sv.estado === 'salvando') return '<div class="pl-salvar"><span>Salvando no histórico…</span></div>';
    if (sv.estado === 'salvo') return '<div class="pl-salvar pl-salvar-ok"><span>Salva no histórico.</span></div>';
    if (sv.estado === 'cheio') return `<div class="pl-salvar pl-salvar-alerta"><span>Você já tem ${H.LIMITE_SIMULACOES} simulações salvas. Exclua uma para salvar esta.</span><button class="pl-btn" type="button" data-abrir-historico>Abrir histórico</button></div>`;
    if (sv.estado === 'erro') return '<div class="pl-salvar pl-salvar-erro"><span>Não foi possível salvar agora.</span><button class="pl-btn" type="button" data-salvar-de-novo>Tentar de novo</button></div>';
    return '';
  }
  function atualizarFaixa() {
    const caixa = $('#pl-salvar');
    if (!caixa) return;
    caixa.innerHTML = faixaSalvar();
    ligarFaixa(caixa);
  }
  function ligarFaixa(caixa) {
    caixa.querySelector('[data-entrar]')?.addEventListener('click', () => abrirLogin());
    caixa.querySelector('[data-abrir-historico]')?.addEventListener('click', () => abrirHistorico());
    caixa.querySelector('[data-salvar-de-novo]')?.addEventListener('click', () => { salvamento.estado = null; salvarAtual(); });
  }

  /* ----- Histórico (sobreposição dentro da seção) ----- */
  const NOME_MODO = { facilitado: 'Facilitado', padrao: 'Padrão', expert: 'Expert' };
  const dataCurta = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
  let historico = { itens: null, erro: false, carregando: false, editando: null, excluindo: null, aviso: '' };
  function abrirHistorico() {
    abrirSobre();
    vista = 'historico'; itemAberto = null;
    historico = { itens: null, erro: false, carregando: false, editando: null, excluindo: null, aviso: '' };
    renderHistorico();
    carregarHistorico();
  }
  async function carregarHistorico() {
    const u = usuario();
    if (!u || !banco) return renderHistorico();
    historico.carregando = true; historico.erro = false; renderHistorico();
    try { historico.itens = await H.listar(banco, u.uid); }
    catch (erro) { console.error('Não foi possível ler o histórico.', erro); historico.erro = true; }
    historico.carregando = false;
    if (vista === 'historico') renderHistorico();
  }
  function renderHistorico() {
    if (vista !== 'historico') return;
    observadores.forEach((o) => o.disconnect()); observadores = [];
    const dlg = $('#pl-dialogo'), u = usuario(), h = historico;
    let corpo;
    if (!banco) corpo = '<p class="pl-hist-vazio">O histórico não está disponível agora.</p>';
    else if (!u) corpo = '<p class="pl-hist-vazio">Entre para ver o seu histórico.</p><div class="pl-linha-btns"><button class="pl-btn pl-btn-sol" type="button" data-entrar>Entrar</button></div>';
    else if (h.carregando && !h.itens) corpo = '<p class="pl-hist-vazio" role="status">Carregando o histórico…</p>';
    else if (h.erro) corpo = '<p class="pl-hist-vazio" role="alert">Sem conexão. Tente de novo.</p><div class="pl-linha-btns"><button class="pl-btn" type="button" data-recarregar>Tentar de novo</button></div>';
    else if (!h.itens || !h.itens.length) corpo = '<p class="pl-hist-vazio">Suas simulações vão aparecer aqui.</p>';
    else {
      corpo = `<ul class="pl-hist-lista" aria-label="Simulações salvas">${h.itens.map((s) => {
        const r = s.resultado || {}, nome = s.rotulo || `Simulação de ${dataCurta(s.criadoEm).split(' ')[0]}`;
        const pay = typeof r.paybackMeses === 'number' ? C.formatarAnos(r.paybackMeses / 12) : 'mais de 25 anos';
        const info = [dataCurta(s.criadoEm), NOME_MODO[s.modo] || '', r.kwp != null ? `${fmtN(r.kwp, 2)} kWp` : '', r.investimento?.central != null ? fmtR(r.investimento.central) : '', `se paga em ${pay}`].filter(Boolean).join(' · ');
        let acoes;
        if (h.excluindo === s.id) acoes = `<span class="pl-hist-nota">Excluir esta simulação?</span><button class="pl-btn" type="button" data-excluir-sim="${s.id}">Sim, excluir</button><button class="pl-btn" type="button" data-cancelar>Cancelar</button>`;
        else acoes = `<button class="pl-btn" type="button" data-ver="${s.id}">Ver resultado</button><button class="pl-btn" type="button" data-refazer="${s.id}">Refazer</button><button class="pl-btn" type="button" data-renomear="${s.id}">Renomear</button><button class="pl-btn" type="button" data-excluir="${s.id}">Excluir</button>`;
        const edicao = h.editando === s.id ? `<form class="pl-hist-renomear" data-form-rotulo="${s.id}"><label class="pl-entrada"><span class="pl-sr">Nome da simulação</span><input name="rotulo" maxlength="${H.TAMANHO_ROTULO}" value="${esc(s.rotulo || '')}" placeholder="Ex.: Casa da praia"></label><button class="pl-btn pl-btn-sol" type="submit">Salvar nome</button><button class="pl-btn" type="button" data-cancelar>Cancelar</button></form>` : '';
        return `<li class="pl-hist-item"><span class="pl-hist-nome">${esc(nome)}</span><span class="pl-hist-acoes">${acoes}</span><span class="pl-hist-info">${esc(info)}</span>${edicao}</li>`;
      }).join('')}</ul><p class="pl-hist-nota">${h.itens.length} de ${H.LIMITE_SIMULACOES} simulações. A localização nunca é guardada: para refazer, digite o CEP de novo.</p>`;
    }
    const cheio = salvamento && salvamento.estado === 'cheio' ? `<p class="pl-salvar pl-salvar-alerta">Exclua uma simulação para salvar a que você acabou de fazer.</p>` : '';
    const aviso = h.aviso ? `<p class="pl-salvar pl-salvar-ok" role="status">${esc(h.aviso)}</p>` : '';
    dlg.innerHTML = `<div class="pl-dialogo-cab"><h3 id="pl-res-titulo">Histórico de simulações</h3><div class="pl-linha-btns"><button class="pl-btn" type="button" data-fechar>Fechar</button></div></div>${cheio}${aviso}${corpo}`;
    dlg.querySelector('[data-fechar]').onclick = fecharResultado;
    dlg.querySelector('[data-entrar]')?.addEventListener('click', () => abrirLogin());
    dlg.querySelector('[data-recarregar]')?.addEventListener('click', carregarHistorico);
    const achar = (id) => (h.itens || []).find((s) => s.id === id);
    dlg.querySelectorAll('[data-ver]').forEach((b) => b.onclick = () => {
      const s = achar(b.dataset.ver), r = H.lerRetrato(s?.resultado);
      if (!r) { h.aviso = 'Não foi possível abrir esta simulação.'; return renderHistorico(); }
      itemAberto = s; vista = 'resultado'; abaRes = 'resumo';
      renderResultado(r, s.modo === 'facilitado');
      $('#pl-dialogo').querySelector('[data-aba-res="resumo"]')?.focus();
    });
    dlg.querySelectorAll('[data-refazer]').forEach((b) => b.onclick = () => refazer(achar(b.dataset.refazer)));
    dlg.querySelectorAll('[data-renomear]').forEach((b) => b.onclick = () => { h.editando = b.dataset.renomear; h.excluindo = null; h.aviso = ''; renderHistorico(); dlg.querySelector('input[name="rotulo"]')?.focus(); });
    dlg.querySelectorAll('[data-excluir]').forEach((b) => b.onclick = () => { h.excluindo = b.dataset.excluir; h.editando = null; h.aviso = ''; renderHistorico(); dlg.querySelector('[data-excluir-sim]')?.focus(); });
    dlg.querySelectorAll('[data-cancelar]').forEach((b) => b.onclick = () => { h.editando = null; h.excluindo = null; renderHistorico(); });
    dlg.querySelectorAll('[data-form-rotulo]').forEach((f) => f.onsubmit = async (ev) => {
      ev.preventDefault();
      const id = f.dataset.formRotulo, rotulo = H.limparRotulo(f.rotulo.value);
      try { await H.renomear(banco, usuario().uid, id, rotulo); const s = achar(id); if (s) s.rotulo = rotulo; h.editando = null; h.aviso = 'Nome salvo.'; }
      catch { h.aviso = ''; h.erro = true; }
      renderHistorico();
    });
    dlg.querySelectorAll('[data-excluir-sim]').forEach((b) => b.onclick = async () => {
      const id = b.dataset.excluirSim;
      b.disabled = true;
      try {
        await H.excluir(banco, usuario().uid, id);
        h.itens = h.itens.filter((s) => s.id !== id); h.excluindo = null; h.aviso = 'Simulação excluída.';
        if (salvamento && salvamento.estado === 'cheio') { salvamento.estado = null; await salvarAtual(); if (salvamento.estado === 'salvo') { h.aviso = 'Simulação excluída. A simulação nova foi salva.'; await carregarHistorico(); } }
      } catch { h.erro = true; }
      renderHistorico();
    });
  }
  function refazer(s) {
    if (!s) return;
    const e = H.lerEntradas(s.entradas), modo = NOME_MODO[s.modo] ? s.modo : 'padrao';
    fecharResultado();
    S = estadoInicial(); S.modo = modo;
    Object.assign(S, {
      consumoKwh: e.consumoKwh, contaReais: e.contaReais, ligacao: e.ligacao, metas: e.metas, maximo: e.maximo,
      limites: e.limites, areaEditada: e.areaEditada, telhadoTipo: e.telhadoTipo, lajeManual: e.lajeManual, lajePainel: e.lajePainel,
      expert: e.expert, custoEd: e.custoEd, tipoEstrutura: e.tipoEstrutura, sistemaAntigo: e.sistemaAntigo,
    });
    if (e.tarifaDigitada && e.tarifa > 0) { S.tarifa = e.tarifa; S.tarifaFonte = 'usuario'; }
    S.facil.objetivos = new Set(e.objetivos);
    if (S.consumoKwh > 0 && !(S.contaReais > 0)) S.facil.usarKwh = true;
    if (e.telhadoTipo === 'laje') S.facil.tel = 'laje';
    iniciando = true;
    const t = e.telhado, partes = t ? (Array.isArray(t.partes) ? t.partes : Object.values(t.partes || {})) : [];
    if (t && partes.length) {
      editor.norte = t.norte ?? 0; editor.inclinacao = t.inclinacao ?? 20; editor.largura = t.largura ?? 10; editor.comprimento = t.comprimento ?? 8;
      editor.forma = t.forma || 'livre'; editor.modoLivre = editor.forma === 'livre' ? 'pronto' : null; editor.contorno = []; editor.linha = [];
      editor.partes = partes.map((p) => editor._nova((Array.isArray(p.vertices) ? p.vertices : Object.values(p.vertices || {})).map((v) => [Number(v[0]), Number(v[1])]), { invertido: p.invertido === true, inclinacao: p.inclinacao ?? null, incluir: p.incluir ?? null }));
      editor._enquadrar(); editor._mudou(true);
    } else { editor.norte = 0; editor.inclinacao = 20; editor.setForma(TELHADO_PADRAO.forma, TELHADO_PADRAO.largura, TELHADO_PADRAO.comprimento); }
    editor.hist = []; iniciando = false;
    S.telhadoTocado = e.tocado.telhado; S.norteTocado = e.tocado.norte; S.inclTocado = e.tocado.inclinacao;
    $('#pl-cep').value = ''; alternarLocal(false);
    $$('.pl-grade input[data-k]').forEach((i) => validarInput(Object.assign(i, { value: '' })));
    S.invalidos.clear();
    // o modo Facilitado virou Tutorial: simulações antigas feitas nele abrem no Padrão
    trocarModo(modo === 'facilitado' ? 'padrao' : modo);
    { msgLocal('Digite o CEP de novo para buscar os dados da região.'); $('#pl-cep').focus(); }
  }
  /** Desenha cada gráfico na largura real do contêiner e redesenha quando ela muda */
  function montarGraficos(painel, desenhos) {
    observadores.forEach((o) => o.disconnect()); observadores = [];
    painel.querySelectorAll('[data-g]').forEach((el) => {
      const f = desenhos[el.dataset.g]; if (!f) return;
      let largura = 0;
      const desenhar = () => { const w = Math.floor(el.clientWidth); if (w > 0 && w !== largura) { largura = w; el.innerHTML = f(w); } };
      desenhar();
      const ro = new ResizeObserver(desenhar); ro.observe(el); observadores.push(ro);
    });
  }
  const cartao = (n, v, s = '', dest = false) => `<div class="pl-cartao${dest ? ' pl-dest' : ''}"><div class="pl-cartao-n">${n}</div><div class="pl-cartao-v" title="${esc(String(v).replace(/<[^>]+>/g, ''))}">${v}</div>${s ? `<div class="pl-cartao-s" title="${esc(s)}">${s}</div>` : ''}</div>`;
  function renderResultado(r, simples) {
    const dlg = $('#pl-dialogo');
    if (!r.ok) {
      dlg.innerHTML = `<div class="pl-dialogo-cab"><h3 id="pl-res-titulo">Não deu para simular</h3><button class="pl-btn" data-fechar>Editar dados</button></div><p class="pl-aviso">${esc(r.erro)}</p>`;
      dlg.querySelector('[data-fechar]').onclick = fecharResultado; return;
    }
    const salvo = r.salvo === true;
    const expert = salvo ? itemAberto?.modo === 'expert' && r.vpl != null : S.modo === 'expert' && !simples;
    const abas = simples ? [['resumo', 'Resumo'], ['dinheiro', 'Para onde vai o dinheiro'], ['detalhes', 'Detalhes']] : [['resumo', 'Resumo'], ['geracao', 'Geração'], ['dinheiro', 'Para onde vai o dinheiro'], ['detalhes', 'Detalhes']];
    const titulo = salvo ? esc(itemAberto?.rotulo || `Simulação de ${dataCurta(itemAberto?.criadoEm).split(' ')[0]}`) : 'Resultado da simulação';
    const botoes = salvo
      ? '<button class="pl-btn" id="pl-voltar-hist">Voltar ao histórico</button><button class="pl-btn" id="pl-refazer-aberta">Refazer</button><button class="pl-btn" data-fechar>Fechar</button>'
      : `${simples ? '<button class="pl-btn" id="pl-mais-detalhes">Ver com mais detalhes</button>' : ''}<button class="pl-btn" data-fechar>Editar dados</button><button class="pl-btn pl-btn-sol" id="pl-nova">Nova simulação</button>`;
    dlg.innerHTML = `<div class="pl-dialogo-cab"><h3 id="pl-res-titulo">${titulo}${expert && !salvo ? ` <span class="pl-selo" title="Nota informal de confiança, não é margem de erro.">precisão ${precisao().total}%</span>` : ''}</h3>
      <div class="pl-linha-btns">${botoes}</div></div>
      <p class="pl-faixa-fixa">Estimativa para planejamento. Pode conter erros e não substitui orçamento nem projeto de um profissional. <a href="#politicas/aviso">Entenda</a></p>
      <div class="pl-abas" role="tablist" aria-label="Partes do resultado">${abas.map(([k, n]) => `<button role="tab" id="pl-res-tab-${k}" data-aba-res="${k}" aria-controls="pl-res-painel" aria-selected="${k === abaRes}" tabindex="${k === abaRes ? 0 : -1}">${n}</button>`).join('')}</div>
      <div class="pl-res-painel" id="pl-res-painel" role="tabpanel" aria-labelledby="pl-res-tab-${abaRes}" tabindex="0">${conteudoAba(r, abaRes, simples, expert)}</div>`;
    dlg.querySelector('[data-fechar]').onclick = fecharResultado;
    dlg.querySelector('#pl-nova')?.addEventListener('click', novaSimulacao);
    dlg.querySelector('#pl-voltar-hist')?.addEventListener('click', () => { vista = 'historico'; itemAberto = null; renderHistorico(); });
    dlg.querySelector('#pl-refazer-aberta')?.addEventListener('click', () => refazer(itemAberto));
    const caixaSalvar = dlg.querySelector('#pl-salvar'); if (caixaSalvar) ligarFaixa(caixaSalvar);
    if (dlg.querySelector('#pl-mais-detalhes')) dlg.querySelector('#pl-mais-detalhes').onclick = () => { fecharResultado(); trocarModo('padrao'); };
    const series = [{ nome: 'À vista', valores: r.saldos }];
    if (r.financiado) series.push({ nome: 'Financiado', valores: r.financiado.saldos });
    montarGraficos(dlg, {
      saldo: (w) => G.saldo(series, r.payback, w),
      conta: (w) => G.conta(r.contaAntes, r.contaDepois, w),
      mensal: (w) => G.mensal(r.geracaoMensal, r.C, w),
      custos: (w) => G.custoEmpilhado(r.custos.itens, w),
      sensib: (w) => G.sensibilidade(r.sensibilidade || [], w),
    });
    const tabs = Array.from(dlg.querySelectorAll('[data-aba-res]'));
    tabs.forEach((b, i) => {
      b.onclick = () => { abaRes = b.dataset.abaRes; renderResultado(r, simples); dlg.querySelector(`[data-aba-res="${abaRes}"]`).focus(); };
      b.onkeydown = (e) => { const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (d) { e.preventDefault(); tabs[(i + d + tabs.length) % tabs.length].click(); } };
    });
  }
  function conteudoAba(r, aba, simples, expert) {
    const avisos = r.avisos.concat(!r.salvo && S.climaMedia ? ['Usamos uma média da região para o sol.'] : []);
    const salvar = r.salvo ? '' : `<div id="pl-salvar">${faixaSalvar()}</div>`;
    const linhaAvisos = `${salvar}<div class="pl-avisos">${avisos.map((a) => `<span class="pl-aviso">${esc(a)}</span>`).join('')}<span class="pl-aviso">Investimento: faixa aproximada. O orçamento real pode ficar fora dela.</span></div>`;
    if (aba === 'resumo') {
      if (simples) return `${linhaAvisos}<div class="pl-cartoes">${cartao('Painéis solares', `${r.N} painéis`)}${cartao('Custo aproximado', `${fmtR(r.faixa[0])} a ${fmtR(r.faixa[1])}`)}${cartao('Economia por mês', fmtR(r.econMes1), 'no primeiro ano', true)}${cartao('O dinheiro volta em', C.formatarAnos(r.payback), '', true)}</div>
        <div class="pl-res-bloco"><h4>A sua conta de luz</h4><div class="pl-g" data-g="conta"></div><p class="pl-ajuda">A conta não fica zerada: a taxa mínima e a iluminação pública continuam.</p></div>`;
      return `${linhaAvisos}<div class="pl-cartoes">
        ${cartao('Painéis', r.N, `de ${r.premissas.painelWp} Wp`)}${cartao('Potência', `${fmtN(r.kWp, 2)} kWp`, `inversor de ~${fmtN(S.modo === 'expert' && S.expert['inv.kw'] ? S.expert['inv.kw'] : r.inversorKw, 1)} kW`)}
        ${cartao('Área necessária', `${fmtN(r.areaTelhado, 1)} m²`, `${fmtN(r.areaPaineis, 1)} m² de painéis`)}${cartao('Investimento', fmtR(r.custo), `${fmtR(r.faixa[0])} a ${fmtR(r.faixa[1])}`)}
        ${cartao('Economia por mês', fmtR(r.econMes1), `conta de ${fmtR(r.contaAntes)} para ${fmtR(r.contaDepois)}`, true)}${cartao('Se paga em', C.formatarAnos(r.payback), 'valores nominais', true)}
        ${cartao('Saldo em 25 anos', fmtR(r.saldo25))}${cartao('Meta atingida', `${fmtN(r.pctMeta)}%`, r.limitePesou ? `limite: ${r.limitePesou}` : 'nenhum limite pesou')}</div>
        <div class="pl-res-linha"><div class="pl-res-bloco"><h4>Saldo acumulado em 25 anos</h4><div class="pl-g" data-g="saldo"></div></div><div class="pl-res-bloco"><h4>Conta mensal (1º ano)</h4><div class="pl-g" data-g="conta"></div></div></div>`;
    }
    if (aba === 'geracao') {
      return `<div class="pl-res-bloco"><h4>Geração mês a mês · média de ${fmtN(r.geracaoMediaMes)} kWh/mês</h4><div class="pl-g" data-g="mensal"></div></div>
        <div class="pl-res-bloco"><h4>Painéis por parte do telhado (as melhores primeiro)</h4><table class="pl-tabela"><thead><tr><th>Parte</th><th>Direção</th><th>kWh/kWp·ano</th><th>Painéis</th><th>kWh/mês</th></tr></thead><tbody>
        ${r.alocacao.map((a) => `<tr><td>${esc(a.nome)}</td><td>${nomeDirecao(a.azimute)}, ${fmtN(a.inclinacao)}°</td><td>${fmtN(a.Y)}</td><td>${a.n}</td><td>${fmtN(a.anualKwh / 12)}</td></tr>`).join('')}</tbody></table>
        <p class="pl-ajuda">Gerar acima de ${fmtN(r.E_max)} kWh/mês não reduz a conta: a taxa mínima de ${r.D} kWh sempre é paga.</p></div>`;
    }
    if (aba === 'dinheiro') {
      const c = r.custos;
      return `<div class="pl-res-bloco"><h4>Investimento: ${fmtR(c.total)}${c.editado ? ` (${c.diferenca >= 0 ? '+' : '−'}${fmtN(Math.abs(c.diferenca) * 100)}% em relação à média)` : ''}</h4><div class="pl-g pl-g-28" data-g="custos"></div></div>
        <table class="pl-tabela"><thead><tr><th>Item</th><th>Valor-base</th><th>Valor</th><th>%</th></tr></thead><tbody>
        ${c.itens.map((it, i) => `<tr><td><span class="pl-chip-cor ${G.CORES_CUSTO[i]}"></span>${it.nome}${it.editado ? ' (editado)' : ''}</td><td>${it.id === 'frete' ? fmtN(it.unitario, 1) + '% do total' : it.id === 'projeto' ? fmtR(it.unitario) : `R$ ${fmtN(it.unitario, CASAS_CUSTO[it.id])}${it.unidade.slice(2)}`}</td><td>${fmtR(it.valor)}</td><td>${fmtN(it.pct * 100, 1)}%</td></tr>`).join('')}
        </tbody><tfoot><tr><td>Total</td><td></td><td>${fmtR(c.total)}</td><td>100%</td></tr></tfoot></table>
        <p class="pl-ajuda">${S.modo === 'expert' && !simples ? 'Edite os valores em Dados avançados › Custos.' : 'Divisão típica (pesos-base a calibrar com orçamentos reais). No modo Expert dá para editar cada item.'}</p>`;
    }
    const pr = r.premissas, l = r.salvo ? null : S.loc, cl = r.salvo ? null : climaEfetivo();
    const fb = Object.entries(pr.fioB).map(([a, v]) => `${a}: ${fmtN(v * 100)}%`).join(' · ');
    const limites = `<h4 class="pl-limites">Limites desta estimativa</h4><ul class="pl-lista">
      <li>Os dados de clima são médias de vários anos; um ano real pode ter mais ou menos sol.</li>
      <li>A conta real pode ter outras cobranças (iluminação pública, bandeiras, impostos locais).</li>
      <li>O telhado foi simplificado: sombras, caixas d'água e a estrutura real não entram no desenho.</li>
      <li>As regras do setor elétrico e as tarifas mudam com o tempo.</li>
      <li><a href="#politicas/aviso">Leia o Aviso legal</a></li></ul>`;
    const como = `<ul class="pl-lista">
      <li>Local: ${r.salvo ? 'não guardado (por privacidade)' : l ? `${esc(l.cidade)}/${l.uf} (usado só para consultar as APIs; nada é gravado)` : '—'}</li>
      ${cl ? `<li>Sol: ${fmtN(cl.ghiAnual, 2)} kWh/m²/dia (${S.hspUsuario ? 'digitado' : S.climaFonte})</li>` : ''}
      <li>Método: ${r.metodo === 'A' ? 'simplificado' : 'completo, mês a mês, no plano de cada parte, com temperatura'}</li>
      <li>Perdas: ${fmtN(pr.perdasPct, 1)}% · tarifa R$ ${fmtN(r.T, 2)}/kWh${r.salvo ? '' : ` (${S.tarifaFonte === 'usuario' ? 'digitada' : esc(S.tarifaRotulo || 'ANEEL')}, tributos ${fmtN(P.tributos.valor * 100)}%)`}</li>
      <li>Taxa mínima: ${r.D} kWh/mês · consumo de dia: ${fmtN(pr.autoconsumoPct)}%</li>
      <li>Fio B não compensado (Lei 14.300): ${fb} em diante</li>
      <li>Reajuste da tarifa: ${fmtN(pr.reajustePct, 1)}% ao ano · valores nominais</li>
      <li>Preço-base: R$ ${fmtN(pr.precoWp, 2)}/Wp com ajuste pelo tamanho; faixa de ±15%</li>
      <li>Manutenção: ${fmtN(pr.omPct, 1)}% ao ano · troca do inversor no ano ${pr.trocaInversorAno}</li>
      <li>Degradação: ${fmtN(pr.degr1, 1)}% no 1º ano e ${fmtN(pr.degrAno, 1)}% ao ano</li></ul>`;
    const tabela = `<div class="pl-tabela-rolagem"><table class="pl-tabela"><thead><tr><th>Ano</th><th>Geração/mês</th><th>Tarifa</th><th>Fio B</th><th>Economia</th><th>Manut.</th><th>Inversor</th><th>Saldo</th>${r.financiado ? '<th>Parcelas</th><th>Saldo financ.</th>' : ''}</tr></thead><tbody>
      ${r.fluxo.map((x) => `<tr><td>${x.ano}</td><td>${fmtN(x.E)} kWh</td><td>R$ ${fmtN(x.T, 2)}</td><td>${fmtN(x.pctFioB * 100)}%</td><td>${fmtR(x.econ)}</td><td>${fmtR(x.om)}</td><td>${x.troca ? fmtR(x.troca) : '—'}</td><td>${fmtR(x.saldo)}</td>${r.financiado ? `<td>${x.parcelas ? fmtR(x.parcelas) : '—'}</td><td>${fmtR(x.saldoFin)}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
    const ind = expert ? `<div class="pl-cartoes">${cartao('VPL', fmtR(r.vpl), `desconto ${fmtN(ex('fin.desconto'), 1)}% a.a.`)}${cartao('TIR', r.tir == null ? '—' : `${fmtN(r.tir * 100, 1)}% a.a.`)}
      ${cartao('LCOE', r.lcoe ? `R$ ${fmtN(r.lcoe, 2)}/kWh` : '—', r.lcoe ? (r.lcoe < r.T ? 'mais barato que a tarifa' : 'mais caro que a tarifa') : '')}${cartao('Payback descontado', C.formatarAnos(r.paybackDesc))}</div>
      ${r.financiado ? `<div class="pl-cartoes">${cartao('Parcela', `${fmtR(r.financiado.pmt)}/mês`, `${r.financiado.meses} meses, entrada ${fmtR(r.financiado.entrada)}`)}${cartao('Com financiamento', C.formatarAnos(r.financiado.payback), `saldo em 25 anos: ${fmtR(r.financiado.saldo25)}`)}</div>` : ''}
      <div class="pl-res-bloco"><h4>Sensibilidade do retorno</h4><div class="pl-g" style="height:${G.alturaSensibilidade(r.sensibilidade.length)}px" data-g="sensib"></div></div>` : '';
    return `${ind}<div class="pl-res-linha" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)"><div class="pl-res-bloco"><h4>Fluxo de caixa ano a ano</h4>${tabela}</div><div class="pl-res-bloco"><h4>Como calculamos</h4>${como}${limites}</div></div>
      <p class="pl-ajuda">Quer saber como foi para quem já instalou? <a href="#relatos?categoria=desempenho">Ver relatos de quem já instalou</a></p>`;
  }
  raiz.addEventListener('keydown', (ev) => {
    if ($('#pl-sobre').hidden) return;
    if (ev.key === 'Escape') { ev.preventDefault(); fecharResultado(); return; }
    if (ev.key !== 'Tab') return;
    const foc = Array.from($('#pl-dialogo').querySelectorAll('button, [href], input, select, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.disabled && el.offsetParent !== null);
    if (!foc.length) return;
    const pri = foc[0], ult = foc[foc.length - 1];
    if (ev.shiftKey && document.activeElement === pri) { ev.preventDefault(); ult.focus(); }
    else if (!ev.shiftKey && document.activeElement === ult) { ev.preventDefault(); pri.focus(); }
    else if (!$('#pl-dialogo').contains(document.activeElement)) { ev.preventDefault(); pri.focus(); }
  });
  $('#pl-sobre').addEventListener('mousedown', (ev) => { if (ev.target === $('#pl-sobre')) fecharResultado(); });
  function novaSimulacao() {
    const modo = S.modo;
    S = estadoInicial(); S.modo = modo;
    iniciando = true; editor.norte = 0; editor.inclinacao = 20; editor.setForma(TELHADO_PADRAO.forma, TELHADO_PADRAO.largura, TELHADO_PADRAO.comprimento); editor.hist = []; iniciando = false;
    $('#pl-cep').value = ''; msgLocal(''); alternarLocal(false);
    $$('.pl-grade input[data-k]').forEach((i) => validarInput(Object.assign(i, { value: '' })));
    S.invalidos.clear();
    fecharResultado(); trocarModo(modo);
  }

  /* ======================= MODO FACILITADO ======================= */
  const OBJ = [
    { id: 'economia', txt: 'Gastar menos na conta de luz', perg: 'Quantos reais quer economizar por mês?', k: 'metas.reais', pre: 'R$', un: 'por mês', min: 1, max: 5000 },
    { id: 'gerar', txt: 'Gerar uma quantidade de energia', perg: 'Quantos kWh por mês quer gerar?', k: 'metas.kwh', un: 'kWh/mês', min: 1, max: 5000 },
    { id: 'dinheiro', txt: 'Tenho um limite de dinheiro', perg: 'Quanto pode gastar, no máximo?', k: 'limites.orcamento', pre: 'R$', min: 3000, max: 500000 },
    { id: 'espaco', txt: 'Tenho pouco espaço no telhado', perg: 'Quantos metros quadrados tem o telhado?', k: 'limites.area', un: 'm²', min: 2, max: 1000 },
    { id: 'naosei', txt: 'Não sei, só quero ver' },
  ];
  const PASSOS = [['O que você quer?', 'Pode escolher mais de uma opção.'], ['Onde você mora?', 'Usamos o CEP só para buscar dados da sua região. Não guardamos o seu endereço.'], ['Quanto vem a sua conta de luz?', 'Veja na última conta de luz.'], ['Como é o seu telhado?', 'Escolha o mais parecido.'], ['Pronto!', 'O resultado abre por cima desta tela.']];
  const SVG_TEL = {
    comum: '<svg viewBox="0 0 64 40" aria-hidden="true"><path d="M6 20 32 4l26 16z" fill="#94a3b8"/><rect x="13" y="20" width="38" height="17" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    laje: '<svg viewBox="0 0 64 40" aria-hidden="true"><rect x="8" y="12" width="48" height="5" fill="#94a3b8"/><rect x="13" y="17" width="38" height="20" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    naosei: '<svg viewBox="0 0 64 40" aria-hidden="true"><circle cx="32" cy="20" r="15" fill="none" stroke="currentColor" stroke-width="2"/><text x="32" y="27" text-anchor="middle" font-size="20" font-weight="700" fill="currentColor">?</text></svg>',
  };
  const campoF = (k, pre, un, min, max, v, rot) => `<span class="pl-entrada">${pre ? `<span class="pl-un pl-un-pre">${pre}</span>` : ''}<input data-fk="${k}" data-min="${min}" data-max="${max}" inputmode="decimal" aria-label="${esc(rot)}" value="${v == null ? '' : String(v).replace('.', ',')}">${un ? `<span class="pl-un">${un}</span>` : ''}</span>`;
  function renderFacil(msg = '', erro = false) {
    const f = S.facil, [tit, aj] = PASSOS[f.passo];
    let corpo = '';
    if (f.passo === 0) corpo = `<div class="pl-opcoes">${OBJ.map((o) => { const on = f.objetivos.has(o.id); return `<button class="pl-opcao" data-obj="${o.id}" aria-pressed="${on}"><span class="pl-opcao-marca" aria-hidden="true">${on ? '✓' : ''}</span>${o.txt}</button>${on && o.k ? `<div class="pl-opcao-campo"><span>${o.perg}</span>${campoF(o.k, o.pre, o.un, o.min, o.max, getK(S, o.k), o.perg)}</div>` : ''}`; }).join('')}</div>`;
    else if (f.passo === 1) corpo = f.porLista
      ? `<div class="pl-campos pl-campos-2"><label class="pl-campo"><span class="pl-rotulo">Estado</span><select class="pl-select" id="pl-f-uf"><option value="">Escolha</option>${opcoesUF(f.uf)}</select></label><label class="pl-campo"><span class="pl-rotulo">Cidade</span><select class="pl-select" id="pl-f-cidade" disabled><option value="">Escolha o estado</option></select></label></div><button class="pl-link" id="pl-f-cep" style="align-self:start">Prefiro digitar o CEP</button>`
      : `<span class="pl-entrada"><input id="pl-f-cep-in" inputmode="numeric" placeholder="00000-000" maxlength="9" aria-label="CEP" value="${esc(f.cep)}"></span><button class="pl-link" id="pl-f-lista" style="align-self:start">Não sei o CEP: escolher a cidade na lista</button>`;
    else if (f.passo === 2) corpo = f.usarKwh
      ? `${campoF('consumoKwh', '', 'kWh por mês', 50, 5000, S.consumoKwh, 'Consumo em kWh por mês')}<button class="pl-link" id="pl-f-alt" style="align-self:start">Prefiro dizer em reais</button>`
      : `${campoF('contaReais', 'R$', 'por mês', 30, 5000, S.contaReais, 'Valor da conta em reais por mês')}<button class="pl-link" id="pl-f-alt" style="align-self:start">Sei o consumo em kWh</button>`;
    else if (f.passo === 3) corpo = `<div class="pl-telhados">${[['comum', 'Telhado comum'], ['laje', 'Laje (plano)'], ['naosei', 'Não sei']].map(([v, t]) => `<button class="pl-opcao" data-tel="${v}" aria-pressed="${f.tel === v}">${SVG_TEL[v]}${t}</button>`).join('')}</div>`;
    else corpo = `<button class="pl-btn pl-btn-sol" id="pl-f-ver" style="align-self:start">Ver o resultado</button>`;
    $('#pl-facil').innerHTML = `<div class="pl-facil-card" role="form" aria-labelledby="pl-f-titulo">
      <div class="pl-facil-prog"><span>Passo ${f.passo + 1} de 5</span><div aria-hidden="true"><span class="pl-barra" style="width:${((f.passo + 1) / 5) * 100}%"></span></div></div>
      <div class="pl-facil-q"><h3 id="pl-f-titulo" tabindex="-1">${tit}</h3>${'speechSynthesis' in window ? '<button class="pl-btn" id="pl-f-ouvir">Ouvir</button>' : ''}</div>
      <p class="pl-facil-ajuda">${aj}</p>${corpo}
      <p class="pl-msg${erro ? ' pl-msg-erro' : ''}" role="status" aria-live="polite" style="font-size:14px;min-height:20px">${esc(msg)}</p>
      <div class="pl-facil-nav">${f.passo > 0 ? '<button class="pl-btn" id="pl-f-voltar">Voltar</button>' : '<span></span>'}${f.passo < 4 ? '<button class="pl-btn pl-btn-sol" id="pl-f-cont">Continuar</button>' : ''}</div></div>`;
    ligarFacil();
  }
  function ligarFacil() {
    const f = S.facil, q = (s) => $('#pl-facil').querySelector(s);
    if (q('#pl-f-ouvir')) q('#pl-f-ouvir').onclick = () => { const [t, a] = PASSOS[f.passo]; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(`${t}. ${a}${f.passo === 0 ? ' Opções: ' + OBJ.map((o) => o.txt).join('; ') : ''}`); u.lang = 'pt-BR'; speechSynthesis.speak(u); };
    $$('[data-obj]').forEach((b) => b.onclick = () => {
      const id = b.dataset.obj, o = OBJ.find((x) => x.id === id);
      if (f.objetivos.has(id)) { f.objetivos.delete(id); if (o.k) setK(S, o.k, null); if (id === 'naosei') S.maximo = false; if (id === 'espaco') S.areaEditada = false; }
      else { f.objetivos.add(id); if (id === 'naosei') S.maximo = true; }
      renderFacil(); const i = q(`[data-obj="${id}"] + .pl-opcao-campo input`); if (i) i.focus();
    });
    $$('[data-fk]').forEach((i) => i.oninput = () => {
      const v = num(i.value), ok = v == null || (v >= +i.dataset.min && v <= +i.dataset.max);
      setK(S, i.dataset.fk, ok ? v : null); if (i.dataset.fk === 'limites.area') S.areaEditada = v != null;
      i.closest('.pl-entrada').style.borderColor = ok ? '' : 'var(--pl-erro)';
      const m = q('.pl-msg'); m.textContent = ok ? '' : `Digite um valor entre ${fmtN(+i.dataset.min)} e ${fmtN(+i.dataset.max)}.`; m.className = 'pl-msg' + (ok ? '' : ' pl-msg-erro');
    });
    if (q('#pl-f-cep-in')) { const c = q('#pl-f-cep-in'); c.oninput = () => { c.value = mascaraCep(c.value); f.cep = c.value; }; c.onkeydown = (e) => { if (e.key === 'Enter') continuarFacil(); }; }
    if (q('#pl-f-lista')) q('#pl-f-lista').onclick = () => { f.porLista = true; renderFacil(); };
    if (q('#pl-f-cep')) q('#pl-f-cep').onclick = () => { f.porLista = false; renderFacil(); };
    if (q('#pl-f-uf')) {
      q('#pl-f-uf').onchange = async (e) => { f.uf = e.target.value; f.cidade = ''; if (f.uf) await preencherCidades(q('#pl-f-cidade'), f.uf); };
      if (f.uf) preencherCidades(q('#pl-f-cidade'), f.uf, f.cidade);
      q('#pl-f-cidade').onchange = (e) => { f.cidade = e.target.value; };
    }
    if (q('#pl-f-alt')) q('#pl-f-alt').onclick = () => { f.usarKwh = !f.usarKwh; if (f.usarKwh) S.contaReais = null; else S.consumoKwh = null; renderFacil(); };
    $$('[data-tel]').forEach((b) => b.onclick = () => { f.tel = b.dataset.tel; S.telhadoTipo = f.tel === 'laje' ? 'laje' : 'comum'; renderFacil(); });
    if (q('#pl-f-voltar')) q('#pl-f-voltar').onclick = () => { f.passo--; renderFacil(); q('#pl-f-titulo').focus(); };
    if (q('#pl-f-cont')) q('#pl-f-cont').onclick = continuarFacil;
    if (q('#pl-f-ver')) q('#pl-f-ver').onclick = mostrarFacil;
  }
  async function continuarFacil() {
    const f = S.facil;
    if (f.passo === 0) {
      if (!f.objetivos.size) return renderFacil('Escolha pelo menos uma opção.', true);
      const o = OBJ.find((x) => x.k && f.objetivos.has(x.id) && !(getK(S, x.k) > 0));
      if (o) return renderFacil(`Preencha: ${o.perg}`, true);
    }
    if (f.passo === 1) {
      try {
        if (f.porLista) {
          if (!f.uf || !f.cidade) return renderFacil('Escolha o estado e a cidade.', true);
          if (!(S.loc && S.loc.cidade === f.cidade && S.loc.uf === f.uf)) { renderFacil('Buscando os dados da sua região…'); S.avisoFacil = (await localizarPorCidade(f.uf, f.cidade)).join(' '); }
        } else {
          const c = f.cep.replace(/\D/g, '');
          if (c.length !== 8) return renderFacil('Esse CEP não parece certo. Confira os 8 números.', true);
          if (!(S.loc && S.loc.cep === c)) { renderFacil('Buscando os dados da sua região…'); S.avisoFacil = (await localizarPorCep(c)).join(' '); }
        }
      } catch (e) { return renderFacil(e.message === 'cep-invalido' ? 'Esse CEP não parece certo. Confira os 8 números.' : 'Não conseguimos achar agora. Escolha a cidade na lista.', true); }
    }
    if (f.passo === 2 && !(S.contaReais > 0) && !(S.consumoKwh > 0)) return renderFacil('Digite o valor da sua conta de luz.', true);
    if (f.passo === 3 && !f.tel) { f.tel = 'naosei'; S.telhadoTipo = 'comum'; }
    f.passo++; renderFacil(); $('#pl-facil').querySelector('#pl-f-titulo').focus();
    if (f.passo === 4) mostrarFacil();
  }
  function mostrarFacil() {
    const { e } = entrada('A');
    e.limites.area = S.areaEditada ? S.limites.area : null; // no Facilitado só vale a área que a pessoa digitou
    const r = C.simular(e);
    if (r.ok && S.avisoFacil) r.avisos.push(S.avisoFacil);
    abrirResultado(r, true);
  }

  /* ======================= MODOS ======================= */
  const MODOS = ['tutorial', 'padrao', 'expert'];
  function trocarModo(m) {
    if (m === 'facilitado') m = 'padrao'; // o Facilitado foi substituído pelo Tutorial
    S.modo = m;
    raiz.dataset.modo = m;
    $$('.pl-modo').forEach((b) => { const on = b.dataset.modo === m; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    $('.pl-modos').style.setProperty('--pl-i', MODOS.indexOf(m));
    $('#pl-corpo').setAttribute('aria-labelledby', `pl-tab-${m}`);
    $('.pl-grade').hidden = m === 'tutorial';
    $('#pl-facil').hidden = true;
    $('#pl-tutorial').hidden = m !== 'tutorial';
    const video = $('#pl-tutorial-video');
    if (m !== 'tutorial') video.pause();
    $('#pl-stats').hidden = true; // card de precisão removido: a barra não ajudava a pessoa; o "Falta: …" acima do botão já diz o que precisa
    $('#pl-avancado').hidden = m !== 'expert';
    if (m === 'tutorial') {
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) video.play().catch(() => {});
    } else if (m === 'facilitado') {
      const f = S.facil;
      OBJ.forEach((o) => { if (o.k && getK(S, o.k) > 0 && (o.id !== 'espaco' || S.areaEditada)) f.objetivos.add(o.id); });
      if (S.loc && S.loc.cep) f.cep = mascaraCep(S.loc.cep);
      if (S.consumoKwh > 0 && !(S.contaReais > 0)) f.usarKwh = true;
      renderFacil();
    } else {
      if (m === 'expert') renderAvancado();
      // Padrão: a casinha com perguntas; Expert: o desenho livre (os dois usam o mesmo editor)
      $('#pl-t-area').textContent = m === 'expert' ? 'Área disponível' : 'Seu telhado';
      if (m === 'padrao') casinha.render();
      sincronizarCampos(); renderPasso(); editor.redimensionar(); atualizar();
    }
  }
  $('#pl-tutorial-ir').onclick = () => trocarModo('padrao');
  // vídeo gravado com MediaRecorder vem sem duração: um salto ao fim faz o navegador calculá-la (a barra de tempo passa a funcionar)
  $('#pl-tutorial-video').addEventListener('loadedmetadata', function () { if (!isFinite(this.duration)) { this.currentTime = 1e7; this.addEventListener('timeupdate', () => { this.currentTime = 0; }, { once: true }); } });
  $$('.pl-modo').forEach((b, i) => {
    b.onclick = () => trocarModo(b.dataset.modo);
    b.onkeydown = (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 1, ArrowUp: -1 }[e.key];
      if (e.key === 'Home' || e.key === 'End' || d) { e.preventDefault(); const n = e.key === 'Home' ? 0 : e.key === 'End' ? 2 : (i + d + 3) % 3; trocarModo(MODOS[n]); $$('.pl-modo')[n].focus(); }
    };
  });

  /* ======================= LIGAÇÕES ======================= */
  $('#pl-cep').addEventListener('input', (e) => { e.target.value = mascaraCep(e.target.value); });
  $('#pl-cep').addEventListener('keydown', (e) => { if (e.key === 'Enter') buscarPorCep(); });
  $('#pl-buscar').onclick = buscarPorCep;
  $('#pl-alterna-local').onclick = () => alternarLocal(!S.listaLocal);
  $('#pl-uf').onchange = (e) => { if (e.target.value) preencherCidades($('#pl-cidade'), e.target.value); };
  $('#pl-cidade').onchange = async (e) => {
    if (!e.target.value) return;
    msgLocal('Buscando os dados da sua região…');
    try { const av = await localizarPorCidade($('#pl-uf').value, e.target.value); msgLocal(av.join(' ') || 'Dados encontrados.'); }
    catch { msgLocal('Não conseguimos achar essa cidade.', true); }
    atualizar();
  };
  $('#pl-etiquetas').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) editarEtiqueta(b.parentElement.dataset.et, b.parentElement); });
  $$('#pl-ligacao button').forEach((b) => b.onclick = () => { S.ligacao = b.dataset.v; sincronizarCampos(); atualizar(); });
  $$('#pl-passos button').forEach((b, i, all) => {
    b.onclick = () => { S.passoTelhado = b.dataset.passo; renderPasso(); };
    b.onkeydown = (e) => { const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (d) { e.preventDefault(); const n = all[(i + d + all.length) % all.length]; n.click(); n.focus(); } };
  });
  $$('[data-aba-av]').forEach((b) => b.onclick = () => { S.abaAvancada = b.dataset.abaAv; renderAvancado(); });
  $('#pl-simular').onclick = () => { const r = C.simular(entrada('B').e); S.res = r; editorInfo(); renderPartes(); abrirResultado(r, false); };

  // o editor nunca começa vazio: duas partes, 10 m × 8 m, norte para cima, 20°
  editor.setForma(TELHADO_PADRAO.forma, TELHADO_PADRAO.largura, TELHADO_PADRAO.comprimento);
  editor.hist = [];
  iniciando = false;
  trocarModo('padrao');

  $('#pl-historico').onclick = abrirHistorico;

  /* API pública mínima (usada pela entrada da seção) */
  return {
    estado: () => S, editor, trocarModo, abrirHistorico,
    /** Login mudou: salva o resultado aberto (se faltava o login) e atualiza o histórico aberto. */
    aoMudarLogin: () => {
      if (vista === 'resultado' && salvamento && ['visitante', 'erro'].includes(salvamento.estado)) { salvamento.estado = null; salvarAtual(); }
      else if (salvamento && salvamento.estado === 'visitante' && !usuario()) atualizarFaixa();
      if (vista === 'historico') { historico.itens = null; carregarHistorico(); }
      if (vista === 'resultado' && itemAberto && !usuario()) fecharResultado();
    },
    definirLocalPorCep: async (cep) => { const av = await localizarPorCep(cep); sincronizarCampos(); atualizar(); return av; },
    preencher: (campos) => { for (const [k, v] of Object.entries(campos)) setK(S, k, v); sincronizarCampos(); atualizar(); },
    simular: () => $('#pl-simular').click(),
    resultadoFacilitado: () => { S.facil.passo = 4; renderFacil(); mostrarFacil(); },
    abrirAba: (aba) => { const b = $(`[data-aba-res="${aba}"]`); if (b) b.click(); },
  };
}
