// O que a coluna "Conta" do rodapé mostra para cada tipo de pessoa (função pura).

export const ENDERECO_PAINEL = 'admin/index.html';

/**
 * @param {object|null} usuario  perfil da sessão, ou null para visitante
 * @param {boolean} carregando   true enquanto a sessão guardada ainda é conferida
 * @returns {{ tipo: string, itens: Array<{ acao?: string, href?: string, texto: string }>, painel: null | { href: string, avisoSenha: boolean } }}
 */
export function estadoDaConta(usuario, carregando = false) {
  if (!usuario) {
    if (carregando) return { tipo: 'carregando', itens: [], painel: null };
    return {
      tipo: 'visitante',
      itens: [
        { acao: 'entrar', texto: 'Entrar' },
        { acao: 'criar', texto: 'Criar conta' }
      ],
      painel: null
    };
  }
  const admin = usuario.papel === 'admin';
  return {
    tipo: admin ? 'admin' : 'usuario',
    itens: [
      { acao: 'conta', texto: 'Minha conta' },
      { href: '#planejador?historico=1', texto: 'Histórico de simulações' },
      { acao: 'sair', texto: 'Sair' }
    ],
    // Só o admin recebe o acesso ao painel. Para os outros, ele nem é desenhado.
    painel: admin ? { href: ENDERECO_PAINEL, avisoSenha: usuario.senhaPadrao === true } : null
  };
}
