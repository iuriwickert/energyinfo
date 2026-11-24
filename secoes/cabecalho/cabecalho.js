// Cabeçalho do site: marca, links das seções e a área da conta.
// Importa só de nucleo/. Fala com as outras seções apenas por âncoras.
import { sair, restaurando } from '../../nucleo/sessao.js';

const SOL = '<svg class="ei-cab__sol" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" focusable="false">'
  + '<circle cx="13" cy="13" r="5.2" fill="#f59e0b"/>'
  + '<path d="M13 2.2v3.2M13 20.6v3.2M2.2 13h3.2M20.6 13h3.2M5.36 5.36l2.27 2.27M18.37 18.37l2.27 2.27M5.36 20.64l2.27-2.27M18.37 7.63l2.27-2.27" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/></svg>';

const ICONE_MENU = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">'
  + '<path d="M3 5h12M3 9h12M3 13h12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

const SETA = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">'
  + '<path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

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

export async function iniciarCabecalho(raiz, contexto) {
  destruir();
  await carregarCss('./cabecalho.css');

  const controle = new AbortController();
  const sinal = { signal: controle.signal };
  ativo = { raiz, controle };

  raiz.classList.add('ei-cab');
  raiz.innerHTML = `
    <div class="ei-cab__interno">
      <a class="ei-cab__marca" href="#" data-ei-acao="topo" aria-label="Energy Information: voltar ao topo da página">
        ${SOL}<span class="ei-cab__marca-a">Energy</span> <span class="ei-cab__marca-b">Information</span>
      </a>
      <nav class="ei-cab__links" id="ei-cab-links" aria-label="Ferramentas">
        <a class="ei-cab__link" href="#solis">Solis</a>
        <a class="ei-cab__link" href="#planejador">Planejador</a>
        <a class="ei-cab__link" href="#relatos">Relatos</a>
      </nav>
      <button class="ei-cab__menu" type="button" aria-label="Menu das ferramentas" aria-expanded="false" aria-controls="ei-cab-links">${ICONE_MENU}</button>
      <div class="ei-cab__conta"></div>
    </div>`;

  const botaoMenu = raiz.querySelector('.ei-cab__menu');
  const areaConta = raiz.querySelector('.ei-cab__conta');

  // ----- menu das seções (abaixo de 700 px) -----
  function definirMenu(aberto) {
    raiz.classList.toggle('ei-cab--aberto', aberto);
    botaoMenu.setAttribute('aria-expanded', String(aberto));
  }
  botaoMenu.addEventListener('click', () => definirMenu(!raiz.classList.contains('ei-cab--aberto')), sinal);

  // ----- área da conta -----
  function fecharMenuConta(devolverFoco = false) {
    const botao = areaConta.querySelector('.ei-cab__apelido');
    const lista = areaConta.querySelector('.ei-cab__lista');
    if (!botao || !lista || lista.hidden) return;
    lista.hidden = true;
    botao.setAttribute('aria-expanded', 'false');
    if (devolverFoco) botao.focus();
  }

  function desenharConta(usuario) {
    areaConta.replaceChildren();
    if (!usuario) {
      if (restaurando()) return; // ainda conferindo a sessão guardada: não pisca
      const entrar = document.createElement('button');
      entrar.type = 'button';
      entrar.className = 'ei-cab__botao';
      entrar.textContent = 'Entrar';
      entrar.addEventListener('click', () => contexto.abrirLogin('entrar'));
      const criar = document.createElement('button');
      criar.type = 'button';
      criar.className = 'ei-cab__botao ei-cab__botao--principal';
      criar.textContent = 'Criar conta';
      criar.addEventListener('click', () => contexto.abrirLogin('criar'));
      areaConta.append(entrar, criar);
      return;
    }

    const caixa = document.createElement('div');
    caixa.className = 'ei-cab__usuario';
    caixa.innerHTML = `
      <button class="ei-cab__apelido" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="ei-cab-menu-conta">
        <span class="ei-cab__apelido-texto"></span>${SETA}
      </button>
      <div class="ei-cab__lista" id="ei-cab-menu-conta" role="menu" aria-label="Sua conta" hidden>
        <button class="ei-cab__item" type="button" role="menuitem" data-ei-acao="conta">Minha conta</button>
        <a class="ei-cab__item" role="menuitem" href="#planejador?historico=1">Histórico de simulações</a>
        <button class="ei-cab__item" type="button" role="menuitem" data-ei-acao="sair">Sair</button>
      </div>`;
    caixa.querySelector('.ei-cab__apelido-texto').textContent = usuario.apelido;
    const botao = caixa.querySelector('.ei-cab__apelido');
    const lista = caixa.querySelector('.ei-cab__lista');
    const itens = [...lista.querySelectorAll('.ei-cab__item')];

    function abrir() {
      lista.hidden = false;
      botao.setAttribute('aria-expanded', 'true');
      itens[0].focus();
    }
    botao.addEventListener('click', () => (lista.hidden ? abrir() : fecharMenuConta()));
    botao.addEventListener('keydown', (evento) => {
      if (evento.key === 'ArrowDown') {
        evento.preventDefault();
        abrir();
      }
    });
    lista.addEventListener('keydown', (evento) => {
      const posicao = itens.indexOf(document.activeElement);
      if (evento.key === 'ArrowDown') {
        evento.preventDefault();
        itens[(posicao + 1) % itens.length].focus();
      } else if (evento.key === 'ArrowUp') {
        evento.preventDefault();
        itens[(posicao - 1 + itens.length) % itens.length].focus();
      } else if (evento.key === 'Home') {
        evento.preventDefault();
        itens[0].focus();
      } else if (evento.key === 'End') {
        evento.preventDefault();
        itens[itens.length - 1].focus();
      }
    });
    lista.addEventListener('click', (evento) => {
      const item = evento.target.closest('.ei-cab__item');
      if (!item) return;
      fecharMenuConta(true);
      if (item.dataset.eiAcao === 'conta') contexto.abrirLogin('conta');
      if (item.dataset.eiAcao === 'sair') sair();
    });
    caixa.addEventListener('focusout', (evento) => {
      if (!caixa.contains(evento.relatedTarget)) fecharMenuConta();
    });
    areaConta.append(caixa);
  }

  // ----- cliques e teclas gerais -----
  raiz.addEventListener('click', (evento) => {
    if (evento.target.closest('[data-ei-acao="topo"]')) {
      evento.preventDefault();
      history.replaceState(null, '', location.pathname + location.search);
      window.scrollTo({ top: 0 });
    }
    if (evento.target.closest('.ei-cab__link')) definirMenu(false);
  }, sinal);

  document.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape') return;
    if (raiz.classList.contains('ei-cab--aberto')) {
      definirMenu(false);
      botaoMenu.focus();
    }
    fecharMenuConta(true);
  }, sinal);

  document.addEventListener('pointerdown', (evento) => {
    if (!raiz.contains(evento.target)) {
      definirMenu(false);
      fecharMenuConta();
    } else if (!evento.target.closest('.ei-cab__usuario')) {
      fecharMenuConta();
    }
  }, sinal);

  document.addEventListener('ei:login-mudou', (evento) => desenharConta(evento.detail.usuario), sinal);

  desenharConta(contexto.usuario);
}

export function destruir() {
  if (!ativo) return;
  ativo.controle.abort();
  ativo.raiz.classList.remove('ei-cab', 'ei-cab--aberto');
  ativo.raiz.replaceChildren();
  ativo = null;
}
