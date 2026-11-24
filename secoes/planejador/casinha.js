/**
 * casinha.js — telhado do modo Padrão: uma casinha ilustrada que reage a cada resposta.
 * Uma pergunta por vez (formato, tamanho, para onde a frente está virada, inclinação).
 * O sol mostra qual lado do telhado é bom. Não desenha nada: só chama o editor de telhado
 * (o mesmo do modo Expert), que faz as contas.
 */

const DIRECOES = [['N', 0, 'norte'], ['NE', 45, 'nordeste'], ['L', 90, 'leste'], ['SE', 135, 'sudeste'], ['S', 180, 'sul'], ['SO', 225, 'sudoeste'], ['O', 270, 'oeste'], ['NO', 315, 'noroeste']];
// rosa dos ventos 3×3; o centro é a casinha
const ROSA = ['NO', 'N', 'NE', 'O', null, 'L', 'SO', 'S', 'SE'];
const FORMATOS = [
  ['duas', 'Duas águas', 'O mais comum', 'M4 20L22 6l18 14'],
  ['uma', 'Uma água', 'Cai para um lado só', 'M4 10l36 8'],
  ['laje', 'Laje', 'Plano, de concreto', 'M4 16h36'],
];
const INCLINACOES = [[10, 'Deitado', 'M3 15L21 11'], [20, 'Normal', 'M3 15L21 7'], [30, 'Em pé', 'M3 15L21 3']];
const nomeDir = (az) => DIRECOES[Math.round((((az % 360) + 360) % 360) / 45) % 8][2];
const fmt = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

// No Brasil o sol passa pelo norte: 1 = lado virado para o norte, 0 = para o sul
const solDe = (az) => (1 + Math.cos((az * Math.PI) / 180)) / 2;
const nivel = (s) => (s >= 0.75 ? 'muito sol' : s >= 0.35 ? 'sol bom' : 'pouco sol');
const corTelha = (s) => (s >= 0.75 ? '#f59e0b' : s >= 0.35 ? '#fcd38a' : '#c9d0d9');

export function criarCasinha(box, editor, aoTocar = () => {}) {
  let passo = 0;
  const estado = () => ({
    forma: ['duas', 'uma', 'laje'].includes(editor.forma) ? editor.forma : null,
    W: editor.largura, L: editor.comprimento,
    frente: (((180 - editor.norte) % 360) + 360) % 360,
    incl: editor.inclinacao,
  });
  const aplicar = (mudar) => {
    const e = { ...estado(), ...mudar };
    if (!e.forma) e.forma = 'duas';
    editor.norte = (((180 - e.frente) % 360) + 360) % 360;
    if (e.forma !== 'laje' && e.incl < 10) e.incl = 20;
    editor.inclinacao = e.incl;
    aoTocar(mudar);
    editor.setForma(e.forma, e.W, e.L, true);
    render();
  };
  // a direção da frente aparece em todos os formatos; a inclinação não, na laje (os painéis vão em suportes)
  const perguntas = () => (estado().forma === 'laje' ? ['formato', 'tamanho', 'frente'] : ['formato', 'tamanho', 'frente', 'inclinacao']);

  /* ---------- a ilustração (casa vista de lado: frente à esquerda, fundo à direita) ---------- */
  function cena(e) {
    const cx = 320, chao = 226, w = 250, L = cx - w / 2, R = cx + w / 2, topo = 150;
    const alt = e.incl <= 10 ? 26 : e.incl <= 20 ? 48 : 72;
    const sF = solDe(e.frente), sB = solDe(e.frente + 180);
    let telhado = '', rotulos = '', melhor;
    if (e.forma === 'laje') {
      telhado = `<rect x="${L - 6}" y="${topo - 10}" width="${w + 12}" height="12" rx="2" fill="#d6dbe1" stroke="#5b6475"/>` +
        [0, 1, 2, 3].map((i) => `<path d="M${L + 18 + i * 56} ${topo - 12}l38 -22h9l-38 22z" fill="#1e3a5f"/>`).join('');
      rotulos = `<text x="${cx}" y="${chao + 26}" text-anchor="middle" class="pl-casa-rot">Os painéis ficam em suportes, virados para o norte</text>`;
      melhor = 1;
    } else if (e.forma === 'uma') {
      telhado = `<path d="M${L - 10} ${topo + 4}L${R + 10} ${topo - alt}V${topo + 4}Z" fill="${corTelha(sF)}" stroke="#5b6475" stroke-width="1.5" stroke-linejoin="round"/>`;
      rotulos = `<text x="${cx}" y="${chao + 26}" text-anchor="middle" class="pl-casa-rot">Telhado caindo para a frente: <tspan class="pl-casa-forte">${nivel(sF)}</tspan></text>`;
      melhor = sF;
    } else {
      telhado = `<path d="M${L - 10} ${topo + 4}L${cx} ${topo - alt}V${topo + 4}Z" fill="${corTelha(sF)}" stroke="#5b6475" stroke-width="1.5" stroke-linejoin="round"/>` +
        `<path d="M${cx} ${topo - alt}L${R + 10} ${topo + 4}H${cx}Z" fill="${corTelha(sB)}" stroke="#5b6475" stroke-width="1.5" stroke-linejoin="round"/>`;
      rotulos = `<text x="${L + 40}" y="${chao + 26}" text-anchor="middle" class="pl-casa-rot">Frente: <tspan class="pl-casa-forte">${nivel(sF)}</tspan></text>` +
        `<text x="${R - 40}" y="${chao + 26}" text-anchor="middle" class="pl-casa-rot">Fundo: <tspan class="pl-casa-forte">${nivel(sB)}</tspan></text>`;
      melhor = Math.max(sF, sB);
    }
    // o sol fica no céu do lado que recebe mais sol
    const solX = e.forma === 'laje' ? cx : sF >= sB ? 120 : 520, solY = 54 + (1 - melhor) * 40;
    const corpo = `<rect x="${L}" y="${topo}" width="${w}" height="${chao - topo}" fill="#fbf7ef" stroke="#5b6475" stroke-width="1.5"/>` +
      `<rect x="${L + 26}" y="${chao - 46}" width="30" height="46" rx="2" fill="#d9a066"/>` +
      `<rect x="${L + 84}" y="${topo + 20}" width="38" height="30" rx="2" fill="#cfe3f6" stroke="#5b6475"/>` +
      `<rect x="${R - 70}" y="${topo + 20}" width="38" height="30" rx="2" fill="#cfe3f6" stroke="#5b6475"/>`;
    return `<svg viewBox="0 0 640 262" role="img" aria-label="Casa vista de lado: a frente à esquerda e o fundo à direita.">
      <rect width="640" height="262" rx="14" fill="#eef6fd"/>
      <path d="M60 232Q320 -10 580 232" fill="none" stroke="#fcd38a" stroke-width="2" stroke-dasharray="3 7"/>
      <g class="pl-casa-sol" data-x="${solX}" data-y="${solY}" style="transform:translate(${solAntes ? solAntes.join('px,') : `${solX}px,${solY}`}px)"><circle r="30" fill="#fde7b0"/><circle r="19" fill="#f59e0b"/></g>
      <path d="M0 ${chao}H640V248a14 14 0 0 1-14 14H14a14 14 0 0 1-14-14z" fill="#d5ebc6"/>
      ${corpo}${telhado}
      <text x="${L - 14}" y="${chao - 6}" text-anchor="end" class="pl-casa-rot">frente</text>
      <text x="${R + 14}" y="${chao - 6}" class="pl-casa-rot">fundo</text>
      ${rotulos}
    </svg>`;
  }

  function frase(e) {
    if (!e.forma) return 'Escolha o formato do telhado para começar.';
    if (e.forma === 'laje') return 'Laje é ótima: os painéis são montados virados para o sol.';
    const s = e.forma === 'uma' ? solDe(e.frente) : Math.max(solDe(e.frente), solDe(e.frente + 180));
    if (s >= 0.75) return 'Ótimo! Um lado do telhado pega bastante sol.';
    if (s >= 0.35) return 'Bom: o telhado pega sol boa parte do dia.';
    return 'Esse lado pega pouco sol. Ainda funciona, mas gera menos.';
  }

  /* ---------- as perguntas ---------- */
  function pergunta(e) {
    const qual = perguntas()[passo];
    if (qual === 'formato') return `<p class="pl-casa-q">Como é o telhado da sua casa?</p>
      <div class="pl-casa-ops">${FORMATOS.map(([k, n, d, p]) => `<button type="button" data-forma="${k}" aria-pressed="${e.forma === k}"><svg viewBox="0 0 44 24" aria-hidden="true"><path d="${p}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg><b>${n}</b><small>${d}</small></button>`).join('')}</div>`;
    if (qual === 'tamanho') {
      const caixa = (k, rot, v) => `<div class="pl-casa-num"><span>${rot}</span><div><button type="button" data-m="${k}" data-d="-1" aria-label="Diminuir ${rot}">−</button><b>${fmt(v)} m</b><button type="button" data-m="${k}" data-d="1" aria-label="Aumentar ${rot}">+</button></div></div>`;
      return `<p class="pl-casa-q">Mais ou menos, qual é o tamanho da casa?</p>
        <div class="pl-casa-tam">${caixa('W', 'Largura da frente', e.W)}${caixa('L', 'Do fundo até a frente', e.L)}</div>
        <p class="pl-casa-nota">Dá cerca de ${fmt(e.W * e.L)} m² de telhado. Não precisa ser exato.</p>`;
    }
    if (qual === 'frente') {
      const sel = DIRECOES[Math.round(e.frente / 45) % 8][0];
      return `<p class="pl-casa-q">Para onde a frente da casa está virada?</p>
        <div class="pl-casa-frente"><div class="pl-casa-rosa" role="group" aria-label="Direção da frente da casa">${ROSA.map((k) => {
          if (!k) return '<span aria-hidden="true">frente</span>';
          const d = DIRECOES.find((x) => x[0] === k);
          return `<button type="button" data-frente="${d[1]}" aria-pressed="${sel === k}" title="${d[2]}">${k}</button>`;
        }).join('')}</div>
        <p class="pl-casa-nota">Não sabe? Fique na porta de casa olhando para a rua e abra a bússola do celular (ou o mapa, que mostra o norte para cima).</p></div>`;
    }
    return `<p class="pl-casa-q">O telhado é mais deitado ou mais em pé?</p>
      <div class="pl-casa-ops">${INCLINACOES.map(([v, n, p]) => `<button type="button" data-incl="${v}" aria-pressed="${e.incl === v}"><svg viewBox="0 0 24 18" aria-hidden="true"><path d="${p}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg><b>${n}</b></button>`).join('')}</div>`;
  }

  let solAntes = null; // posição anterior do sol, para ele deslizar até a nova
  function render() {
    const e = estado(), lista = perguntas();
    const velho = box.querySelector('.pl-casa-sol');
    solAntes = velho ? [velho.dataset.x, velho.dataset.y] : null;
    passo = Math.min(passo, lista.length - 1);
    box.innerHTML = `
      <div class="pl-casa-cena">${cena(e)}</div>
      <p class="pl-casa-frase" aria-live="polite">${frase(e)}</p>
      <div class="pl-casa-passos" role="tablist" aria-label="Perguntas sobre o telhado">${lista.map((_, i) => `<button type="button" role="tab" data-ir="${i}" aria-selected="${i === passo}" aria-label="Pergunta ${i + 1} de ${lista.length}"></button>`).join('')}</div>
      <div class="pl-casa-pergunta">${pergunta(e)}</div>
      <div class="pl-casa-nav">
        <button type="button" class="pl-btn" data-nav="-1"${passo === 0 ? ' hidden' : ''}>Voltar</button>
        <span>${e.forma ? `${e.forma === 'laje' ? 'Laje' : `Frente virada para o ${nomeDir(e.frente)}`} · ${fmt(e.W)} × ${fmt(e.L)} m` : ''}</span>
        <button type="button" class="pl-btn pl-btn-sol" data-nav="1"${passo === lista.length - 1 ? ' hidden' : ''}>Próxima</button>
      </div>`;
    const sol = box.querySelector('.pl-casa-sol');
    if (solAntes) requestAnimationFrame(() => requestAnimationFrame(() => { sol.style.transform = `translate(${sol.dataset.x}px,${sol.dataset.y}px)`; }));
    const q = (s) => box.querySelectorAll(s);
    q('[data-forma]').forEach((b) => b.onclick = () => aplicar({ forma: b.dataset.forma }));
    q('[data-m]').forEach((b) => b.onclick = () => {
      const k = b.dataset.m, v = estado()[k] + Number(b.dataset.d);
      if (v >= 3 && v <= 40) aplicar({ [k]: v });
    });
    q('[data-frente]').forEach((b) => b.onclick = () => aplicar({ frente: Number(b.dataset.frente) }));
    q('[data-incl]').forEach((b) => b.onclick = () => aplicar({ incl: Number(b.dataset.incl) }));
    q('[data-ir]').forEach((b) => b.onclick = () => { passo = Number(b.dataset.ir); render(); });
    q('[data-nav]').forEach((b) => b.onclick = () => { passo += Number(b.dataset.nav); render(); });
  }

  return { render };
}
