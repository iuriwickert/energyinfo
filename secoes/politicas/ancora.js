// Leitura da âncora das políticas (função pura, testada sem navegador).
// #politicas/termos, #politicas/privacidade e #politicas/aviso.

export const ABAS = [
  { id: 'termos', rotulo: 'Termos de uso', arquivo: './textos/termos.html' },
  { id: 'privacidade', rotulo: 'Privacidade', arquivo: './textos/privacidade.html' },
  { id: 'aviso', rotulo: 'Aviso legal', arquivo: './textos/aviso.html' }
];

export const ATUALIZADO_EM = '16 de novembro de 2026';

/**
 * Devolve o id da aba pedida pela âncora, ou null se a âncora não é das políticas.
 * "#politicas" sozinho, ou com uma aba desconhecida, abre os Termos de uso.
 */
export function lerAncora(hash) {
  const partes = String(hash ?? '').replace(/^#/, '').split('?')[0].split('/');
  if (partes[0] !== 'politicas') return null;
  return ABAS.some((aba) => aba.id === partes[1]) ? partes[1] : ABAS[0].id;
}

export function ancoraDaAba(id) {
  return `#politicas/${id}`;
}
