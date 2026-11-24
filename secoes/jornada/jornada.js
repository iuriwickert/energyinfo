// "Como funciona": os três passos da plataforma, logo depois do hero.
// Não importa nada de outra seção; os cartões só apontam para âncoras.

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

// Ícones de traço, 24 px, desenhados à mão (sem biblioteca).
const ICONES = {
  conversa: `<path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4 4v-4h0.5A2.5 2.5 0 0 1 5 12.5z"/><path d="M9 9.5h6M9 12h3.5"/>`,
  painel: `<path d="M4.5 18 7 8h10l2.5 10z"/><path d="M5.8 13h12.4M12 8v10M9.3 8l-1 10M14.7 8l1 10"/><path d="M12 2.8v1.6M16.6 4.6l-1 1.1M7.4 4.6l1 1.1"/>`,
  pessoas: `<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M15.5 14.2a4.6 4.6 0 0 1 5 4.8"/>`
};

const PASSOS = [
  {
    numero: '01',
    icone: 'conversa',
    verbo: 'Entenda',
    titulo: 'Tire as dúvidas com a Solis',
    texto: 'Pergunte sobre painéis, inversor, conta de luz e geração. Respostas curtas, escritas pela equipe do projeto.',
    link: 'Conversar com a Solis',
    href: '#solis'
  },
  {
    numero: '02',
    icone: 'painel',
    verbo: 'Planeje',
    titulo: 'Simule o seu sistema',
    texto: 'Informe o CEP, o consumo e o espaço do telhado e veja uma estimativa de geração, custo e retorno.',
    link: 'Abrir o planejador',
    href: '#planejador'
  },
  {
    numero: '03',
    icone: 'pessoas',
    verbo: 'Compare',
    titulo: 'Ouça quem já instalou',
    texto: 'Leia relatos sobre instalação, conta de luz e manutenção. Depois, conte como foi a sua experiência.',
    link: 'Ler os relatos',
    href: '#relatos'
  }
];

function cartao(passo) {
  return `
    <li class="ei-jor__cartao">
      <div class="ei-jor__cartao-topo">
        <span class="ei-jor__icone" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONES[passo.icone]}</svg>
        </span>
        <span class="ei-jor__numero" aria-hidden="true">${passo.numero}</span>
      </div>
      <p class="ei-jor__verbo">Passo ${Number(passo.numero)} · ${passo.verbo}</p>
      <h3 class="ei-jor__cartao-titulo">${passo.titulo}</h3>
      <p class="ei-jor__texto">${passo.texto}</p>
      <a class="ei-jor__link" href="${passo.href}">${passo.link}<span aria-hidden="true"> →</span></a>
    </li>`;
}

export async function iniciarJornada(raiz) {
  destruir();
  await carregarCss('./jornada.css');

  raiz.classList.add('ei-jor');
  raiz.innerHTML = `
    <div class="ei-jor__interno">
      <div class="ei-jor__cabeca">
        <p class="ei-jor__chamada">Como funciona</p>
        <h2 class="ei-jor__titulo">Três passos para entender, planejar e decidir</h2>
        <p class="ei-jor__apoio">Cada ferramenta resolve uma parte da dúvida. Siga na ordem ou vá direto para a que você precisa agora.</p>
      </div>
      <ol class="ei-jor__lista">${PASSOS.map(cartao).join('')}</ol>
    </div>`;

  ativo = { raiz };
}

export function destruir() {
  if (!ativo) return;
  ativo.raiz.classList.remove('ei-jor');
  ativo.raiz.replaceChildren();
  ativo = null;
}
