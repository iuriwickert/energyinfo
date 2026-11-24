// Janela sobreposta (modal) compartilhada: login, conta, políticas, fontes.
// Suporta pilha: a que abre por cima fecha primeiro, e a de baixo continua
// como estava. Esc fecha, o foco fica preso na janela de cima e volta para o
// botão que abriu. O visual está em nucleo/tokens.css (.pi-sobreposicao).

const FOCAVEIS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const ICONE_FECHAR = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">'
  + '<path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

const pilha = [];
let contador = 0;

function focaveis(cartao) {
  return [...cartao.querySelectorAll(FOCAVEIS)].filter((el) => el.getClientRects().length > 0);
}

function topo() {
  return pilha[pilha.length - 1] ?? null;
}

function aoTeclar(evento) {
  const item = topo();
  if (!item) return;
  if (evento.key === 'Escape') {
    evento.preventDefault();
    evento.stopPropagation();
    item.fechar();
    return;
  }
  if (evento.key !== 'Tab') return;
  const lista = focaveis(item.cartao);
  if (lista.length === 0) {
    evento.preventDefault();
    item.cartao.focus();
    return;
  }
  const primeiro = lista[0];
  const ultimo = lista[lista.length - 1];
  const ativo = document.activeElement;
  if (evento.shiftKey && (ativo === primeiro || !item.cartao.contains(ativo))) {
    evento.preventDefault();
    ultimo.focus();
  } else if (!evento.shiftKey && (ativo === ultimo || !item.cartao.contains(ativo))) {
    evento.preventDefault();
    primeiro.focus();
  }
}

// Se o foco escapar (por exemplo, por um clique fora), volta para a janela de cima.
function aoFocar(evento) {
  const item = topo();
  if (item && !item.cartao.contains(evento.target)) {
    (focaveis(item.cartao)[0] ?? item.cartao).focus();
  }
}

function ligarEscuta() {
  document.addEventListener('keydown', aoTeclar, true);
  document.addEventListener('focusin', aoFocar, true);
  // Trava a rolagem da página e guarda a largura da barra, para o conteúdo não pular.
  const raiz = document.documentElement;
  raiz.style.setProperty('--pi-barra', `${window.innerWidth - raiz.clientWidth}px`);
  raiz.classList.add('pi-travada');
}

function desligarEscuta() {
  document.removeEventListener('keydown', aoTeclar, true);
  document.removeEventListener('focusin', aoFocar, true);
  document.documentElement.classList.remove('pi-travada');
  document.documentElement.style.removeProperty('--pi-barra');
}

/**
 * Abre uma janela sobreposta.
 * @param {object} opcoes
 * @param {string} opcoes.titulo        Título mostrado no topo.
 * @param {Node}   opcoes.conteudo      Conteúdo do corpo.
 * @param {number} [opcoes.largura]     Largura máxima em px (padrão 400).
 * @param {number} [opcoes.altura]      Altura fixa em px (limitada à tela). Sem ela, a janela tem a altura do conteúdo.
 * @param {boolean} [opcoes.rolagem]    false: o corpo não rola (o conteúdo cuida da própria rolagem).
 * @param {Node|string} [opcoes.rodape] Faixa fixa embaixo.
 * @param {Element|string} [opcoes.focoInicial] Elemento (ou seletor dentro do conteúdo) que recebe o foco.
 * @param {Element} [opcoes.retorno]    Quem recebe o foco ao fechar (padrão: quem tinha o foco ao abrir).
 * @param {Function} [opcoes.aoFechar]  Chamada depois de fechar.
 * @returns {{ camada: Element, cartao: Element, corpo: Element, fechar: Function, aberta: Function }}
 */
export function abrirSobreposicao({
  titulo,
  conteudo,
  largura = 400,
  altura,
  rolagem = true,
  rodape,
  focoInicial,
  retorno,
  aoFechar
}) {
  contador += 1;
  const idTitulo = `pi-sob-titulo-${contador}`;
  const retornarPara = retorno ?? document.activeElement;

  const camada = document.createElement('div');
  camada.className = 'pi-sobreposicao pi-secao';
  camada.style.zIndex = String(100 + pilha.length);

  const cartao = document.createElement('div');
  cartao.className = 'pi-sobreposicao__cartao';
  cartao.setAttribute('role', 'dialog');
  cartao.setAttribute('aria-modal', 'true');
  cartao.setAttribute('aria-labelledby', idTitulo);
  cartao.tabIndex = -1;
  cartao.style.setProperty('--pi-sob-largura', `${largura}px`);
  if (altura) {
    cartao.classList.add('pi-sobreposicao__cartao--alto');
    cartao.style.setProperty('--pi-sob-altura', `${altura}px`);
  }

  const barra = document.createElement('div');
  barra.className = 'pi-sobreposicao__topo';
  const tituloEl = document.createElement('h2');
  tituloEl.className = 'pi-sobreposicao__titulo';
  tituloEl.id = idTitulo;
  tituloEl.textContent = titulo;
  const botaoFechar = document.createElement('button');
  botaoFechar.type = 'button';
  botaoFechar.className = 'pi-sobreposicao__fechar';
  botaoFechar.setAttribute('aria-label', 'Fechar');
  botaoFechar.innerHTML = ICONE_FECHAR;
  barra.append(tituloEl, botaoFechar);

  const corpo = document.createElement('div');
  corpo.className = 'pi-sobreposicao__corpo';
  if (!rolagem) corpo.classList.add('pi-sobreposicao__corpo--fixo');
  if (conteudo) corpo.append(conteudo);

  cartao.append(barra, corpo);
  if (rodape) {
    const faixa = document.createElement('div');
    faixa.className = 'pi-sobreposicao__rodape';
    faixa.append(rodape);
    cartao.append(faixa);
  }
  camada.append(cartao);

  let aberta = true;
  const item = { camada, cartao, fechar };

  function fechar() {
    if (!aberta) return;
    // Fecha primeiro o que estiver por cima desta.
    while (topo() && topo() !== item) topo().fechar();
    aberta = false;
    pilha.pop();
    // anima a saída antes de tirar da página
    camada.classList.add('ei-saindo');
    setTimeout(() => camada.remove(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
    const abaixo = topo();
    if (abaixo) abaixo.camada.inert = false;
    else desligarEscuta();
    if (retornarPara?.isConnected && typeof retornarPara.focus === 'function') {
      retornarPara.focus({ preventScroll: true });
    }
    aoFechar?.();
  }

  // Clique no fundo fecha (só se o clique começou e terminou no fundo).
  let apertouNoFundo = false;
  camada.addEventListener('pointerdown', (evento) => {
    apertouNoFundo = evento.target === camada;
  });
  camada.addEventListener('click', (evento) => {
    if (apertouNoFundo && evento.target === camada) fechar();
  });
  botaoFechar.addEventListener('click', fechar);

  const abaixo = topo();
  if (abaixo) abaixo.camada.inert = true;
  else ligarEscuta();
  pilha.push(item);
  document.body.append(camada);

  const alvoFoco = typeof focoInicial === 'string' ? corpo.querySelector(focoInicial) : focoInicial;
  (alvoFoco ?? focaveis(corpo)[0] ?? cartao).focus({ preventScroll: true });

  return { camada, cartao, corpo, fechar, aberta: () => aberta };
}

/** Quantas janelas estão abertas agora. */
export function sobreposicoesAbertas() {
  return pilha.length;
}
