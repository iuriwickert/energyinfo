// Peças de formulário usadas pelas telas da conta.

export const AVISO_SENHA = 'Não use as suas senhas de verdade (e-mail, redes sociais, banco). Este é um projeto escolar e o banco de dados não é protegido. Crie uma senha que você só usa aqui.';

export function el(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

/** Campo com rótulo acima e dica opcional abaixo. */
export function campo({ id, rotulo, tipo = 'text', autocomplete = 'off', dica = '', valor = '', maximo }) {
  const caixa = el('div', 'co-campo');
  const etiqueta = el('label', 'co-rotulo', rotulo);
  etiqueta.htmlFor = id;
  const entrada = el('input', 'co-entrada');
  entrada.id = id;
  entrada.type = tipo;
  entrada.autocomplete = autocomplete;
  entrada.value = valor;
  entrada.spellcheck = false;
  entrada.setAttribute('autocapitalize', 'none');
  if (maximo) entrada.maxLength = maximo;
  caixa.append(etiqueta, entrada);
  if (dica) {
    const linha = el('p', 'co-dica', dica);
    linha.id = `${id}-dica`;
    entrada.setAttribute('aria-describedby', linha.id);
    caixa.append(linha);
  }
  return { caixa, entrada };
}

export function botao(texto, { tipo = 'button', variante = '' } = {}) {
  const elemento = el('button', `co-botao${variante ? ` co-botao--${variante}` : ''}`, texto);
  elemento.type = tipo;
  return elemento;
}

/** Caixa discreta com o aviso de senha (cadastro e trocar senha). Não remover. */
export function avisoSenha() {
  return el('p', 'co-aviso', AVISO_SENHA);
}

/** Área de mensagem com aria-live: os erros aparecem na própria sobreposição. */
export function mensagem() {
  const area = el('p', 'co-mensagem');
  area.setAttribute('role', 'status');
  area.setAttribute('aria-live', 'polite');
  return {
    area,
    mostrar(texto, tipo = 'erro') {
      area.textContent = texto;
      area.className = `co-mensagem co-mensagem--${tipo}`;
    },
    limpar() {
      area.textContent = '';
      area.className = 'co-mensagem';
    }
  };
}

/** Links pequenos para os três documentos. Abrem por âncora, por cima da janela atual. */
export function linksPoliticas() {
  const linha = el('p', 'co-politicas');
  const itens = [
    ['#politicas/termos', 'Termos de uso'],
    ['#politicas/privacidade', 'Privacidade'],
    ['#politicas/aviso', 'Aviso legal']
  ];
  itens.forEach(([href, texto], posicao) => {
    if (posicao > 0) linha.append(' · ');
    const link = el('a', 'co-link', texto);
    link.href = href;
    linha.append(link);
  });
  return linha;
}

/** Desativa o botão e troca o texto enquanto uma ação está em andamento. */
export function ocupar(botaoEl, textoOcupado) {
  const textoNormal = botaoEl.textContent;
  botaoEl.disabled = true;
  botaoEl.textContent = textoOcupado;
  return () => {
    botaoEl.disabled = false;
    botaoEl.textContent = textoNormal;
  };
}
