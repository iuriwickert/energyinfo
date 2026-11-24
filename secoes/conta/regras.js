// Regras pequenas das telas da conta (funções puras, testadas sem navegador).

/** A pessoa digitou o próprio usuário para confirmar a exclusão? */
export function confirmacaoConfere(digitado, usuario) {
  const texto = String(digitado ?? '').trim().toLowerCase();
  return texto !== '' && texto === String(usuario ?? '');
}

/** Apelido em branco no cadastro vira o próprio nome de usuário. */
export function apelidoOuUsuario(apelido, usuario) {
  const limpo = String(apelido ?? '').trim();
  return limpo || String(usuario ?? '').trim().toLowerCase();
}

/** Devolve a mensagem de erro da confirmação de senha, ou ''. */
export function conferirConfirmacao(senha, confirmar) {
  return senha === confirmar ? '' : 'As duas senhas não são iguais.';
}

/**
 * Monta o detalhe dos eventos que avisam as outras seções.
 * Quem escuta põe uma promessa em `tarefas`; a conta espera todas.
 */
export function detalheExclusao(uid, relatos) {
  const detalhe = { uid, tarefas: [] };
  if (relatos !== undefined) detalhe.relatos = relatos === 'manter' ? 'manter' : 'apagar';
  return detalhe;
}
