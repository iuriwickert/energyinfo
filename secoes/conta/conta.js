// Conta: Entrar, Criar conta e Minha conta, em janelas sobrepostas.
// É o que contexto.abrirLogin(modo) abre. Importa só desta pasta e de nucleo/.
//
// Como as seções não se conhecem, a exclusão avisa as outras por eventos no document:
//   "ei:conta-excluindo"   detail: { uid, relatos: "apagar" | "manter", tarefas: [] }
//   "ei:simulacoes-excluir" detail: { uid, tarefas: [] }
// Quem escuta põe uma promessa em detail.tarefas; a conta espera todas antes de seguir.
import { abrirSobreposicao } from '../../nucleo/sobreposicao.js';
import * as dados from './dados.js';
import { detalheExclusao } from './regras.js';
import { telaEntrar, telaCriar, telaMinhaConta, telaExcluir, telaConfirmacao } from './telas.js';

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

async function avisarOutrasSecoes(evento, detalhe) {
  document.dispatchEvent(new CustomEvent(evento, { detail: detalhe }));
  await Promise.all(detalhe.tarefas);
}

export async function iniciarConta() {
  destruir();
  await carregarCss('./conta.css');

  const controle = new AbortController();
  let janela = null; // { modo, sob, tela } da janela principal (entrar, criar ou conta)
  let janelaExcluir = null;

  function fechar() {
    janelaExcluir?.fechar();
    janelaExcluir = null;
    janela?.sob.fechar();
    janela = null;
  }

  function registrar(modo, sob, tela = null) {
    janela = { modo, sob, tela };
  }

  function aoFecharJanela(sobDaVez) {
    return () => {
      if (janela?.sob === sobDaVez()) janela = null;
    };
  }

  function abrirEntrar() {
    const sob = abrirSobreposicao({
      titulo: 'Entrar',
      largura: 400,
      conteudo: telaEntrar({
        aoEntrar: async (usuario, senha) => {
          await dados.entrar(usuario, senha);
          fechar();
        },
        aoIrParaCriar: () => abrir('criar')
      }),
      aoFechar: aoFecharJanela(() => sob)
    });
    registrar('entrar', sob);
  }

  function abrirCriar() {
    const sob = abrirSobreposicao({
      titulo: 'Criar conta',
      largura: 400,
      conteudo: telaCriar({
        aoCriar: async (cadastro) => {
          await dados.criarConta(cadastro);
          fechar();
        },
        aoIrParaEntrar: () => abrir('entrar')
      }),
      aoFechar: aoFecharJanela(() => sob)
    });
    registrar('criar', sob);
  }

  function abrirMinhaConta() {
    const tela = telaMinhaConta({
      usuario: dados.usuarioAtual(),
      aoTrocarApelido: (apelido) => dados.trocarApelido(apelido),
      aoTrocarSenha: (atual, nova) => dados.trocarSenha(atual, nova),
      aoExcluirSimulacoes: () => avisarOutrasSecoes('ei:simulacoes-excluir', detalheExclusao(dados.usuarioAtual().uid)),
      aoPedirExclusao: abrirExcluir,
      conferirExclusao: () => dados.podeExcluirConta()
    });
    const sob = abrirSobreposicao({
      titulo: 'Minha conta',
      largura: 460,
      conteudo: tela.raiz,
      focoInicial: '#co-conta-apelido',
      aoFechar: aoFecharJanela(() => sob)
    });
    registrar('conta', sob, tela);
  }

  // Segunda sobreposição, por cima de Minha conta.
  function abrirExcluir() {
    const usuario = dados.usuarioAtual();
    if (!usuario) return;
    janelaExcluir = abrirSobreposicao({
      titulo: 'Excluir minha conta',
      largura: 420,
      conteudo: telaExcluir({
        usuario,
        aoCancelar: () => janelaExcluir?.fechar(),
        aoConfirmar: async (relatos) => {
          try {
            await avisarOutrasSecoes('ei:conta-excluindo', detalheExclusao(usuario.uid, relatos));
          } catch {
            throw new Error('Não foi possível apagar os seus dados em outra parte da plataforma. A conta não foi excluída. Tente de novo.');
          }
          await dados.excluirConta(); // apaga os nós do login e encerra a sessão
          fechar();
          const confirmacao = abrirSobreposicao({
            titulo: 'Conta excluída',
            largura: 360,
            conteudo: telaConfirmacao({
              texto: 'A sua conta e os seus dados foram apagados.',
              aoFechar: () => confirmacao.fechar()
            })
          });
        }
      }),
      focoInicial: '#co-excluir-usuario',
      aoFechar: () => {
        janelaExcluir = null;
      }
    });
  }

  /** Abre a janela pedida: 'entrar', 'criar' ou 'conta' (Minha conta). */
  function abrir(modo = 'entrar') {
    const logado = Boolean(dados.usuarioAtual());
    let destino = modo;
    if (destino === 'conta' && !logado) destino = 'entrar';
    if (destino !== 'conta' && logado) destino = 'conta';
    if (janela?.modo === destino) return;
    fechar(); // o foco volta para quem abriu, e a próxima janela guarda esse mesmo retorno
    if (destino === 'conta') abrirMinhaConta();
    else if (destino === 'criar') abrirCriar();
    else abrirEntrar();
  }

  document.addEventListener('ei:login-mudou', (evento) => {
    const usuario = evento.detail.usuario;
    if (!usuario && janela?.modo === 'conta') fechar(); // saiu (ou a conta foi excluída)
    else if (usuario && janela?.modo === 'conta') janela.tela.atualizar(usuario);
  }, { signal: controle.signal });

  ativo = { controle, fechar };
  return { abrir };
}

export function destruir() {
  if (!ativo) return;
  ativo.controle.abort();
  ativo.fechar();
  ativo = null;
}
