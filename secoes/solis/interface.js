// Interface da Solis: desenha a seção e cuida do chat.
// A decisão do que responder vem do algoritmo de solis.js (recebido por parâmetro).
import { carregarBase } from './dados.js';

const BOAS_VINDAS = 'Oi! Eu sou a Solis. Tiro dúvidas gerais sobre energia solar e outras fontes renováveis. Escolha uma pergunta abaixo ou escreva a sua.';
const PEDIR_PERGUNTA = 'Escreva uma pergunta para eu poder ajudar.';
const AVISO_DINHEIRO = 'Estimativa geral. Para valores reais, consulte um profissional.';
const TEMPO_DIGITANDO_MS = 750; // tempo das bolinhas "digitando" (só efeito visual)

// Ilustração da assistente: ícone de app com o sol do logo (sem rosto) e balões de conversa
// abstratos em volta. Estilo chapado, poucas cores, no mesmo traço do resto do site.
const PERSONAGEM = `
<svg class="so-personagem" viewBox="0 0 260 200" role="img" aria-labelledby="so-personagem-titulo" focusable="false">
  <title id="so-personagem-titulo">Solis, assistente de dúvidas sobre energia solar</title>
  <circle cx="130" cy="100" r="88" fill="#fff6e5"/>
  <circle cx="130" cy="100" r="62" fill="none" stroke="#fde3a7" stroke-dasharray="3 6"/>
  <!-- balão da pessoa (cinza, à esquerda) -->
  <g>
    <rect x="18" y="38" width="92" height="40" rx="14" fill="#ffffff" stroke="#e6e8ec"/>
    <path d="M34 78l-6 10 16-10z" fill="#ffffff" stroke="#e6e8ec" stroke-linejoin="round"/>
    <rect x="31" y="51" width="54" height="5" rx="2.5" fill="#d5d9e0"/>
    <rect x="31" y="61" width="36" height="5" rx="2.5" fill="#e6e8ec"/>
  </g>
  <!-- balão da Solis (âmbar, à direita) -->
  <g>
    <rect x="150" y="116" width="96" height="46" rx="14" fill="#f59e0b"/>
    <path d="M226 162l8 10-18-10z" fill="#f59e0b"/>
    <rect x="163" y="129" width="62" height="5" rx="2.5" fill="#ffffff" opacity=".9"/>
    <rect x="163" y="139" width="70" height="5" rx="2.5" fill="#ffffff" opacity=".7"/>
    <rect x="163" y="149" width="40" height="5" rx="2.5" fill="#ffffff" opacity=".7"/>
  </g>
  <!-- ícone da assistente -->
  <g>
    <rect x="96" y="66" width="68" height="68" rx="20" fill="#ffffff" stroke="#e6e8ec"/>
    <circle cx="130" cy="100" r="11" fill="#f59e0b"/>
    <path d="M130 79v6M130 115v6M109 100h6M145 100h6M115.2 85.2l4.2 4.2M140.6 110.6l4.2 4.2M115.2 114.8l4.2-4.2M140.6 89.4l4.2-4.2" fill="none" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
    <circle cx="158" cy="72" r="7" fill="#16a34a" stroke="#ffffff" stroke-width="3"/>
  </g>
</svg>`;

const AVATAR = `
<svg class="so-chat__avatar" width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
  <circle cx="14" cy="14" r="14" fill="#fef0c7"/>
  <circle cx="14" cy="14" r="5.4" fill="#f59e0b"/>
  <path d="M14 3.6v3M14 21.4v3M3.6 14h3M21.4 14h3M6.65 6.65l2.1 2.1M19.25 19.25l2.1 2.1M6.65 21.35l2.1-2.1M19.25 8.75l2.1-2.1" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
</svg>`;

const ICONE_ENVIAR = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">'
  + '<path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

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

// Texto com links no formato [rótulo](#ancora). Só âncoras da própria página viram link.
function preencherTexto(elemento, texto) {
  const padrao = /\[([^\]]+)\]\((#[^)\s]+)\)/g;
  let fim = 0;
  for (const achado of texto.matchAll(padrao)) {
    elemento.append(texto.slice(fim, achado.index));
    const link = document.createElement('a');
    link.className = 'so-link';
    link.href = achado[2];
    link.textContent = achado[1];
    elemento.append(link);
    fim = achado.index + achado[0].length;
  }
  elemento.append(texto.slice(fim));
}

export async function montarInterface(raiz, { responder, proximasSugestoes }) {
  await carregarCss('./solis.css');

  const controle = new AbortController();
  const sinal = { signal: controle.signal };
  let base = null;
  let ocupada = false;
  let relogio = 0;
  const usadas = new Set();

  raiz.classList.add('so-secao');
  raiz.innerHTML = `
    <div class="so-grade">
      <div class="so-lado">
        <div class="so-topo">
          <h2 class="so-titulo">Tire dúvidas com a Solis</h2>
          <p class="so-descricao">Respostas rápidas e gerais sobre energia solar e renovável. Escolha uma pergunta ou escreva a sua.</p>
        </div>
        <div class="so-apresentacao">
          ${PERSONAGEM}
          <p class="so-apoio">Eu sou a Solis. Não uso inteligência artificial: respondo com textos prontos, escritos pela equipe.</p>
        </div>
      </div>
      <div class="so-coluna">
        <div class="so-chat">
          <div class="so-chat__topo">
            ${AVATAR}
            <div class="so-chat__quem">
              <h3 class="so-chat__nome">Solis</h3>
              <p class="so-chat__papel">Assistente automática</p>
            </div>
          </div>
          <div class="so-chat__mensagens" id="so-mensagens" role="log" aria-live="polite" aria-label="Conversa com a Solis" tabindex="0"></div>
          <div class="so-chat__sugestoes" role="group" aria-label="Perguntas sugeridas"></div>
          <form class="so-chat__envio" novalidate>
            <label class="so-oculto" for="so-campo">Escreva a sua pergunta para a Solis</label>
            <input class="so-campo" id="so-campo" type="text" autocomplete="off" maxlength="200" placeholder="Escreva a sua pergunta" disabled>
            <button class="so-enviar" type="submit" aria-label="Enviar pergunta" disabled>${ICONE_ENVIAR}</button>
          </form>
        </div>
        <p class="so-aviso">Respostas automáticas e gerais. Não substituem a orientação de um profissional.</p>
      </div>
    </div>`;

  const mensagens = raiz.querySelector('.so-chat__mensagens');
  const sugestoes = raiz.querySelector('.so-chat__sugestoes');
  const formulario = raiz.querySelector('.so-chat__envio');
  const campo = raiz.querySelector('.so-campo');
  const botaoEnviar = raiz.querySelector('.so-enviar');

  function rolarAteOFim() {
    mensagens.scrollTop = mensagens.scrollHeight;
  }

  function adicionarMensagem(autor, texto, { aviso = false } = {}) {
    const balao = document.createElement('div');
    balao.className = `so-msg so-msg--${autor}`;
    const quem = document.createElement('span');
    quem.className = 'so-oculto';
    quem.textContent = autor === 'solis' ? 'Solis: ' : 'Você: ';
    const corpo = document.createElement('span');
    preencherTexto(corpo, texto);
    balao.append(quem, corpo);
    if (aviso) {
      const linha = document.createElement('span');
      linha.className = 'so-msg__aviso';
      linha.textContent = AVISO_DINHEIRO;
      balao.append(linha);
    }
    mensagens.append(balao);
    rolarAteOFim();
    return balao;
  }

  function desenharSugestoes() {
    sugestoes.replaceChildren();
    if (!base) return;
    for (const pergunta of proximasSugestoes(base, usadas, 3)) {
      const pilula = document.createElement('button');
      pilula.type = 'button';
      pilula.className = 'so-pilula';
      pilula.textContent = pergunta.pergunta;
      pilula.addEventListener('click', () => enviar(pergunta.pergunta));
      sugestoes.append(pilula);
    }
  }

  function habilitar(sim) {
    campo.disabled = !sim;
    botaoEnviar.disabled = !sim;
  }

  function enviar(textoBruto) {
    if (!base || ocupada) return;
    const texto = String(textoBruto ?? '').trim().slice(0, 200);
    const resultado = responder(texto, base);

    if (resultado.tipo === 'vazio') {
      // Texto vazio ou só com palavras soltas ("e", "o que"): não responde, pede uma pergunta.
      if (texto) adicionarMensagem('usuario', texto);
      if (mensagens.lastElementChild?.dataset.soPedido !== '1') {
        adicionarMensagem('solis', PEDIR_PERGUNTA).dataset.soPedido = '1';
      }
      campo.value = '';
      return;
    }

    adicionarMensagem('usuario', texto);
    campo.value = '';
    ocupada = true;
    const digitando = document.createElement('div');
    digitando.className = 'so-msg so-msg--solis so-msg--digitando';
    digitando.innerHTML = '<span class="so-oculto">Solis está digitando…</span><i></i><i></i><i></i>';
    mensagens.append(digitando);
    rolarAteOFim();

    // Só efeito visual: a resposta já está decidida.
    relogio = window.setTimeout(() => {
      digitando.remove();
      if (resultado.tipo === 'resposta') {
        usadas.add(resultado.pergunta.id);
        adicionarMensagem('solis', resultado.pergunta.resposta, { aviso: resultado.pergunta.aviso === true });
      } else {
        adicionarMensagem('solis', resultado.mensagem);
      }
      desenharSugestoes();
      ocupada = false;
    }, TEMPO_DIGITANDO_MS);
  }

  async function carregar() {
    mensagens.replaceChildren();
    sugestoes.replaceChildren();
    habilitar(false);
    try {
      base = await carregarBase();
    } catch {
      base = null;
      const erro = document.createElement('div');
      erro.className = 'so-erro';
      const texto = document.createElement('p');
      texto.className = 'so-erro__texto';
      texto.textContent = 'Sem conexão. Tente de novo.';
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'so-botao';
      botao.textContent = 'Tentar de novo';
      botao.addEventListener('click', carregar);
      erro.append(texto, botao);
      mensagens.append(erro);
      return;
    }
    if (controle.signal.aborted) return;
    usadas.clear();
    adicionarMensagem('solis', BOAS_VINDAS);
    desenharSugestoes();
    habilitar(true);
    focarSeForAncora();
  }

  // Quem chega pela âncora #solis já encontra o campo com foco.
  function focarSeForAncora() {
    const destino = location.hash.slice(1).split(/[?/]/)[0];
    if (destino === 'solis' && !campo.disabled) campo.focus({ preventScroll: true });
  }

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    enviar(campo.value);
  }, sinal);
  window.addEventListener('hashchange', focarSeForAncora, sinal);

  await carregar();

  return {
    destruir() {
      controle.abort();
      window.clearTimeout(relogio);
      raiz.classList.remove('so-secao');
      raiz.replaceChildren();
    }
  };
}
