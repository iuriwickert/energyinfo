// Contas da paralaxe do hero (função pura, testada sem navegador).
// Quanto mais ao fundo a camada, mais ela "atrasa" em relação à rolagem.

export const LIMITE_ROLAGEM = 120; // limite padrão; o hero passa a própria altura, para o movimento ir até ele sumir
export const FATOR_SOL = 0.30;
export const FATOR_FUNDO = 0.15;
export const FATOR_FRENTE = 0.06;
export const GRAUS_POR_PX = 2.5;
export const RAZAO_TURBINA_DIREITA = 0.8;

/**
 * Recebe a rolagem da página (px) e devolve o deslocamento vertical de cada
 * camada (px) e o giro das pás de cada turbina (graus).
 */
export function calcularParalaxe(rolagemDaPagina, limite = LIMITE_ROLAGEM) {
  const rolagem = Math.min(Math.max(Number(rolagemDaPagina) || 0, 0), Math.max(0, Number(limite) || 0));
  return {
    rolagem,
    sol: rolagem * FATOR_SOL,
    fundo: rolagem * FATOR_FUNDO,
    frente: rolagem * FATOR_FRENTE,
    paineis: 0,
    pasEsquerda: rolagem * GRAUS_POR_PX,
    pasDireita: rolagem * GRAUS_POR_PX * RAZAO_TURBINA_DIREITA
  };
}
