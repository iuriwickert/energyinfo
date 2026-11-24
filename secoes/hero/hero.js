// Hero (versão B): título, frase, dois botões e a paisagem com paralaxe.
// Não importa nada de outra seção; os botões só apontam para âncoras.
import { calcularParalaxe } from './paralaxe.js';
import { desenharPaisagem } from './paisagem.js';

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

export async function iniciarHero(raiz) {
  destruir();
  await carregarCss('./hero.css');

  raiz.classList.add('ei-hero');
  raiz.innerHTML = `
    <div class="ei-hero__conteudo">
      <h1 class="ei-hero__titulo">Energia solar, <span class="ei-hero__destaque">explicada</span> e planejada</h1>
      <p class="ei-hero__frase">Informação de fácil acesso para os seus investimentos em energia solar.</p>
      <div class="ei-hero__botoes">
        <a class="ei-hero__botao ei-hero__botao--principal" href="#planejador">Planejar minha energia solar</a>
        <a class="ei-hero__botao" href="#solis">Converse com a Solis</a>
      </div>
    </div>
    <div class="ei-hero__paisagem">${desenharPaisagem()}</div>`;

  const camada = (nome) => raiz.querySelector(`[data-ei-camada="${nome}"]`);
  const pecas = {
    sol: camada('sol'),
    fundo: camada('fundo'),
    frente: camada('frente'),
    pasEsquerda: raiz.querySelector('[data-ei-pas="esquerda"]'),
    pasDireita: raiz.querySelector('[data-ei-pas="direita"]')
  };

  // Cata-ventos: giram sempre, bem devagar; rolar a página dá um empurrão
  // pequeno que se desfaz aos poucos (inércia), em vez de girar preso à rolagem.
  const GIRO_BASE = 7;        // graus por segundo, parado
  const EMPURRAO_POR_PX = 0.9; // graus/s a mais por px rolado (antes eram 2,5 graus por px)
  const EMPURRAO_MAX = 90;    // limite do empurrão, em graus/s
  const MEIA_VIDA = 0.7;      // segundos para o empurrão cair pela metade
  let quadro = 0;
  let ligada = false;
  let visivel = true;
  let ultimo = 0;
  let empurrao = 0;
  let giro = 0;
  let rolagemAnterior = window.scrollY;

  function paralaxe() {
    // o movimento continua até o fim do hero sair da tela
    const fimDoHero = raiz.getBoundingClientRect().bottom + window.scrollY;
    const p = calcularParalaxe(window.scrollY, fimDoHero);
    pecas.sol.style.transform = `translate3d(0, ${p.sol.toFixed(2)}px, 0)`;
    pecas.fundo.style.transform = `translate3d(0, ${p.fundo.toFixed(2)}px, 0)`;
    pecas.frente.style.transform = `translate3d(0, ${p.frente.toFixed(2)}px, 0)`;
  }

  function quadroDeAnimacao(agora) {
    quadro = 0;
    const dt = ultimo ? Math.min((agora - ultimo) / 1000, 0.1) : 0;
    ultimo = agora;
    empurrao *= Math.pow(0.5, dt / MEIA_VIDA);
    giro = (giro + (GIRO_BASE + empurrao) * dt) % 360;
    pecas.pasEsquerda.style.transform = `rotate(${giro.toFixed(1)}deg)`;
    pecas.pasDireita.style.transform = `rotate(${(giro * 0.8).toFixed(1)}deg)`;
    if (ligada && visivel) quadro = requestAnimationFrame(quadroDeAnimacao);
  }

  function aoRolar() {
    const y = window.scrollY;
    empurrao = Math.min(EMPURRAO_MAX, empurrao + Math.abs(y - rolagemAnterior) * EMPURRAO_POR_PX);
    rolagemAnterior = y;
    paralaxe();
  }

  function animar() {
    if (!quadro && ligada && visivel) { ultimo = 0; quadro = requestAnimationFrame(quadroDeAnimacao); }
  }

  // Fora da tela, para de desenhar (economiza bateria) e retoma quando volta.
  const observador = new IntersectionObserver(([e]) => { visivel = e.isIntersecting; animar(); });
  observador.observe(raiz);

  function ligar() {
    if (ligada) return;
    ligada = true;
    window.addEventListener('scroll', aoRolar, { passive: true });
    paralaxe();
    animar();
  }

  function desligar() {
    ligada = false;
    window.removeEventListener('scroll', aoRolar);
    cancelAnimationFrame(quadro);
    quadro = 0;
    for (const peca of Object.values(pecas)) peca.style.transform = '';
  }

  // Com "reduzir movimento" ligado no sistema, tudo fica parado.
  const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
  const aoMudarPreferencia = () => (movimentoReduzido.matches ? desligar() : ligar());
  movimentoReduzido.addEventListener('change', aoMudarPreferencia);
  aoMudarPreferencia();

  ativo = {
    raiz,
    limpar() {
      movimentoReduzido.removeEventListener('change', aoMudarPreferencia);
      observador.disconnect();
      desligar();
    }
  };
}

export function destruir() {
  if (!ativo) return;
  ativo.limpar();
  ativo.raiz.classList.remove('ei-hero');
  ativo.raiz.replaceChildren();
  ativo = null;
}
