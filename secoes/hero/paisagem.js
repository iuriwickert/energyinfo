// Paisagem do hero: SVG inline, formas planas, sem degradê nem sombra.
// viewBox de 2560×260 (1 unidade = 1 px). O que importa (sol, turbinas e
// painéis) fica nos 1200 px centrais, entre x = 680 e x = 1880.
// Uma camada por <g data-ei-camada>, para a paralaxe mover cada uma.

export const LARGURA = 2560;
export const ALTURA = 260;
const CENTRO = LARGURA / 2;

const COR = {
  anelFora: '#fef0c7',
  anelDentro: '#fde3a7',
  sol: '#f59e0b',
  colinaFundo: '#d7ead0',
  colinaFrente: '#a8d29c',
  torre: '#d3dae3',
  pas: '#bcc6d2',
  eixo: '#9aa6b5',
  painel: '#1e3a5f',
  linha: '#3d5f8f'
};

const n = (valor) => Number(valor.toFixed(1));

// Curva suave que passa por todos os pontos (Catmull-Rom convertida em Bézier).
function curva(pontos) {
  let d = `M${pontos[0][0]},${pontos[0][1]}`;
  for (let i = 0; i < pontos.length - 1; i += 1) {
    const p0 = pontos[Math.max(i - 1, 0)];
    const p1 = pontos[i];
    const p2 = pontos[i + 1];
    const p3 = pontos[Math.min(i + 2, pontos.length - 1)];
    d += ` C${n(p1[0] + (p2[0] - p0[0]) / 6)},${n(p1[1] + (p2[1] - p0[1]) / 6)}`
      + ` ${n(p2[0] - (p3[0] - p1[0]) / 6)},${n(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

// A colina desce além da borda de baixo para não aparecer vão quando a camada se move.
function colina(pontos, cor) {
  return `<path d="${curva(pontos)} L${LARGURA},${ALTURA + 60} L0,${ALTURA + 60} Z" fill="${cor}"/>`;
}

const COLINAS_FUNDO = [
  [0, 178], [200, 154], [420, 172], [640, 188], [860, 168], [1060, 174], [1280, 160],
  [1500, 174], [1720, 170], [1940, 188], [2160, 172], [2380, 152], [2560, 174]
];

const COLINA_FRENTE = [
  [0, 216], [240, 230], [520, 208], [800, 202], [1040, 182], [1280, 173],
  [1520, 182], [1760, 204], [2040, 210], [2320, 230], [2560, 214]
];

// Turbina: torre fixa e um grupo de pás que gira em torno do eixo (origem do grupo).
function turbina({ x, base, eixo, escala, giroInicial, lado }) {
  const pa = (angulo) => `<path transform="rotate(${angulo})" d="M-2.8,2 L-1.2,-46 Q0,-50 1.2,-46 L2.8,2 Z"/>`;
  return `
    <path d="M${x - 2.4 * escala},${eixo} L${x + 2.4 * escala},${eixo} L${x + 5.5 * escala},${base} L${x - 5.5 * escala},${base} Z" fill="${COR.torre}"/>
    <g transform="translate(${x},${eixo}) scale(${escala}) rotate(${giroInicial})">
      <g class="ei-hero__pas" data-ei-pas="${lado}" fill="${COR.pas}">${pa(0)}${pa(120)}${pa(240)}</g>
      <circle r="4.6" fill="${COR.eixo}"/>
    </g>`;
}

// Campo de painéis em perspectiva: as laterais de cada painel apontam para o ponto de fuga.
const FUGA = { x: CENTRO, y: 120 };
const LINHA_DA_FRENTE = 262;
const FILEIRAS = [[196, 180], [225, 203], [262, 233]]; // [base, topo] de cada fileira, do fundo para a frente
const COLUNAS = 5;
const LARGURA_PAINEL = 120;
const VAO = 14;

function emPerspectiva(x, y) {
  return n(FUGA.x + (x - FUGA.x) * (y - FUGA.y) / (LINHA_DA_FRENTE - FUGA.y));
}

function painel(x0, base, topo) {
  const x1 = x0 + LARGURA_PAINEL;
  const cantos = [[x0, base], [x1, base], [x1, topo], [x0, topo]]
    .map(([x, y]) => `${emPerspectiva(x, y)},${y}`).join(' ');
  const meio = (base + topo) / 2;
  let linhas = `M${emPerspectiva(x0, meio)},${meio} L${emPerspectiva(x1, meio)},${meio}`;
  for (let k = 1; k <= 3; k += 1) {
    const x = x0 + (LARGURA_PAINEL / 4) * k;
    linhas += ` M${emPerspectiva(x, base)},${base} L${emPerspectiva(x, topo)},${topo}`;
  }
  return `<polygon points="${cantos}" fill="${COR.painel}"/><path d="${linhas}" fill="none" stroke="${COR.linha}" stroke-width="1.2"/>`;
}

function paineis() {
  const larguraTotal = COLUNAS * LARGURA_PAINEL + (COLUNAS - 1) * VAO;
  const inicio = CENTRO - larguraTotal / 2;
  let saida = '';
  for (const [base, topo] of FILEIRAS) {
    for (let coluna = 0; coluna < COLUNAS; coluna += 1) {
      saida += painel(inicio + coluna * (LARGURA_PAINEL + VAO), base, topo);
    }
  }
  return saida;
}

// Nuvens chapadas e bem claras, no alto; o CSS faz elas passarem devagar.
function nuvem(x, y, e) {
  return `<g transform="translate(${x} ${y}) scale(${e})"><path d="M0 22a14 14 0 0 1 14-14 20 20 0 0 1 36-4 15 15 0 0 1 22 12 11 11 0 0 1 2 22H8A8 8 0 0 1 0 22z" fill="#e3ebf3" opacity=".85"/></g>`;
}
function nuvens() {
  return `<g class="ei-hero__nuvem ei-hero__nuvem--a">${nuvem(560, 26, 1.1)}${nuvem(1990, 46, .8)}</g>
    <g class="ei-hero__nuvem ei-hero__nuvem--b">${nuvem(1060, 12, .7)}${nuvem(2300, 20, 1)}</g>`;
}

/** Devolve o SVG completo da paisagem, como texto. */
export function desenharPaisagem() {
  return `
<svg class="ei-hero__svg" viewBox="0 0 ${LARGURA} ${ALTURA}" height="${ALTURA}" preserveAspectRatio="xMidYMax slice" role="img" aria-labelledby="ei-hero-paisagem-titulo" focusable="false">
  <g class="ei-hero__nuvens" aria-hidden="true">${nuvens()}</g>
  <g class="ei-hero__camada" data-ei-camada="sol">
    <circle class="ei-hero__anel ei-hero__anel--fora" cx="${CENTRO}" cy="138" r="124" fill="${COR.anelFora}"/>
    <circle class="ei-hero__anel ei-hero__anel--dentro" cx="${CENTRO}" cy="138" r="84" fill="${COR.anelDentro}"/>
    <circle cx="${CENTRO}" cy="138" r="46" fill="${COR.sol}"/>
  </g>
  <g class="ei-hero__camada" data-ei-camada="fundo">
    ${colina(COLINAS_FUNDO, COR.colinaFundo)}
    
    ${turbina({ x: 860, base: 184, eixo: 66, escala: 1, giroInicial: 18, lado: 'esquerda' })}
    ${turbina({ x: 1720, base: 186, eixo: 84, escala: 0.86, giroInicial: -24, lado: 'direita' })}
  </g>
  <g class="ei-hero__camada" data-ei-camada="frente">
    ${colina(COLINA_FRENTE, COR.colinaFrente)}
  </g>
  <g data-ei-camada="paineis">
    ${paineis()}
    <!-- reflexo de luz que atravessa os painéis de tempos em tempos -->
    <clipPath id="ei-hero-clip-paineis">${paineis().replace(/<path[^>]*\/>/g, '')}</clipPath>
    <g clip-path="url(#ei-hero-clip-paineis)" aria-hidden="true">
      <rect class="ei-hero__reflexo" x="${CENTRO - 420}" y="170" width="70" height="100" fill="#ffffff" opacity=".18" transform="skewX(-24)"/>
    </g>
  </g>
</svg>`;
}
