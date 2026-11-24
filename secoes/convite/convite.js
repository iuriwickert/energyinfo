// Convite final, antes do rodapé: chama o visitante para criar conta e
// mostra atalhos para quem já entrou. Não importa nada de outra seção.
import { restaurando } from '../../nucleo/sessao.js';

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

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Cena no mesmo estilo do hero: formas chapadas, sem contorno, poucas cores.
// Colinas em camadas encostam no canto inferior direito do cartão; a casa fica
// assentada na colina da frente, vista de frente, com painéis alinhados no telhado.
const ILUSTRACAO = `
  <svg class="ei-conv__svg" viewBox="0 0 560 300" preserveAspectRatio="xMaxYMax meet" role="img" aria-labelledby="ei-conv-svg-titulo">
    <title id="ei-conv-svg-titulo">Casa com painéis solares no telhado, sobre colinas, com o sol atrás</title>
    <g class="ei-conv__sol">
      <circle cx="392" cy="118" r="84" fill="#fef0c7"/>
      <circle cx="392" cy="118" r="58" fill="#fde3a7"/>
      <circle cx="392" cy="118" r="34" fill="#f59e0b"/>
    </g>
    <path d="M60 300C170 262 270 214 380 200C450 191 510 194 560 200V300Z" fill="#d7ead0"/>
    <path d="M140 300C240 278 300 246 370 240C430 235 500 236 560 238V300Z" fill="#a8d29c"/>
    <circle cx="344" cy="234" r="12" fill="#8cc47f"/><circle cx="356" cy="238" r="8" fill="#8cc47f"/>
    <circle cx="518" cy="232" r="14" fill="#8cc47f"/><circle cx="534" cy="237" r="9" fill="#8cc47f"/>
    <g>
      <rect x="362" y="198" width="140" height="44" fill="#ffffff"/>
      <rect x="362" y="236" width="140" height="6" fill="#e9edf2"/>
      <path d="M350 201L378 160H486L514 201Z" fill="#c7d0db"/>
      <path d="M348 201H516V206H348Z" fill="#aeb9c6"/>
      <path d="M384 196L400 167H464L480 196Z" fill="#1e3a5f"/>
      <path d="M392 181.5H472M416 167L408 196M432 167V196M448 167L456 196" stroke="#3d5f8f" stroke-width="1.4"/>
      <rect x="404" y="214" width="22" height="28" rx="2" fill="#f59e0b"/>
      <circle cx="421" cy="229" r="1.6" fill="#7a4300"/>
      <rect x="374" y="214" width="20" height="16" rx="2" fill="#fde3a7"/>
      <path d="M384 214V230M374 222H394" stroke="#f3c96b" stroke-width="1.4"/>
      <rect x="440" y="214" width="48" height="16" rx="2" fill="#fde3a7"/>
      <path d="M456 214V230M472 214V230" stroke="#f3c96b" stroke-width="1.4"/>
    </g>
  </svg>`;

function conteudo(usuario) {
  if (usuario) {
    return {
      chamada: 'Continue de onde parou',
      titulo: `Bom te ver, ${escapar(usuario.apelido || 'visitante')}!`,
      texto: 'Suas simulações ficam salvas no histórico do planejador. Se você já instalou, conte como foi: isso ajuda quem ainda está decidindo.',
      botoes: `
        <a class="ei-conv__botao ei-conv__botao--principal" href="#planejador?historico=1">Ver meu histórico</a>
        <a class="ei-conv__botao" href="#relatos">Escrever um relato</a>`
    };
  }
  return {
    chamada: 'Comece agora',
    titulo: 'Guarde suas simulações e conte a sua experiência',
    texto: 'Com uma conta gratuita você salva as simulações do planejador, refaz quando quiser e pode escrever relatos para ajudar outras pessoas.',
    botoes: `
      ${restaurando() ? '' : '<button class="ei-conv__botao ei-conv__botao--principal" type="button" data-ei-conv="criar">Criar conta</button>'}
      <a class="ei-conv__botao" href="#planejador">Começar pelo planejador</a>`
  };
}

export async function iniciarConvite(raiz, contexto) {
  destruir();
  await carregarCss('./convite.css');

  const controle = new AbortController();
  const sinal = { signal: controle.signal };
  raiz.classList.add('ei-conv');

  function desenhar(usuario) {
    const c = conteudo(usuario);
    raiz.innerHTML = `
      <div class="ei-conv__interno">
        <div class="ei-conv__painel">
          <div class="ei-conv__texto-bloco">
            <p class="ei-conv__chamada">${c.chamada}</p>
            <h2 class="ei-conv__titulo">${c.titulo}</h2>
            <p class="ei-conv__texto">${c.texto}</p>
            <div class="ei-conv__botoes">${c.botoes}</div>
          </div>
          <div class="ei-conv__arte">${ILUSTRACAO}</div>
        </div>
      </div>`;
  }

  raiz.addEventListener('click', (evento) => {
    if (evento.target.closest('[data-ei-conv="criar"]')) contexto.abrirLogin('criar');
  }, sinal);
  document.addEventListener('ei:login-mudou', (evento) => desenhar(evento.detail.usuario), sinal);
  desenhar(contexto.usuario);

  ativo = { raiz, controle };
}

export function destruir() {
  if (!ativo) return;
  ativo.controle.abort();
  ativo.raiz.classList.remove('ei-conv');
  ativo.raiz.replaceChildren();
  ativo = null;
}
