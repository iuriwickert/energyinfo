// Planejador solar: entrada da seção (iniciarPlanejador / destruir).
// Liga a interface (ui.js) à casca: login, banco, âncora #planejador?historico=1
// e o protocolo de exclusão de dados da conta.
import { initPlanejador } from './ui.js';
import { excluirTodas } from './historico.js';

let raizAtual = null;
let painel = null;
let contextoAtual = null;
const escutas = [];

function carregarCss(arquivo) {
  const href = new URL(arquivo, import.meta.url).href;
  if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
  return new Promise((resolver, rejeitar) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolver();
    link.onerror = () => rejeitar(new Error(`Não foi possível carregar ${arquivo}`));
    document.head.append(link);
  });
}

function escutar(alvo, evento, fn) {
  alvo.addEventListener(evento, fn);
  escutas.push(() => alvo.removeEventListener(evento, fn));
}

// Lê o nó "parametros" do banco (só leitura; as faixas são conferidas em parametros.js).
function leitorDeParametros(banco) {
  if (!banco) return undefined;
  return async () => {
    const tudo = await banco.ler('parametros');
    return Object.entries(tudo || {}).map(([id, doc]) => ({ id, ...(doc || {}) }));
  };
}

function querHistorico() {
  const [base, busca = ''] = location.hash.slice(1).split('?');
  return base === 'planejador' && new URLSearchParams(busca).get('historico') === '1';
}

export async function iniciarPlanejador(raiz, contexto = {}) {
  destruir();
  await carregarCss('./ui.css');
  raizAtual = raiz;
  contextoAtual = contexto;
  const banco = contexto.firebase ?? null;

  const caixa = document.createElement('div');
  raiz.replaceChildren(caixa);
  painel = await initPlanejador(caixa, {
    lerParametros: leitorDeParametros(banco),
    banco,
    usuario: () => contextoAtual?.usuario ?? null,
    abrirLogin: () => contextoAtual?.abrirLogin?.('entrar')
  });

  // A casca atualiza contexto.usuario antes; aqui só reagimos.
  escutar(document, 'ei:login-mudou', () => queueMicrotask(() => painel?.aoMudarLogin()));

  // Excluir simulações / excluir a conta: apaga simulacoes/{uid}.
  const apagarSimulacoes = (evento) => {
    const { uid, tarefas } = evento.detail || {};
    if (banco && uid && Array.isArray(tarefas)) tarefas.push(excluirTodas(banco, uid));
  };
  escutar(document, 'ei:simulacoes-excluir', apagarSimulacoes);
  escutar(document, 'ei:conta-excluindo', apagarSimulacoes);

  // #planejador?historico=1 (menu do apelido e rodapé) abre o histórico.
  const verAncora = () => { if (querHistorico()) painel?.abrirHistorico(); };
  escutar(window, 'hashchange', verAncora);
  verAncora();

  return { abrirHistorico: () => painel?.abrirHistorico() };
}

export function destruir() {
  while (escutas.length) escutas.pop()();
  raizAtual?.replaceChildren();
  raizAtual = null;
  painel = null;
  contextoAtual = null;
}
