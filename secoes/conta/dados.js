// Dados da conta. Esta seção só usa os nós do login (usuarios, credenciais e
// indiceUsuarios), sempre por nucleo/sessao.js. As telas falam só com este arquivo.
export {
  usuarioAtual,
  entrar,
  criarConta,
  sair,
  trocarSenha,
  trocarApelido,
  podeExcluirConta,
  excluirConta
} from '../../nucleo/sessao.js';
