// Solis: chatbot SEM inteligência artificial.
// Este arquivo tem o algoritmo (funções puras, testadas com node --test) e o
// ponto de entrada da seção. Tudo o que mexe na tela está em interface.js.
//
// O algoritmo compara o texto digitado com as perguntas de solis-base.json:
//   1. normaliza o texto (minúsculas, sem acento, sem pontuação);
//   2. quebra em palavras e tira as stopwords;
//   3. tira um "s" final das palavras com mais de 3 letras;
//   4. soma +2 para cada palavra-chave presente e +1 para cada palavra do
//      texto que aparece no enunciado da pergunta;
//   5. responde a de maior pontuação, se chegar ao limite mínimo
//      (empate: vence a de menor "ordem").

/** Minúsculas, sem acentos, sem pontuação, espaços únicos. "14.300" vira "14300". */
export function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/(\d)[.,](?=\d)/g, '$1')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Plural simples: tira um "s" final de palavras com mais de 3 letras. */
export function reduzir(palavra) {
  return palavra.length > 3 && palavra.endsWith('s') ? palavra.slice(0, -1) : palavra;
}

/** Palavras úteis de um texto: normalizadas, sem stopwords, reduzidas e sem repetição. */
export function extrairPalavras(texto, stopwords = new Set()) {
  const palavras = [];
  for (const palavra of normalizar(texto).split(' ')) {
    if (!palavra || stopwords.has(palavra)) continue;
    const reduzida = reduzir(palavra);
    if (!palavras.includes(reduzida)) palavras.push(reduzida);
  }
  return palavras;
}

const preparadas = new WeakMap();

// Prepara a base uma vez só: stopwords, palavras-chave e enunciados já normalizados.
function preparar(base) {
  let pronta = preparadas.get(base);
  if (pronta) return pronta;
  const stopwords = new Set((base.stopwords ?? []).map(normalizar).filter(Boolean));
  const perguntas = (base.perguntas ?? []).map((pergunta) => {
    // Uma palavra-chave pode ter mais de uma palavra ("vale a pena"): vale quando todas aparecem.
    const chaves = new Map();
    for (const chave of pergunta.palavrasChave ?? []) {
      const partes = extrairPalavras(chave, stopwords);
      if (partes.length > 0) chaves.set([...partes].sort().join(' '), partes);
    }
    return {
      pergunta,
      chaves: [...chaves.values()],
      enunciado: new Set(extrairPalavras(pergunta.pergunta, stopwords))
    };
  });
  pronta = { stopwords, perguntas };
  preparadas.set(base, pronta);
  return pronta;
}

function pontuar(palavras, { chaves, enunciado }) {
  let pontos = 0;
  for (const partes of chaves) {
    if (partes.every((parte) => palavras.has(parte))) pontos += 2;
  }
  for (const palavra of palavras) {
    if (enunciado.has(palavra)) pontos += 1;
  }
  return pontos;
}

/** Lista todas as perguntas com pontuação maior que zero, da melhor para a pior. */
export function classificar(texto, base) {
  const { stopwords, perguntas } = preparar(base);
  const palavras = new Set(extrairPalavras(texto, stopwords));
  return perguntas
    .map((item) => ({ pergunta: item.pergunta, pontos: pontuar(palavras, item) }))
    .filter((item) => item.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos || a.pergunta.ordem - b.pergunta.ordem);
}

/**
 * Decide o que a Solis responde.
 * Devolve { tipo: 'vazio' } (texto vazio ou só de stopwords),
 * { tipo: 'sem-resposta', mensagem } ou { tipo: 'resposta', pergunta, pontos }.
 */
export function responder(texto, base) {
  const { stopwords } = preparar(base);
  if (extrairPalavras(texto, stopwords).length === 0) return { tipo: 'vazio' };
  const [melhor] = classificar(texto, base);
  const limite = Number.isFinite(base.limiteMinimo) ? base.limiteMinimo : 2;
  if (!melhor || melhor.pontos < limite) {
    return { tipo: 'sem-resposta', mensagem: base.mensagemSemResposta };
  }
  return { tipo: 'resposta', pergunta: melhor.pergunta, pontos: melhor.pontos };
}

/**
 * Próximas pílulas: as sugestões ainda não usadas, na ordem do arquivo.
 * Se acabarem, volta ao início. `usadas` é um Set de ids e pode ser esvaziado aqui.
 */
export function proximasSugestoes(base, usadas, quantidade = 3) {
  const todas = (base.perguntas ?? []).filter((pergunta) => pergunta.sugestao === true);
  let livres = todas.filter((pergunta) => !usadas.has(pergunta.id));
  if (livres.length === 0) {
    usadas.clear();
    livres = todas;
  }
  const escolhidas = livres.slice(0, quantidade);
  // Sobraram menos que o pedido: completa com as do início.
  for (const pergunta of todas) {
    if (escolhidas.length >= Math.min(quantidade, todas.length)) break;
    if (!escolhidas.includes(pergunta)) escolhidas.push(pergunta);
  }
  return escolhidas;
}

/** Confere o formato da base. Devolve a lista de problemas (vazia = tudo certo). */
export function validarBase(base) {
  const problemas = [];
  if (!base || typeof base !== 'object') return ['A base não é um objeto.'];
  if (!Number.isFinite(base.limiteMinimo)) problemas.push('limiteMinimo precisa ser um número.');
  if (!Array.isArray(base.stopwords)) problemas.push('stopwords precisa ser uma lista.');
  if (typeof base.mensagemSemResposta !== 'string' || !base.mensagemSemResposta.trim()) {
    problemas.push('mensagemSemResposta está vazia.');
  }
  if (!Array.isArray(base.perguntas) || base.perguntas.length === 0) {
    problemas.push('perguntas precisa ser uma lista com itens.');
    return problemas;
  }
  const ids = new Set();
  base.perguntas.forEach((pergunta, posicao) => {
    const nome = pergunta?.id || `item ${posicao + 1}`;
    if (typeof pergunta?.id !== 'string' || !pergunta.id.trim()) problemas.push(`${nome}: id vazio.`);
    else if (ids.has(pergunta.id)) problemas.push(`${nome}: id repetido.`);
    ids.add(pergunta?.id);
    if (typeof pergunta?.pergunta !== 'string' || !pergunta.pergunta.trim()) problemas.push(`${nome}: pergunta vazia.`);
    if (typeof pergunta?.resposta !== 'string' || !pergunta.resposta.trim()) problemas.push(`${nome}: resposta vazia.`);
    const chaves = pergunta?.palavrasChave;
    if (!Array.isArray(chaves) || chaves.length === 0 || chaves.some((chave) => typeof chave !== 'string' || !chave.trim())) {
      problemas.push(`${nome}: palavrasChave vazia ou com item vazio.`);
    }
    if (typeof pergunta?.sugestao !== 'boolean') problemas.push(`${nome}: sugestao precisa ser true ou false.`);
    if (!Number.isFinite(pergunta?.ordem)) problemas.push(`${nome}: ordem precisa ser um número.`);
    if (pergunta?.aviso !== undefined && typeof pergunta.aviso !== 'boolean') problemas.push(`${nome}: aviso precisa ser true ou false.`);
  });
  return problemas;
}

// ---------- Ponto de entrada da seção ----------

let ativa = null;

export async function iniciarSolis(raiz) {
  destruir();
  const { montarInterface } = await import('./interface.js');
  ativa = await montarInterface(raiz, { responder, proximasSugestoes });
}

export function destruir() {
  ativa?.destruir();
  ativa = null;
}
