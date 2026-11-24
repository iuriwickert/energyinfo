// Sessão: quem está logado, papel e permissões. Login próprio, guardado no
// Realtime Database (sem Firebase Authentication):
//   usuarios/{uid}            perfil, sem senha
//   credenciais/{uid}         salt, senhaHash, iteracoes
//   indiceUsuarios/{usuario}  { uid } (garante nome de usuário único)
// No navegador fica só { uid } em localStorage (chave ei.sessao).
// A cada mudança de login, emite "ei:login-mudou" no document.
import * as bancoPadrao from './firebase.js';
import { gerarCredencial, conferirSenha } from './senha.js';

export const CHAVE_SESSAO = 'ei.sessao';
export const EVENTO_LOGIN = 'ei:login-mudou';
export const USUARIO_ADMIN = 'admin';

const MSG_LOGIN = 'Usuário ou senha incorretos';
const MSG_CONEXAO = 'Não foi possível falar com o banco de dados. Confira a internet e tente de novo.';
const MSG_SEM_LOGIN = 'Entre na sua conta para continuar.';
const FORMATO_USUARIO = /^[a-z0-9_]{3,20}$/;
const FORMATO_UID = /^[A-Za-z0-9_-]{1,64}$/;
const APELIDOS_RESERVADOS = ['admin', 'administrador', 'moderador'];
const SENHA_MINIMA = 4;
const SENHA_MAXIMA = 128;

/** Erro com mensagem pronta para mostrar à pessoa. `campo` diz onde está o problema. */
export class ErroSessao extends Error {
  constructor(mensagem, campo = '') {
    super(mensagem);
    this.name = 'ErroSessao';
    this.campo = campo;
  }
}

// ---------- Validações (puras) ----------

export function normalizarUsuario(texto) {
  return String(texto ?? '').trim().toLowerCase();
}

function semAcento(texto) {
  return String(texto ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Devolve a mensagem de erro, ou '' se o usuário é válido. */
export function validarUsuario(usuario) {
  const texto = String(usuario ?? '');
  if (texto.length < 3 || texto.length > 20) return 'O usuário precisa ter de 3 a 20 caracteres.';
  if (!FORMATO_USUARIO.test(texto)) return 'No usuário, use só letras minúsculas, números e _.';
  return '';
}

/** Apelidos que parecem de administrador só valem para quem é admin. */
export function validarApelido(apelido, { admin = false } = {}) {
  const texto = String(apelido ?? '').trim();
  const tamanho = [...texto].length;
  if (tamanho < 2 || tamanho > 24) return 'O apelido precisa ter de 2 a 24 caracteres.';
  if (!admin && APELIDOS_RESERVADOS.some((palavra) => semAcento(texto).includes(palavra))) {
    return 'Esse apelido não é permitido, porque parece ser de um administrador.';
  }
  return '';
}

export function validarSenha(senha) {
  const texto = typeof senha === 'string' ? senha : '';
  if (texto.length < SENHA_MINIMA) return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  if (texto.length > SENHA_MAXIMA) return `A senha pode ter no máximo ${SENHA_MAXIMA} caracteres.`;
  return '';
}

/** Devolve { campo: mensagem } com os erros do cadastro (objeto vazio = tudo certo). */
export function validarCadastro({ usuario, apelido, senha, confirmar, aceite } = {}) {
  const erros = {};
  const erroUsuario = validarUsuario(usuario);
  if (erroUsuario) erros.usuario = erroUsuario;
  else if (usuario === USUARIO_ADMIN) erros.usuario = 'Esse nome de usuário não está disponível.';
  const erroApelido = validarApelido(apelido);
  if (erroApelido) erros.apelido = erroApelido;
  const erroSenha = validarSenha(senha);
  if (erroSenha) erros.senha = erroSenha;
  else if (senha !== confirmar) erros.confirmar = 'As duas senhas não são iguais.';
  if (aceite !== true) erros.aceite = 'Para criar a conta, é preciso aceitar os Termos de uso e a Política de privacidade.';
  return erros;
}

export function ehAdmin(usuario) {
  return usuario?.papel === 'admin';
}

export function podeComentar(usuario) {
  return Boolean(usuario) && usuario.bloqueado !== true && usuario.podeComentar !== false;
}

// ---------- Sessão ----------

function montarPerfil(uid, dados) {
  return {
    uid,
    usuario: String(dados.usuario ?? ''),
    apelido: String(dados.apelido ?? dados.usuario ?? ''),
    papel: dados.papel === 'admin' ? 'admin' : 'usuario',
    podeComentar: dados.podeComentar !== false,
    bloqueado: dados.bloqueado === true,
    motivo: String(dados.motivo ?? ''),
    senhaPadrao: dados.senhaPadrao === true,
    criadoEm: dados.criadoEm ?? null,
    aceiteEm: dados.aceiteEm ?? null
  };
}

function criarEvento(nome, detail) {
  if (typeof CustomEvent === 'function') return new CustomEvent(nome, { detail });
  const evento = new Event(nome);
  evento.detail = detail;
  return evento;
}

/**
 * Cria uma sessão. O banco, o armazenamento, o documento e o relógio entram
 * por parâmetro; sem parâmetros, usa os do navegador e o banco de verdade.
 */
export function criarSessao({
  banco = bancoPadrao,
  armazenamento = () => globalThis.localStorage,
  alvo = () => globalThis.document,
  agora = () => new Date()
} = {}) {
  let atual = null;
  let pronta = false;
  let inicio = null;

  function cofre() {
    try {
      return armazenamento() ?? null;
    } catch {
      return null;
    }
  }

  function uidGuardado() {
    try {
      const uid = JSON.parse(cofre()?.getItem(CHAVE_SESSAO) ?? 'null')?.uid;
      return typeof uid === 'string' && FORMATO_UID.test(uid) ? uid : null;
    } catch {
      return null;
    }
  }

  function guardarUid(uid) {
    try {
      cofre()?.setItem(CHAVE_SESSAO, JSON.stringify({ uid }));
    } catch { /* sem armazenamento: a sessão vale só para esta página */ }
  }

  function esquecerUid() {
    try {
      cofre()?.removeItem(CHAVE_SESSAO);
    } catch { /* nada a apagar */ }
  }

  function usuarioAtual() {
    return atual;
  }

  function definir(perfil) {
    atual = perfil ? Object.freeze({ ...perfil }) : null;
    alvo()?.dispatchEvent?.(criarEvento(EVENTO_LOGIN, { usuario: atual }));
  }

  // Erros do banco viram uma mensagem única, sem detalhes técnicos.
  async function protegido(tarefa) {
    try {
      return await tarefa();
    } catch (erro) {
      if (erro instanceof ErroSessao) throw erro;
      throw new ErroSessao(MSG_CONEXAO);
    }
  }

  function exigirLogin() {
    if (!atual) throw new ErroSessao(MSG_SEM_LOGIN);
  }

  /** true enquanto a sessão guardada ainda está sendo conferida no banco. */
  function restaurando() {
    return !pronta && uidGuardado() !== null;
  }

  /** Relê a sessão guardada. Chamar uma vez, ao carregar a página. */
  function iniciar() {
    if (inicio) return inicio;
    const uid = uidGuardado();
    if (!uid) {
      pronta = true;
      inicio = Promise.resolve(null);
      return inicio;
    }
    inicio = (async () => {
      let perfil = null;
      try {
        const dados = await banco.ler(`usuarios/${uid}`);
        if (dados && dados.bloqueado !== true) perfil = montarPerfil(uid, dados);
        else esquecerUid(); // conta apagada ou bloqueada: sai
      } catch {
        perfil = null; // sem conexão: fica como visitante nesta carga e tenta de novo na próxima
      }
      pronta = true;
      definir(perfil);
      return atual;
    })();
    return inicio;
  }

  async function entrar(usuarioDigitado, senha) {
    const usuario = normalizarUsuario(usuarioDigitado);
    if (!FORMATO_USUARIO.test(usuario) || typeof senha !== 'string' || senha === '') {
      throw new ErroSessao(MSG_LOGIN);
    }
    const perfil = await protegido(async () => {
      const uid = (await banco.ler(`indiceUsuarios/${usuario}`))?.uid;
      if (typeof uid !== 'string' || !FORMATO_UID.test(uid)) throw new ErroSessao(MSG_LOGIN);
      const credencial = await banco.ler(`credenciais/${uid}`);
      if (!credencial || !(await conferirSenha(senha, credencial))) throw new ErroSessao(MSG_LOGIN);
      const dados = await banco.ler(`usuarios/${uid}`);
      if (!dados) throw new ErroSessao(MSG_LOGIN);
      if (dados.bloqueado === true) {
        throw new ErroSessao(dados.motivo ? `Esta conta está bloqueada. Motivo: ${dados.motivo}` : 'Esta conta está bloqueada');
      }
      return montarPerfil(uid, dados);
    });
    pronta = true;
    guardarUid(perfil.uid);
    definir(perfil);
    return atual;
  }

  async function criarConta({ usuario: usuarioDigitado, apelido, senha, confirmar, aceite } = {}) {
    const usuario = normalizarUsuario(usuarioDigitado);
    const apelidoLimpo = String(apelido ?? '').trim();
    const erros = validarCadastro({ usuario, apelido: apelidoLimpo, senha, confirmar, aceite });
    const [campo] = Object.keys(erros);
    if (campo) throw new ErroSessao(erros[campo], campo);

    const perfil = await protegido(async () => {
      const credencial = await gerarCredencial(senha);
      const uid = await banco.novaChave('usuarios');
      // Reserva o nome: só grava se ainda não existir.
      const reserva = await banco.transacao(`indiceUsuarios/${usuario}`, (valor) => (valor === null || valor === undefined ? { uid } : undefined));
      if (!reserva.confirmada) throw new ErroSessao('Esse nome de usuário já está em uso.', 'usuario');
      try {
        const quando = agora().toISOString();
        const dados = {
          usuario,
          apelido: apelidoLimpo,
          papel: 'usuario',
          podeComentar: true,
          bloqueado: false,
          motivo: '',
          senhaPadrao: false,
          criadoEm: quando,
          aceiteEm: quando
        };
        await banco.gravar(`usuarios/${uid}`, dados);
        await banco.gravar(`credenciais/${uid}`, credencial);
        return montarPerfil(uid, dados);
      } catch (erro) {
        // Falhou no meio: desfaz a reserva e o que já tinha sido gravado.
        await Promise.allSettled([
          banco.apagar(`credenciais/${uid}`),
          banco.apagar(`usuarios/${uid}`),
          banco.apagar(`indiceUsuarios/${usuario}`)
        ]);
        throw erro;
      }
    });
    pronta = true;
    guardarUid(perfil.uid);
    definir(perfil);
    return atual;
  }

  function sair() {
    esquecerUid();
    pronta = true;
    definir(null);
  }

  async function trocarSenha(senhaAtual, novaSenha) {
    exigirLogin();
    const erro = validarSenha(novaSenha);
    if (erro) throw new ErroSessao(erro, 'nova');
    if (novaSenha === senhaAtual) throw new ErroSessao('A nova senha precisa ser diferente da atual.', 'nova');
    const { uid, senhaPadrao } = atual;
    await protegido(async () => {
      const credencial = await banco.ler(`credenciais/${uid}`);
      if (!credencial || !(await conferirSenha(String(senhaAtual ?? ''), credencial))) {
        throw new ErroSessao('A senha atual não confere.', 'atual');
      }
      await banco.gravar(`credenciais/${uid}`, await gerarCredencial(novaSenha));
      if (senhaPadrao) await banco.atualizar(`usuarios/${uid}`, { senhaPadrao: false });
    });
    if (senhaPadrao && atual?.uid === uid) definir({ ...atual, senhaPadrao: false });
  }

  async function trocarApelido(novoApelido) {
    exigirLogin();
    const apelido = String(novoApelido ?? '').trim();
    const erro = validarApelido(apelido, { admin: ehAdmin(atual) });
    if (erro) throw new ErroSessao(erro, 'apelido');
    const { uid } = atual;
    await protegido(() => banco.atualizar(`usuarios/${uid}`, { apelido }));
    if (atual?.uid === uid) definir({ ...atual, apelido });
  }

  /** O admin padrão e o último admin não podem se excluir. Devolve { pode, motivo }. */
  async function podeExcluirConta() {
    if (!atual) return { pode: false, motivo: MSG_SEM_LOGIN };
    if (atual.usuario === USUARIO_ADMIN) {
      return { pode: false, motivo: 'A conta do administrador padrão não pode ser excluída.' };
    }
    if (ehAdmin(atual)) {
      const todos = (await protegido(() => banco.ler('usuarios'))) ?? {};
      const admins = Object.values(todos).filter((perfil) => perfil?.papel === 'admin').length;
      if (admins <= 1) {
        return { pode: false, motivo: 'Você é o único administrador. A plataforma precisa de pelo menos um.' };
      }
    }
    return { pode: true, motivo: '' };
  }

  /** Apaga o perfil, a credencial e o nome de usuário, e encerra a sessão. */
  async function excluirConta() {
    exigirLogin();
    const { pode, motivo } = await podeExcluirConta();
    if (!pode) throw new ErroSessao(motivo);
    const { uid, usuario } = atual;
    await protegido(async () => {
      await banco.apagar(`credenciais/${uid}`);
      await banco.apagar(`usuarios/${uid}`);
      await banco.apagar(`indiceUsuarios/${usuario}`);
    });
    esquecerUid();
    definir(null);
  }

  return {
    iniciar,
    restaurando,
    usuarioAtual,
    entrar,
    criarConta,
    sair,
    trocarSenha,
    trocarApelido,
    podeExcluirConta,
    excluirConta
  };
}

// Sessão única da página.
const sessao = criarSessao();

export const iniciar = sessao.iniciar;
export const restaurando = sessao.restaurando;
export const usuarioAtual = sessao.usuarioAtual;
export const entrar = sessao.entrar;
export const criarConta = sessao.criarConta;
export const sair = sessao.sair;
export const trocarSenha = sessao.trocarSenha;
export const trocarApelido = sessao.trocarApelido;
export const podeExcluirConta = sessao.podeExcluirConta;
export const excluirConta = sessao.excluirConta;
