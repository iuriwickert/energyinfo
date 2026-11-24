/**
 * historico.js — histórico de simulações no banco (especificação, seção 11).
 * Nó: simulacoes/{uid}/{id}. NUNCA grava localização (CEP, cidade, UF, coordenadas,
 * distribuidora). O banco chega por parâmetro (contexto.firebase), sem importar o SDK.
 */

export const LIMITE_SIMULACOES = 20;
export const TAMANHO_ROTULO = 40;

// O Realtime Database não aceita "." nas chaves; os campos do expert usam "painel.wp".
const paraBanco = (obj) => Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k.replace(/\./g, '_'), v]));
const doBanco = (obj) => Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k.replace(/_/g, '.'), v]));

// Tira undefined, NaN e Infinity (o banco recusa) passando por JSON.
const limpo = (valor) => JSON.parse(JSON.stringify(valor ?? null));

/** Entradas sem localização, a partir do estado da interface. */
export function montarEntradas(S, telhado) {
  return limpo({
    consumoKwhMes: S.consumoKwh,
    contaReaisMes: S.contaReais,
    tarifaKwh: S.tarifa,
    tarifaDigitada: S.tarifaFonte === 'usuario',
    tipoLigacao: S.ligacao,
    metas: S.metas,
    maximo: S.maximo,
    limites: S.limites,
    areaEditada: S.areaEditada,
    telhadoTipo: S.telhadoTipo,
    telhado,
    lajeManual: S.lajeManual,
    lajePainel: S.lajePainel,
    expert: paraBanco(S.expert),
    custoEd: S.custoEd,
    tipoEstrutura: S.tipoEstrutura,
    sistemaAntigo: S.sistemaAntigo,
    objetivos: [...(S.facil?.objetivos ?? [])],
    tocado: { telhado: S.telhadoTocado, norte: S.norteTocado, inclinacao: S.inclTocado }
  });
}

/** Devolve as entradas lidas do banco no formato do estado (com padrões para o que faltar). */
export function lerEntradas(entradas = {}) {
  const e = entradas || {};
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  return {
    consumoKwh: num(e.consumoKwhMes),
    contaReais: num(e.contaReaisMes),
    tarifa: e.tarifaDigitada ? num(e.tarifaKwh) : null,
    tarifaDigitada: e.tarifaDigitada === true,
    ligacao: ['mono', 'bi', 'tri'].includes(e.tipoLigacao) ? e.tipoLigacao : 'bi',
    metas: { reais: num(e.metas?.reais), kwh: num(e.metas?.kwh), coberturaPct: num(e.metas?.coberturaPct), paybackAnos: num(e.metas?.paybackAnos) },
    maximo: e.maximo === true,
    limites: { orcamento: num(e.limites?.orcamento), area: num(e.limites?.area), paineis: num(e.limites?.paineis) },
    areaEditada: e.areaEditada === true,
    telhadoTipo: e.telhadoTipo === 'laje' ? 'laje' : 'comum',
    telhado: e.telhado || null,
    lajeManual: e.lajeManual === true,
    lajePainel: { inclinacao: num(e.lajePainel?.inclinacao), azimute: num(e.lajePainel?.azimute) ?? 0 },
    expert: doBanco(e.expert),
    custoEd: e.custoEd || {},
    tipoEstrutura: e.tipoEstrutura || null,
    sistemaAntigo: e.sistemaAntigo === true,
    objetivos: Array.isArray(e.objetivos) ? e.objetivos : Object.values(e.objetivos || {}),
    tocado: { telhado: e.tocado?.telhado === true, norte: e.tocado?.norte === true, inclinacao: e.tocado?.inclinacao === true }
  };
}

/** Retrato do resultado: o bastante para reabrir sem recalcular, e os campos da especificação. */
export function montarResultado(r) {
  return limpo({
    paineis: r.N,
    kwp: r.kWp,
    areaM2: r.areaTelhado,
    investimento: { minimo: r.faixa[0], central: r.custo, maximo: r.faixa[1] },
    economiaMes: r.econMes1,
    paybackMeses: r.payback == null ? null : Math.round(r.payback * 12),
    saldo25: r.saldo25,
    metaPct: r.pctMeta,
    geracaoMensal: r.geracaoMensal,
    distribuicaoCusto: Object.fromEntries(r.custos.itens.map((it) => [it.id, it.valor])),
    fluxo25: r.saldos.slice(1),
    retrato: {
      ok: true, metodo: r.metodo, N: r.N, nMeta: r.nMeta, kWp: r.kWp, inversorKw: r.inversorKw,
      areaTelhado: r.areaTelhado, areaPaineis: r.areaPaineis, custo: r.custo, faixa: r.faixa,
      econMes1: r.econMes1, contaAntes: r.contaAntes, contaDepois: r.contaDepois, payback: r.payback,
      saldo25: r.saldo25, pctMeta: r.pctMeta, limitePesou: r.limitePesou, geracaoMensal: r.geracaoMensal,
      geracaoMediaMes: r.geracaoMediaMes, C: r.C, D: r.D, T: r.T, E_max: r.E_max, saldos: r.saldos,
      avisos: r.avisos, premissas: r.premissas,
      alocacao: r.alocacao.map((a) => ({ id: a.id, nome: a.nome, n: a.n, Y: a.Y, anualKwh: a.anualKwh, inclinacao: a.inclinacao, azimute: a.azimute })),
      custos: {
        total: r.custos.total, editado: r.custos.editado, diferenca: r.custos.diferenca,
        itens: r.custos.itens.map((it) => ({ id: it.id, nome: it.nome, unidade: it.unidade, unitario: it.unitario, valor: it.valor, pct: it.pct, editado: it.editado }))
      },
      fluxo: r.fluxo,
      financiado: r.financiado || null,
      vpl: r.vpl, tir: r.tir, lcoe: r.lcoe, paybackDesc: r.paybackDesc,
      sensibilidade: r.sensibilidade || null
    }
  });
}

const lista = (v) => (Array.isArray(v) ? v : Object.values(v || {}));

/** Reconstrói o resultado salvo para a mesma tela do resultado. */
export function lerRetrato(resultado) {
  const r = resultado?.retrato;
  if (!r) return null;
  return {
    ...r,
    ok: true,
    payback: typeof r.payback === 'number' ? r.payback : null,
    limitePesou: r.limitePesou || null,
    avisos: lista(r.avisos),
    saldos: lista(r.saldos),
    geracaoMensal: lista(r.geracaoMensal),
    faixa: lista(r.faixa),
    alocacao: lista(r.alocacao),
    fluxo: lista(r.fluxo).map((x) => ({ troca: 0, parcelas: 0, ...x })),
    custos: { ...r.custos, itens: lista(r.custos?.itens) },
    financiado: r.financiado ? { ...r.financiado, saldos: lista(r.financiado.saldos), payback: r.financiado.payback ?? null } : null,
    sensibilidade: r.sensibilidade ? lista(r.sensibilidade).map((c) => ({ ...c, payback: c.payback ?? null })) : null,
    tir: r.tir ?? null,
    paybackDesc: r.paybackDesc ?? null,
    premissas: { ...r.premissas, fioB: r.premissas?.fioB || {} },
    salvo: true
  };
}

/** Lista do mais recente para o mais antigo: [{ id, criadoEm, modo, rotulo, resultado, entradas }]. */
export async function listar(banco, uid) {
  const tudo = await banco.ler(`simulacoes/${uid}`);
  return Object.entries(tudo || {})
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
}

/**
 * Salva uma simulação. Se já houver 20, não salva e devolve { cheio: true }
 * (nada some sozinho: a pessoa decide qual excluir).
 */
export async function salvar(banco, uid, { modo, entradas, resultado }) {
  const atuais = await banco.ler(`simulacoes/${uid}`);
  if (Object.keys(atuais || {}).length >= LIMITE_SIMULACOES) return { cheio: true };
  const id = await banco.novaChave(`simulacoes/${uid}`);
  await banco.gravar(`simulacoes/${uid}/${id}`, { criadoEm: new Date().toISOString(), modo, rotulo: '', entradas, resultado });
  return { id };
}

export function limparRotulo(texto) {
  return String(texto ?? '').replace(/\s+/g, ' ').trim().slice(0, TAMANHO_ROTULO);
}

export const renomear = (banco, uid, id, rotulo) => banco.atualizar(`simulacoes/${uid}/${id}`, { rotulo: limparRotulo(rotulo) });
export const excluir = (banco, uid, id) => banco.apagar(`simulacoes/${uid}/${id}`);
export const excluirTodas = (banco, uid) => banco.apagar(`simulacoes/${uid}`);
