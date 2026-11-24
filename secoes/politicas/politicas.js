// Políticas: Termos de uso, Privacidade e Aviso legal, numa sobreposição com abas.
// Abre e troca de aba pela âncora (#politicas/termos, /privacidade, /aviso), então
// qualquer seção chega aqui só com um link, sem importar nada desta pasta.
// Os textos ficam em textos/*.html, separados do código e fáceis de editar.
import { abrirSobreposicao } from '../../nucleo/sobreposicao.js';
import { ABAS, ATUALIZADO_EM, lerAncora, ancoraDaAba } from './ancora.js';

let ativo = null;

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

export async function iniciarPoliticas() {
  destruir();
  await carregarCss('./politicas.css');

  const controle = new AbortController();
  const textos = new Map(); // id da aba → HTML já carregado
  let janela = null; // { sob, mostrar }

  async function carregarTexto(aba) {
    if (!textos.has(aba.id)) {
      const resposta = await fetch(new URL(aba.arquivo, import.meta.url));
      if (!resposta.ok) throw new Error(`${aba.arquivo} respondeu ${resposta.status}`);
      textos.set(aba.id, await resposta.text());
    }
    return textos.get(aba.id);
  }

  function limparAncora() {
    if (lerAncora(location.hash)) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  function abrir(idInicial) {
    const raiz = document.createElement('div');
    raiz.className = 'ei-pol';

    const abas = document.createElement('div');
    abas.className = 'ei-pol__abas';
    abas.setAttribute('role', 'tablist');
    abas.setAttribute('aria-label', 'Documentos');

    const painel = document.createElement('div');
    painel.className = 'ei-pol__texto';
    painel.id = 'ei-pol-painel';
    painel.setAttribute('role', 'tabpanel');
    painel.tabIndex = 0;

    const botoes = ABAS.map((aba) => {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'ei-pol__aba';
      botao.id = `ei-pol-aba-${aba.id}`;
      botao.setAttribute('role', 'tab');
      botao.setAttribute('aria-controls', painel.id);
      botao.textContent = aba.rotulo;
      botao.addEventListener('click', () => {
        history.replaceState(null, '', ancoraDaAba(aba.id));
        mostrar(aba.id);
      });
      abas.append(botao);
      return botao;
    });

    // Setas trocam de aba, como num controle segmentado.
    abas.addEventListener('keydown', (evento) => {
      const passo = { ArrowRight: 1, ArrowLeft: -1 }[evento.key];
      if (!passo) return;
      evento.preventDefault();
      const posicao = botoes.indexOf(document.activeElement);
      const proximo = botoes[(posicao + passo + botoes.length) % botoes.length];
      proximo.focus();
      proximo.click();
    });

    let abaAtual = null;
    async function mostrar(id) {
      const aba = ABAS.find((item) => item.id === id) ?? ABAS[0];
      abaAtual = aba.id;
      botoes.forEach((botao, posicao) => {
        const selecionada = ABAS[posicao].id === aba.id;
        botao.setAttribute('aria-selected', String(selecionada));
        botao.tabIndex = selecionada ? 0 : -1;
      });
      painel.setAttribute('aria-labelledby', `ei-pol-aba-${aba.id}`);
      painel.scrollTop = 0;
      if (!textos.has(aba.id)) painel.textContent = 'Carregando…';
      try {
        const html = await carregarTexto(aba);
        if (abaAtual === aba.id) painel.innerHTML = html;
      } catch {
        if (abaAtual !== aba.id) return;
        painel.replaceChildren();
        const erro = document.createElement('p');
        erro.textContent = 'Não foi possível carregar este texto. ';
        const tentar = document.createElement('button');
        tentar.type = 'button';
        tentar.className = 'ei-pol__tentar';
        tentar.textContent = 'Tentar de novo';
        tentar.addEventListener('click', () => mostrar(aba.id));
        erro.append(tentar);
        painel.append(erro);
      }
    }

    raiz.append(abas, painel);
    const sob = abrirSobreposicao({
      titulo: 'Políticas da plataforma',
      largura: 720,
      altura: 640,
      rolagem: false,
      conteudo: raiz,
      rodape: `Atualizado em ${ATUALIZADO_EM}`,
      focoInicial: botoes[Math.max(0, ABAS.findIndex((aba) => aba.id === idInicial))],
      aoFechar: () => {
        janela = null;
        limparAncora(); // fechar limpa a âncora, sem recarregar a página
      }
    });
    janela = { sob, mostrar };
    mostrar(idInicial);
  }

  function sincronizar() {
    const id = lerAncora(location.hash);
    if (id && !janela) abrir(id);
    else if (id) janela.mostrar(id);
    else janela?.sob.fechar();
  }

  window.addEventListener('hashchange', sincronizar, { signal: controle.signal });
  ativo = { controle, fechar: () => janela?.sob.fechar() };
  sincronizar(); // se a página abriu já com a âncora, a sobreposição abre
}

export function destruir() {
  if (!ativo) return;
  ativo.controle.abort();
  ativo.fechar();
  ativo = null;
}
