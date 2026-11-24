// Telas da conta: Entrar, Criar conta, Minha conta e Excluir conta.
// Cada função devolve o conteúdo de uma sobreposição. Quem abre e fecha é conta.js.
import { formatarData } from '../../nucleo/formato.js';
import { el, campo, botao, avisoSenha, mensagem, linksPoliticas, ocupar } from './pecas.js';
import { confirmacaoConfere, apelidoOuUsuario, conferirConfirmacao } from './regras.js';

function linhaDeTroca(pergunta, textoDoBotao, aoClicar) {
  const linha = el('p', 'co-troca', `${pergunta} `);
  const troca = el('button', 'co-link co-link--botao', textoDoBotao);
  troca.type = 'button';
  troca.addEventListener('click', aoClicar);
  linha.append(troca);
  return linha;
}

// ---------- Entrar ----------
export function telaEntrar({ aoEntrar, aoIrParaCriar }) {
  const form = el('form', 'co-form');
  form.noValidate = true;
  const usuario = campo({ id: 'co-entrar-usuario', rotulo: 'Usuário', autocomplete: 'username', maximo: 20 });
  const senha = campo({ id: 'co-entrar-senha', rotulo: 'Senha', tipo: 'password', autocomplete: 'current-password', maximo: 128 });
  const nota = el('p', 'co-nota', 'Este é um projeto escolar: não use as suas senhas de verdade.');
  const aviso = mensagem();
  const enviar = botao('Entrar', { tipo: 'submit', variante: 'principal' });

  form.append(
    usuario.caixa, senha.caixa, nota, aviso.area, enviar,
    linhaDeTroca('Ainda não tem conta?', 'Criar conta', aoIrParaCriar),
    linksPoliticas()
  );

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    aviso.limpar();
    const liberar = ocupar(enviar, 'Entrando…');
    try {
      await aoEntrar(usuario.entrada.value, senha.entrada.value);
    } catch (erro) {
      aviso.mostrar(erro.message);
      liberar();
      senha.entrada.focus();
      senha.entrada.select();
    }
  });
  return form;
}

// ---------- Criar conta ----------
export function telaCriar({ aoCriar, aoIrParaEntrar }) {
  const form = el('form', 'co-form');
  form.noValidate = true;
  const usuario = campo({
    id: 'co-criar-usuario', rotulo: 'Usuário', autocomplete: 'username', maximo: 20,
    dica: '3 a 20 caracteres: letras minúsculas, números e _.'
  });
  const apelido = campo({
    id: 'co-criar-apelido', rotulo: 'Apelido', autocomplete: 'nickname', maximo: 24,
    dica: 'É o nome que aparece para os outros. Em branco, usamos o seu usuário.'
  });
  const senha = campo({
    id: 'co-criar-senha', rotulo: 'Senha', tipo: 'password', autocomplete: 'new-password', maximo: 128,
    dica: 'Pelo menos 4 caracteres.'
  });
  const confirmar = campo({ id: 'co-criar-confirmar', rotulo: 'Confirmar senha', tipo: 'password', autocomplete: 'new-password', maximo: 128 });

  // Aceite obrigatório. Os links abrem as políticas por cima, sem perder o que foi digitado.
  const aceite = el('div', 'co-aceite');
  const caixa = el('input', 'co-aceite__caixa');
  caixa.type = 'checkbox';
  caixa.id = 'co-criar-aceite';
  const rotulo = el('label', 'co-aceite__texto', 'Li e concordo com os ');
  rotulo.htmlFor = caixa.id;
  const termos = el('a', 'co-link', 'Termos de uso');
  termos.href = '#politicas/termos';
  const privacidade = el('a', 'co-link', 'Política de privacidade');
  privacidade.href = '#politicas/privacidade';
  rotulo.append(termos, ' e a ', privacidade);
  aceite.append(caixa, rotulo);

  const aviso = mensagem();
  const enviar = botao('Criar conta', { tipo: 'submit', variante: 'principal' });
  const campos = { usuario: usuario.entrada, apelido: apelido.entrada, senha: senha.entrada, confirmar: confirmar.entrada, aceite: caixa };

  form.append(
    usuario.caixa, apelido.caixa, senha.caixa, avisoSenha(), confirmar.caixa, aceite, aviso.area, enviar,
    linhaDeTroca('Já tem conta?', 'Entrar', aoIrParaEntrar),
    linksPoliticas()
  );

  usuario.entrada.addEventListener('input', () => {
    usuario.entrada.value = usuario.entrada.value.toLowerCase();
  });

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    aviso.limpar();
    Object.values(campos).forEach((entrada) => entrada.removeAttribute('aria-invalid'));
    const nome = usuario.entrada.value.trim().toLowerCase();
    const liberar = ocupar(enviar, 'Criando…');
    try {
      await aoCriar({
        usuario: nome,
        apelido: apelidoOuUsuario(apelido.entrada.value, nome),
        senha: senha.entrada.value,
        confirmar: confirmar.entrada.value,
        aceite: caixa.checked
      });
    } catch (erro) {
      aviso.mostrar(erro.message);
      liberar();
      const culpado = campos[erro.campo];
      if (culpado) {
        culpado.setAttribute('aria-invalid', 'true');
        culpado.focus();
      }
    }
  });
  return form;
}

// ---------- Minha conta ----------
export function telaMinhaConta({ usuario, aoTrocarApelido, aoTrocarSenha, aoExcluirSimulacoes, aoPedirExclusao, conferirExclusao }) {
  const raiz = el('div', 'co-conta');

  const faixa = el('p', 'co-faixa', 'Você ainda usa a senha padrão. Troque agora.');
  faixa.setAttribute('role', 'status');

  const dados = el('dl', 'co-dados');
  const valorUsuario = el('dd', 'co-dados__valor');
  const valorApelido = el('dd', 'co-dados__valor');
  const valorCriada = el('dd', 'co-dados__valor');
  dados.append(
    el('dt', 'co-dados__nome', 'Usuário'), valorUsuario,
    el('dt', 'co-dados__nome', 'Apelido'), valorApelido,
    el('dt', 'co-dados__nome', 'Conta criada em'), valorCriada
  );

  // Trocar apelido
  const blocoApelido = el('form', 'co-bloco');
  blocoApelido.noValidate = true;
  const novoApelido = campo({ id: 'co-conta-apelido', rotulo: 'Novo apelido', autocomplete: 'nickname', maximo: 24, valor: usuario.apelido });
  const avisoApelido = mensagem();
  const salvarApelido = botao('Salvar apelido', { tipo: 'submit' });
  blocoApelido.append(el('h3', 'co-bloco__titulo', 'Trocar apelido'), novoApelido.caixa, avisoApelido.area, salvarApelido);
  blocoApelido.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    avisoApelido.limpar();
    const liberar = ocupar(salvarApelido, 'Salvando…');
    try {
      await aoTrocarApelido(novoApelido.entrada.value);
      avisoApelido.mostrar('Apelido alterado.', 'ok');
    } catch (erro) {
      avisoApelido.mostrar(erro.message);
      novoApelido.entrada.focus();
    }
    liberar();
  });

  // Trocar senha
  const blocoSenha = el('form', 'co-bloco');
  blocoSenha.noValidate = true;
  const senhaAtual = campo({ id: 'co-conta-senha-atual', rotulo: 'Senha atual', tipo: 'password', autocomplete: 'current-password', maximo: 128 });
  const senhaNova = campo({ id: 'co-conta-senha-nova', rotulo: 'Nova senha', tipo: 'password', autocomplete: 'new-password', maximo: 128, dica: 'Pelo menos 4 caracteres.' });
  const senhaConfirmar = campo({ id: 'co-conta-senha-confirmar', rotulo: 'Confirmar nova senha', tipo: 'password', autocomplete: 'new-password', maximo: 128 });
  const avisoDaSenha = mensagem();
  const salvarSenha = botao('Trocar senha', { tipo: 'submit' });
  const camposSenha = { atual: senhaAtual.entrada, nova: senhaNova.entrada, confirmar: senhaConfirmar.entrada };
  blocoSenha.append(
    el('h3', 'co-bloco__titulo', 'Trocar senha'),
    senhaAtual.caixa, senhaNova.caixa, avisoSenha(), senhaConfirmar.caixa, avisoDaSenha.area, salvarSenha
  );
  blocoSenha.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    avisoDaSenha.limpar();
    const erroConfirmacao = conferirConfirmacao(senhaNova.entrada.value, senhaConfirmar.entrada.value);
    if (erroConfirmacao) {
      avisoDaSenha.mostrar(erroConfirmacao);
      senhaConfirmar.entrada.focus();
      return;
    }
    const liberar = ocupar(salvarSenha, 'Trocando…');
    try {
      await aoTrocarSenha(senhaAtual.entrada.value, senhaNova.entrada.value);
      blocoSenha.reset();
      avisoDaSenha.mostrar('Senha alterada.', 'ok');
    } catch (erro) {
      avisoDaSenha.mostrar(erro.message);
      (camposSenha[erro.campo] ?? senhaAtual.entrada).focus();
    }
    liberar();
  });

  // Seus dados: excluir simulações e excluir a conta. Estes dois botões não podem sair daqui.
  const blocoDados = el('div', 'co-bloco');
  blocoDados.append(el('h3', 'co-bloco__titulo', 'Seus dados'));

  const acaoSimulacoes = el('div', 'co-acao');
  const notaSimulacoes = el('p', 'co-nota', 'Apaga o seu histórico de simulações. A conta continua.');
  const excluirSimulacoes = botao('Excluir simulações');
  const confirmarSimulacoes = botao('Sim, excluir', { variante: 'perigo' });
  const cancelarSimulacoes = botao('Cancelar');
  const avisoSimulacoes = mensagem();
  const linhaConfirmar = el('div', 'co-acao__botoes');
  linhaConfirmar.append(confirmarSimulacoes, cancelarSimulacoes);
  linhaConfirmar.hidden = true;
  acaoSimulacoes.append(excluirSimulacoes, linhaConfirmar, notaSimulacoes, avisoSimulacoes.area);
  const mostrarConfirmacao = (sim) => {
    linhaConfirmar.hidden = !sim;
    excluirSimulacoes.hidden = sim;
    notaSimulacoes.textContent = sim
      ? 'Excluir todas as suas simulações? Não dá para desfazer.'
      : 'Apaga o seu histórico de simulações. A conta continua.';
  };
  excluirSimulacoes.addEventListener('click', () => {
    avisoSimulacoes.limpar();
    mostrarConfirmacao(true);
    confirmarSimulacoes.focus();
  });
  cancelarSimulacoes.addEventListener('click', () => {
    mostrarConfirmacao(false);
    excluirSimulacoes.focus();
  });
  confirmarSimulacoes.addEventListener('click', async () => {
    const liberar = ocupar(confirmarSimulacoes, 'Excluindo…');
    try {
      await aoExcluirSimulacoes();
      avisoSimulacoes.mostrar('Pronto', 'ok');
    } catch {
      avisoSimulacoes.mostrar('Não foi possível excluir agora. Tente de novo.');
    }
    liberar();
    mostrarConfirmacao(false);
    excluirSimulacoes.focus();
  });

  const acaoConta = el('div', 'co-acao');
  const excluirConta = botao('Excluir minha conta e meus dados', { variante: 'perigo' });
  const notaConta = el('p', 'co-nota', 'Apaga o seu login, o seu perfil e o seu histórico. Não dá para desfazer.');
  notaConta.id = 'co-conta-excluir-nota';
  excluirConta.setAttribute('aria-describedby', notaConta.id);
  excluirConta.disabled = true;
  excluirConta.addEventListener('click', () => aoPedirExclusao(excluirConta));
  acaoConta.append(excluirConta, notaConta);

  blocoDados.append(acaoSimulacoes, acaoConta);
  raiz.append(faixa, dados, blocoApelido, blocoSenha, blocoDados);

  // O admin padrão e o último admin não podem se excluir: botão desativado, com a explicação.
  conferirExclusao().then(({ pode, motivo }) => {
    excluirConta.disabled = !pode;
    if (!pode) notaConta.textContent = motivo;
  }).catch(() => {
    notaConta.textContent = 'Não foi possível conferir agora se a conta pode ser excluída. Feche e abra de novo.';
  });

  function atualizar(perfil) {
    faixa.hidden = !perfil.senhaPadrao;
    valorUsuario.textContent = perfil.usuario;
    valorApelido.textContent = perfil.apelido;
    valorCriada.textContent = formatarData(perfil.criadoEm);
  }
  atualizar(usuario);

  return { raiz, atualizar };
}

// ---------- Excluir minha conta (segunda sobreposição) ----------
export function telaExcluir({ usuario, aoConfirmar, aoCancelar }) {
  const form = el('form', 'co-form');
  form.noValidate = true;

  const texto = el('p', 'co-texto', 'Isto apaga o seu login, o seu perfil e o seu histórico de simulações. Não dá para desfazer.');

  const grupo = el('fieldset', 'co-grupo');
  grupo.append(el('legend', 'co-grupo__titulo', 'Se você escreveu relatos:'));
  const opcoes = [
    ['apagar', 'apagar'],
    ['manter', 'manter como “Usuário removido”']
  ];
  const radios = opcoes.map(([valor, rotulo], posicao) => {
    const linha = el('label', 'co-opcao');
    const radio = el('input', 'co-opcao__radio');
    radio.type = 'radio';
    radio.name = 'co-excluir-relatos';
    radio.value = valor;
    radio.checked = posicao === 0;
    linha.append(radio, el('span', 'co-opcao__texto', rotulo));
    grupo.append(linha);
    return radio;
  });

  const confirmacao = campo({
    id: 'co-excluir-usuario',
    rotulo: `Digite o seu usuário (${usuario.usuario}) para confirmar`,
    maximo: 20
  });
  const aviso = mensagem();
  const botoes = el('div', 'co-botoes');
  const cancelar = botao('Cancelar');
  const excluir = botao('Excluir minha conta', { tipo: 'submit', variante: 'perigo' });
  excluir.disabled = true;
  botoes.append(cancelar, excluir);
  form.append(texto, grupo, confirmacao.caixa, aviso.area, botoes);

  confirmacao.entrada.addEventListener('input', () => {
    excluir.disabled = !confirmacaoConfere(confirmacao.entrada.value, usuario.usuario);
  });
  cancelar.addEventListener('click', aoCancelar);
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (!confirmacaoConfere(confirmacao.entrada.value, usuario.usuario)) return;
    aviso.limpar();
    const liberar = ocupar(excluir, 'Excluindo…');
    cancelar.disabled = true;
    try {
      await aoConfirmar(radios.find((radio) => radio.checked)?.value ?? 'apagar');
    } catch (erro) {
      aviso.mostrar(erro.message);
      liberar();
      cancelar.disabled = false;
    }
  });
  return form;
}

// ---------- Confirmação simples ("Conta excluída") ----------
export function telaConfirmacao({ texto, aoFechar }) {
  const raiz = el('div', 'co-form');
  const ok = botao('Fechar', { variante: 'principal' });
  ok.addEventListener('click', aoFechar);
  raiz.append(el('p', 'co-texto', texto), ok);
  return raiz;
}
