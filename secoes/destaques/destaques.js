// "Por que falar de energia solar?": faixa escura entre o planejador e os relatos,
// com a ODS 7 e dois fatos sobre geração própria. Não importa nada de outra seção.

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

const FATOS = [
  {
    rotulo: 'ODS 7 · Meta 7.2',
    titulo: 'Mais energia renovável até 2030',
    texto: '“Até 2030, aumentar substancialmente a participação de energias renováveis na matriz energética global.”',
    fonte: 'ONU, Objetivos de Desenvolvimento Sustentável'
  },
  {
    rotulo: 'Lei 14.300/2022',
    titulo: 'O que sobra vira crédito',
    texto: 'A energia que o sistema gera e a casa não usa na hora vai para a rede e volta como crédito na conta de luz, válido por 60 meses.',
    fonte: 'Marco legal da micro e minigeração distribuída'
  },
  {
    rotulo: 'Antes do orçamento',
    titulo: 'Informação primeiro',
    texto: 'Saber quanto o telhado pode gerar e em quanto tempo o sistema se paga ajuda a comparar propostas com calma.',
    fonte: 'É para isso que o Energy Information existe'
  }
];

export async function iniciarDestaques(raiz) {
  destruir();
  await carregarCss('./destaques.css');

  raiz.classList.add('ei-dest');
  raiz.innerHTML = `
    <div class="ei-dest__interno">
      <div class="ei-dest__cabeca">
        <p class="ei-dest__chamada">Energia limpa e acessível</p>
        <h2 class="ei-dest__titulo">Por que falar de energia solar?</h2>
      </div>
      <ul class="ei-dest__lista">
        ${FATOS.map((fato) => `
          <li class="ei-dest__fato">
            <p class="ei-dest__rotulo">${fato.rotulo}</p>
            <h3 class="ei-dest__fato-titulo">${fato.titulo}</h3>
            <p class="ei-dest__texto">${fato.texto}</p>
            <p class="ei-dest__fonte">${fato.fonte}</p>
          </li>`).join('')}
      </ul>
    </div>`;

  ativo = { raiz };
}

export function destruir() {
  if (!ativo) return;
  ativo.raiz.classList.remove('ei-dest');
  ativo.raiz.replaceChildren();
  ativo = null;
}
