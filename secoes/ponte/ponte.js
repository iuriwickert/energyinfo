// "Antes de simular": ponte entre a Solis e o planejador. Diz o que ter em mãos
// e faz a transição de cor do branco para o âmbar do capítulo do planejador.
// Não importa nada de outra seção; o botão só aponta para a âncora #planejador.

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

// Conta de luz e planta do telhado, em formas planas, com os números 1, 2 e 3
// que correspondem à lista ao lado. Tamanho fixo em px (não estica).
const ILUSTRACAO = `
  <svg class="ei-pon__svg" width="360" height="310" viewBox="0 0 360 310" role="img" aria-labelledby="ei-pon-svg-titulo">
    <title id="ei-pon-svg-titulo">Conta de luz com o consumo, o total e o CEP marcados, e a planta de um telhado de 10 por 8 metros</title>

    <!-- Conta de luz -->
    <rect x="8" y="8" width="252" height="280" rx="14" fill="#ffffff"/>
    <rect x="8" y="8" width="252" height="44" rx="14" fill="#fde3a7"/>
    <rect x="8" y="38" width="252" height="14" fill="#fde3a7"/>
    <circle cx="30" cy="30" r="6" fill="#f59e0b"/>
    <text x="44" y="34" class="ei-pon__svg-cab">CONTA DE ENERGIA</text>
    <text x="244" y="34" text-anchor="end" class="ei-pon__svg-cab">NOV/2026</text>

    <text x="24" y="76" class="ei-pon__svg-rot">Endereço da instalação</text>
    <rect x="24" y="86" width="150" height="8" rx="4" fill="#e6e8ec"/>
    <rect x="24" y="100" width="94" height="8" rx="4" fill="#e6e8ec"/>
    <rect x="124" y="95" width="98" height="18" rx="5" fill="#fde3a7"/>
    <text x="130" y="108" class="ei-pon__svg-val">CEP 00000-000</text>

    <line x1="24" y1="126" x2="244" y2="126" stroke="#e6e8ec"/>
    <text x="24" y="152" class="ei-pon__svg-rot">Consumo do mês</text>
    <rect x="150" y="137" width="80" height="22" rx="6" fill="#fde3a7"/>
    <text x="190" y="153" text-anchor="middle" class="ei-pon__svg-val">350 kWh</text>
    <text x="24" y="182" class="ei-pon__svg-rot">Total a pagar</text>
    <text x="230" y="182" text-anchor="end" class="ei-pon__svg-val">R$ 312,40</text>

    <line x1="24" y1="198" x2="244" y2="198" stroke="#e6e8ec"/>
    <text x="24" y="220" class="ei-pon__svg-rot">Histórico de consumo</text>
    <g fill="#e6e8ec">
      <rect x="24" y="248" width="9" height="22" rx="2"/>
      <rect x="38" y="244" width="9" height="26" rx="2"/>
      <rect x="52" y="240" width="9" height="30" rx="2"/>
      <rect x="66" y="242" width="9" height="28" rx="2"/>
      <rect x="80" y="246" width="9" height="24" rx="2"/>
      <rect x="94" y="250" width="9" height="20" rx="2"/>
      <rect x="108" y="252" width="9" height="18" rx="2"/>
      <rect x="122" y="250" width="9" height="20" rx="2"/>
      <rect x="136" y="246" width="9" height="24" rx="2"/>
      <rect x="150" y="242" width="9" height="28" rx="2"/>
      <rect x="164" y="238" width="9" height="32" rx="2"/>
    </g>
    <rect x="178" y="240" width="9" height="30" rx="2" fill="#fbc96b"/>
    <rect x="8.5" y="8.5" width="251" height="279" rx="13.5" fill="none" stroke="#e6e8ec"/>

    <!-- Planta do telhado -->
    <rect x="196.5" y="186.5" width="155" height="115" rx="12" fill="#ffffff" stroke="#e6e8ec"/>
    <text x="276" y="208" text-anchor="middle" class="ei-pon__svg-rot">10 m</text>
    <rect x="228.5" y="216.5" width="96" height="60" fill="#fffaf0" stroke="#c9ced6"/>
    <line x1="228.5" y1="246.5" x2="324.5" y2="246.5" stroke="#c9ced6"/>
    <g fill="#2b3a55">
      <rect x="238" y="221" width="16" height="21" rx="2"/>
      <rect x="258" y="221" width="16" height="21" rx="2"/>
      <rect x="278" y="221" width="16" height="21" rx="2"/>
      <rect x="298" y="221" width="16" height="21" rx="2"/>
    </g>
    <text x="339" y="251" text-anchor="middle" class="ei-pon__svg-rot">8 m</text>
    <text x="276" y="292" text-anchor="middle" class="ei-pon__svg-rot">Telhado visto de cima</text>

    <!-- Marcadores -->
    <g class="ei-pon__svg-marca">
      <circle cx="278" cy="148" r="11"/><text x="278" y="152" text-anchor="middle">1</text>
      <circle cx="240" cy="104" r="11"/><text x="240" y="108" text-anchor="middle">2</text>
      <circle cx="212" cy="204" r="11"/><text x="212" y="208" text-anchor="middle">3</text>
    </g>
  </svg>`;

const ITENS = [
  {
    titulo: 'A sua conta de luz',
    texto: 'O valor em reais ou, melhor ainda, o consumo do mês em kWh. Os dois estão impressos na conta.'
  },
  {
    titulo: 'O CEP do imóvel',
    texto: 'Serve só para buscar o sol e a tarifa da sua região. O endereço não é guardado.'
  },
  {
    titulo: 'Uma ideia do telhado',
    texto: 'Largura e comprimento aproximados. Se não souber, comece pelo telhado de exemplo e ajuste depois.'
  }
];

export async function iniciarPonte(raiz) {
  destruir();
  await carregarCss('./ponte.css');

  raiz.classList.add('ei-pon');
  raiz.innerHTML = `
    <div class="ei-pon__interno">
      <div class="ei-pon__arte">${ILUSTRACAO}</div>
      <div class="ei-pon__conteudo">
        <p class="ei-pon__chamada">Da conversa para os números</p>
        <h2 class="ei-pon__titulo">Antes de simular, separe três coisas</h2>
        <p class="ei-pon__apoio">Com elas em mãos, o planejador faz a conta em poucos minutos. Se faltar alguma, tudo bem: ele usa valores médios da sua região e mostra onde.</p>
        <ol class="ei-pon__lista">
          ${ITENS.map((item, i) => `
            <li class="ei-pon__item">
              <span class="ei-pon__num" aria-hidden="true">${i + 1}</span>
              <div>
                <h3 class="ei-pon__item-titulo">${item.titulo}</h3>
                <p class="ei-pon__item-texto">${item.texto}</p>
              </div>
            </li>`).join('')}
        </ol>
        <div class="ei-pon__acao">
          <a class="ei-pon__botao" href="#planejador">Abrir o planejador <span aria-hidden="true">↓</span></a>
          <span class="ei-pon__nota">Não precisa de cadastro para simular.</span>
        </div>
      </div>
    </div>`;

  ativo = { raiz };
}

export function destruir() {
  if (!ativo) return;
  ativo.raiz.classList.remove('ei-pon');
  ativo.raiz.replaceChildren();
  ativo = null;
}
