// Rodapé do site: marca, ferramentas, conta (muda com o login) e sobre o projeto.
// O acesso ao painel administrativo fica aqui, e só existe para quem é admin.
import { sair, restaurando } from '../../nucleo/sessao.js';
import { abrirSobreposicao } from '../../nucleo/sobreposicao.js';
import { estadoDaConta } from './estado.js';

const SOL = '<svg class="ei-rodape__sol" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" focusable="false">'
  + '<circle cx="13" cy="13" r="5.2" fill="#f59e0b"/>'
  + '<path d="M13 2.2v3.2M13 20.6v3.2M2.2 13h3.2M20.6 13h3.2M5.36 5.36l2.27 2.27M18.37 18.37l2.27 2.27M5.36 20.64l2.27-2.27M18.37 7.63l2.27-2.27" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/></svg>';

const ESCUDO = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">'
  + '<path d="M8 1.6l5 1.9v4.1c0 3.1-2.1 5.5-5 6.8-2.9-1.3-5-3.7-5-6.8V3.5l5-1.9z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>'
  + '<path d="M5.8 8.1l1.6 1.6 2.9-3.1" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const FONTES = [
  ['NASA POWER', 'clima e irradiação solar'],
  ['Open-Meteo.com', 'dados de clima (reserva), sob licença CC BY 4.0', 'https://open-meteo.com/', 'open-meteo.com'],
  ['BrasilAPI', 'CEP'],
  ['IBGE', 'municípios'],
  ['ANEEL', 'tarifas']
];

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

function conteudoDasFontes() {
  const raiz = document.createElement('div');
  raiz.className = 'ei-fontes';
  const lista = document.createElement('ul');
  lista.className = 'ei-fontes__lista';
  for (const [nome, uso, endereco, rotulo] of FONTES) {
    const item = document.createElement('li');
    item.className = 'ei-fontes__item';
    const forte = document.createElement('strong');
    forte.className = 'ei-fontes__nome';
    forte.textContent = nome;
    item.append(forte, `: ${uso}`);
    if (endereco) {
      const link = document.createElement('a');
      link.className = 'ei-fontes__link';
      link.href = endereco;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = rotulo;
      item.append(' (', link, ')');
    }
    lista.append(item);
  }
  const nota = document.createElement('p');
  nota.className = 'ei-fontes__nota';
  nota.textContent = 'Os dados pertencem a essas instituições e podem mudar sem aviso.';
  raiz.append(lista, nota);
  return raiz;
}

export async function iniciarRodape(raiz, contexto) {
  destruir();
  await carregarCss('./rodape.css');

  const controle = new AbortController();
  const sinal = { signal: controle.signal };
  ativo = { raiz, controle };

  raiz.classList.add('ei-rodape');
  raiz.innerHTML = `
    <div class="ei-rodape__interno">
      <div class="ei-rodape__coluna ei-rodape__coluna--marca">
        <p class="ei-rodape__marca">${SOL}<span class="ei-rodape__marca-a">Energy</span> <span class="ei-rodape__marca-b">Information</span></p>
        <p class="ei-rodape__frase">Informação de fácil acesso para os seus investimentos em energia solar.</p>
      </div>
      <nav class="ei-rodape__coluna" aria-label="Ferramentas">
        <h2 class="ei-rodape__titulo">Ferramentas</h2>
        <ul class="ei-rodape__lista">
          <li><a class="ei-rodape__link" href="#solis">Solis</a></li>
          <li><a class="ei-rodape__link" href="#planejador">Planejador solar</a></li>
          <li><a class="ei-rodape__link" href="#relatos">Relatos</a></li>
        </ul>
      </nav>
      <nav class="ei-rodape__coluna" aria-label="Conta">
        <h2 class="ei-rodape__titulo">Conta</h2>
        <div class="ei-rodape__conta"></div>
      </nav>
      <nav class="ei-rodape__coluna" aria-label="Sobre o projeto">
        <h2 class="ei-rodape__titulo">Sobre o projeto</h2>
        <p class="ei-rodape__ods">ODS 7 · Energia limpa e acessível</p>
        <p class="ei-rodape__meta">Meta 7.2: aumentar a participação de energias renováveis na matriz energética</p>
        <ul class="ei-rodape__lista ei-rodape__lista--dupla">
          <li><button class="ei-rodape__link ei-rodape__link--botao" type="button" data-ei-acao="fontes">Fontes dos dados</button></li>
          <li><a class="ei-rodape__link" href="#politicas/termos">Termos de uso</a></li>
          <li><a class="ei-rodape__link" href="#politicas/privacidade">Política de privacidade</a></li>
          <li><a class="ei-rodape__link" href="#politicas/aviso">Aviso legal</a></li>
        </ul>
      </nav>
    </div>
    <div class="ei-rodape__faixa">
      <div class="ei-rodape__faixa-interno">
        <p class="ei-rodape__faixa-texto">Estimativas para planejamento, sujeitas a erros. Contrate um profissional para orçamento e projeto.</p>
        <p class="ei-rodape__faixa-texto">2026 · Energy Information · Projeto Integrador</p>
      </div>
    </div>`;

  const areaConta = raiz.querySelector('.ei-rodape__conta');

  function desenharConta(usuario) {
    const estado = estadoDaConta(usuario, restaurando());
    areaConta.replaceChildren();
    areaConta.dataset.eiEstado = estado.tipo;

    if (estado.tipo === 'visitante') {
      const linha = document.createElement('div');
      linha.className = 'ei-rodape__botoes';
      for (const item of estado.itens) {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = `ei-rodape__botao${item.acao === 'criar' ? ' ei-rodape__botao--principal' : ''}`;
        botao.dataset.eiAcao = item.acao;
        botao.textContent = item.texto;
        linha.append(botao);
      }
      areaConta.append(linha);
      return;
    }

    if (estado.itens.length > 0) {
      const lista = document.createElement('ul');
      lista.className = 'ei-rodape__lista';
      for (const item of estado.itens) {
        const linha = document.createElement('li');
        const alvo = document.createElement(item.href ? 'a' : 'button');
        alvo.className = `ei-rodape__link${item.href ? '' : ' ei-rodape__link--botao'}`;
        alvo.textContent = item.texto;
        if (item.href) alvo.href = item.href;
        else {
          alvo.type = 'button';
          alvo.dataset.eiAcao = item.acao;
        }
        linha.append(alvo);
        lista.append(linha);
      }
      areaConta.append(lista);
    }

    // Só para admin: o link do painel nem é criado para as outras pessoas.
    if (estado.painel) {
      const painel = document.createElement('a');
      painel.className = 'ei-rodape__painel';
      painel.href = estado.painel.href;
      painel.innerHTML = ESCUDO;
      const texto = document.createElement('span');
      texto.textContent = 'Painel administrativo';
      painel.append(texto);
      if (estado.painel.avisoSenha) {
        const ponto = document.createElement('span');
        ponto.className = 'ei-rodape__ponto';
        ponto.setAttribute('role', 'img');
        ponto.setAttribute('aria-label', 'Atenção: a senha padrão ainda está em uso');
        ponto.title = 'A senha padrão ainda está em uso';
        painel.append(ponto);
      }
      areaConta.append(painel);
    }
  }

  raiz.addEventListener('click', (evento) => {
    const alvo = evento.target.closest('[data-ei-acao]');
    if (!alvo) return;
    const acao = alvo.dataset.eiAcao;
    if (acao === 'entrar' || acao === 'criar' || acao === 'conta') contexto.abrirLogin(acao);
    else if (acao === 'sair') sair();
    else if (acao === 'fontes') {
      abrirSobreposicao({ titulo: 'Fontes dos dados', largura: 520, conteudo: conteudoDasFontes() });
    }
  }, sinal);

  document.addEventListener('ei:login-mudou', (evento) => desenharConta(evento.detail.usuario), sinal);
  desenharConta(contexto.usuario);
}

export function destruir() {
  if (!ativo) return;
  ativo.controle.abort();
  ativo.raiz.classList.remove('ei-rodape');
  ativo.raiz.replaceChildren();
  ativo = null;
}
