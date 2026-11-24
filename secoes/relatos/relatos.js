// Relatos de quem já instalou (Ferramenta 3): entrada da seção e interface.
// Importa só desta pasta e de nucleo/. Sobreposições ficam DENTRO da seção.
import { validarApelido, podeComentar, ehAdmin } from '../../nucleo/sessao.js';
import * as R from './regras.js';
import * as D from './dados.js';

let raizAtual = null;
let contextoAtual = null;
const escutas = [];

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

function escutar(alvo, evento, fn) {
  alvo.addEventListener(evento, fn);
  escutas.push(() => alvo.removeEventListener(evento, fn));
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 5 estrelinhas, preenchidas até a nota (arredondada)
const estrelas = (n) => `<span class="re-estrelas" role="img" aria-label="Nota ${Math.round(n)} de 5">${[1, 2, 3, 4, 5].map((i) => `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1.5l1.9 4 4.4.5-3.3 3 .9 4.4L8 11.2l-3.9 2.2.9-4.4-3.3-3 4.4-.5z" fill="${i <= Math.round(n) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`).join('')}</span>`;
const fmt = (v, casas = 0) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

const ICONE = {
  curtir: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 7v6.5H2.5V7H5zm0 0l2.6-4.6c.3-.6 1-.8 1.6-.5.5.3.8.9.6 1.5L9.2 6h3.6c.8 0 1.4.8 1.2 1.6l-1.1 4.6c-.1.6-.7 1.1-1.3 1.1H5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  descurtir: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M11 9V2.5h2.5V9H11zm0 0l-2.6 4.6c-.3.6-1 .8-1.6.5-.5-.3-.8-.9-.6-1.5L6.8 10H3.2c-.8 0-1.4-.8-1.2-1.6l1.1-4.6c.1-.6.7-1.1 1.3-1.1H11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  denunciar: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 14V2.5M3.5 3h8l-1.6 3 1.6 3h-8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  apagar: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 9h5.8l.6-9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>'
};

export async function iniciarRelatos(raiz, contexto = {}) {
  destruir();
  await carregarCss('./relatos.css');
  raizAtual = raiz;
  contextoAtual = contexto;
  const banco = contexto.firebase ?? null;
  const usuario = () => contextoAtual?.usuario ?? null;
  const abrirLogin = () => contextoAtual?.abrirLogin?.('entrar');

  const E = {
    relatos: [], exemplos: [], carregando: true, erro: false,
    ordem: 'curtidos', categoria: R.categoriaDaAncora(location.hash) || 'todas', pagina: 1,
    votos: new Map(), ocupado: new Set(), aviso: ''
  };

  raiz.innerHTML = `
  <div class="re-raiz">
    <header class="re-cab">
      <div class="re-cab-texto">
        <h2 class="re-titulo" id="re-titulo">Quem já instalou conta como foi</h2>
        <p class="re-apoio">Coisas que só se descobre depois de usar.</p>
      </div>
      <div class="re-cab-acao">
        <div id="re-resumo" aria-live="polite"></div>
        <button type="button" class="re-principal" id="re-escrever">Contar a minha experiência</button>
      </div>
    </header>
    <p class="re-msg" id="re-msg" role="status" aria-live="polite"></p>
    <div class="re-filtros">
      <div class="re-chips" role="group" aria-label="Assunto dos relatos">
        ${[{ id: 'todas', nome: 'Todos os assuntos' }, ...R.CATEGORIAS].map((c) => `<button type="button" class="re-chip" data-cat="${c.id}" aria-pressed="false">${c.nome}</button>`).join('')}
      </div>
      <div class="re-ordem" role="group" aria-label="Ordenar relatos">
        ${R.ORDENS.map((o) => `<button type="button" class="re-seg" data-ordem="${o.id}" aria-pressed="false">${o.nome}</button>`).join('')}
      </div>
    </div>
    <div class="re-corpo">
      <div class="re-lista-area">
        <div class="re-grade" id="re-grade" aria-live="polite" aria-busy="true"></div>
        <nav class="re-paginas" id="re-paginas" aria-label="Páginas dos relatos"></nav>
      </div>
    </div>
    <p class="re-aviso">Relatos são experiências pessoais, sem verificação. Não garantem o mesmo resultado para você.</p>
    <div class="re-sobre" id="re-sobre" hidden><div class="re-dialogo" id="re-dialogo" role="dialog" aria-modal="true" aria-labelledby="re-d-titulo" tabindex="-1"></div></div>
  </div>`;

  const $ = (s) => raiz.querySelector(s);
  const $$ = (s) => [...raiz.querySelectorAll(s)];

  /* ---------------- Dados ---------------- */
  async function carregarExemplos() {
    try {
      const resposta = await fetch(new URL('./exemplos.json', import.meta.url));
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const dados = await resposta.json();
      E.exemplos = (dados.relatos || []).map((r) => ({ ...r, exemplo: true, status: 'publicado', curtidas: 0, pontos: 0, criadoEm: '' }));
    } catch (erro) {
      console.error('Exemplos dos relatos não carregaram.', erro);
      E.exemplos = [];
    }
  }
  async function carregar() {
    E.carregando = true; E.erro = false; render();
    try {
      E.relatos = banco ? await D.carregarRelatos(banco) : [];
    } catch (erro) {
      console.error('Não foi possível carregar os relatos.', erro);
      E.erro = true;
    }
    E.carregando = false;
    render();
  }

  /* ---------------- Lista ---------------- */
  function listaAtual() {
    const u = usuario();
    const base = R.visiveis(E.relatos, u?.uid).concat(E.exemplos);
    return R.ordenar(R.filtrar(base, E.categoria), E.ordem);
  }

  function renderResumo() {
    const s = R.resumir(E.relatos);
    const pct = (v) => `${fmt(v * 100)}%`;
    // resumo numa linha só, como num site de avaliações: nota, estrelas e quantos acharam que valeu
    $('#re-resumo').innerHTML = s.total
      ? `<div class="re-placar"><span class="re-placar-nota">${s.media == null ? '—' : fmt(s.media, 1)}</span>
          <span class="re-placar-info">${estrelas(s.media || 0)}<span>${s.total} ${s.total === 1 ? 'relato' : 'relatos'} · ${pct(s.sim)} acharam que valeu a pena</span></span></div>`
      : `<p class="re-placar-vazio">${E.carregando ? 'Carregando…' : 'Ainda sem relatos reais. Seja o primeiro.'}</p>`;
  }

  function cartaoRelato(r) {
    const u = usuario();
    const meu = u && r.autorUid && r.autorUid === u.uid;
    const voto = E.votos.get(r.id) ?? 0;
    const ocupado = E.ocupado.has(r.id);
    const nome = r.apelido || 'Usuário removido';
    // no cartão, só o que qualquer pessoa entende; a potência (kWp) fica no relato inteiro
    const meta = [R.tempoDeUso(r.mesesDeUso), r.uf ? esc(r.uf) : ''].filter(Boolean).join(' · ');
    let acoes;
    if (r.exemplo) acoes = '<span class="re-nota-exemplo">Exemplo ilustrativo, escrito pela equipe</span>';
    else if (meu) acoes = `<span class="re-nota-exemplo">${r.curtidas || 0} ${(r.curtidas || 0) === 1 ? 'curtida' : 'curtidas'}</span><button type="button" class="re-acao" data-apagar="${r.id}" ${ocupado ? 'disabled' : ''}>${ICONE.apagar}<span>Apagar</span></button>`;
    else acoes = `<button type="button" class="re-acao" data-votar="1" data-id="${r.id}" aria-pressed="${voto === 1}" aria-label="Curtir (${r.curtidas || 0} curtidas)" ${ocupado ? 'disabled' : ''}>${ICONE.curtir}<span>${r.curtidas || 0}</span></button>
      <button type="button" class="re-acao" data-votar="-1" data-id="${r.id}" aria-pressed="${voto === -1}" aria-label="Descurtir" ${ocupado ? 'disabled' : ''}>${ICONE.descurtir}</button>
      <button type="button" class="re-acao re-acao-fim" data-denunciar="${r.id}" aria-label="Denunciar" title="Denunciar" ${ocupado ? 'disabled' : ''}>${ICONE.denunciar}</button>`;
    return `<article class="re-item${r.exemplo ? ' re-item-exemplo' : ''}" data-relato="${esc(r.id)}" aria-labelledby="re-i-${esc(r.id)}">
      <div class="re-item-topo">${r.nota ? estrelas(r.nota) : '<span></span>'}<span class="re-tag re-valeu-${esc(r.valeu)}">${esc(R.VALEU[r.valeu] || '')}</span></div>
      <h3 class="re-item-titulo" id="re-i-${esc(r.id)}"><button type="button" class="re-abrir" data-ler="${esc(r.id)}">${esc(r.titulo)}</button></h3>
      <p class="re-item-texto">${esc(r.descoberta)}</p>
      ${meu && r.status === 'em_revisao' ? '<span class="re-tag re-tag-revisao">Seu relato está em revisão</span>' : ''}
      <div class="re-autor">
        <span class="re-avatar" aria-hidden="true">${esc(nome.trim().charAt(0).toUpperCase() || '?')}</span>
        <span class="re-autor-texto"><b>${esc(nome)}</b><span>${meta}</span></span>
        <span class="re-assunto">${esc(R.nomeCategoria(r.categoria))}</span>
      </div>
      <div class="re-item-acoes">${acoes}</div>
    </article>`;
  }

  function render() {
    renderResumo();
    $$('[data-ordem]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ordem === E.ordem)));
    $$('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === E.categoria)));
    const grade = $('#re-grade');
    grade.setAttribute('aria-busy', String(E.carregando));
    if (E.carregando && !E.relatos.length) {
      grade.innerHTML = '<div class="re-item re-esqueleto" aria-hidden="true"></div><div class="re-item re-esqueleto" aria-hidden="true"></div>';
      $('#re-paginas').innerHTML = '';
      return;
    }
    if (E.erro) {
      grade.innerHTML = '<div class="re-vazio" role="alert"><p>Sem conexão. Tente de novo.</p><button type="button" class="re-botao" data-recarregar>Tentar de novo</button></div>';
      $('#re-paginas').innerHTML = '';
      return;
    }
    const pag = R.paginar(listaAtual(), E.pagina);
    E.pagina = pag.pagina;
    grade.innerHTML = pag.itens.length ? pag.itens.map(cartaoRelato).join('') : '<div class="re-vazio"><p>Seja o primeiro a contar como foi.</p></div>';
    $('#re-paginas').innerHTML = pag.paginas > 1
      ? `<button type="button" class="re-pag" data-pag="${pag.pagina - 1}" ${pag.pagina === 1 ? 'disabled' : ''} aria-label="Página anterior">‹</button>${Array.from({ length: pag.paginas }, (_, i) => `<button type="button" class="re-pag" data-pag="${i + 1}" aria-current="${i + 1 === pag.pagina ? 'page' : 'false'}" aria-label="Página ${i + 1}">${i + 1}</button>`).join('')}<button type="button" class="re-pag" data-pag="${pag.pagina + 1}" ${pag.pagina === pag.paginas ? 'disabled' : ''} aria-label="Próxima página">›</button>`
      : '';
    carregarMeusVotos(pag.itens);
  }

  async function carregarMeusVotos(itens) {
    const u = usuario();
    if (!u || !banco) return;
    const faltam = itens.filter((r) => !r.exemplo && r.autorUid !== u.uid && !E.votos.has(r.id));
    if (!faltam.length) return;
    try {
      const lidos = await Promise.all(faltam.map((r) => D.meuVoto(banco, r.id, u.uid)));
      if (usuario()?.uid !== u.uid) return;
      faltam.forEach((r, i) => E.votos.set(r.id, lidos[i]));
      render();
    } catch (erro) { console.error('Não foi possível ler os votos.', erro); }
  }

  function mensagem(texto, erro = false) {
    const m = $('#re-msg');
    m.textContent = texto;
    m.classList.toggle('re-msg-erro', erro);
  }

  /* ---------------- Sobreposição dentro da seção ---------------- */
  let focoAntes = null;
  function abrirDialogo(html, aoAbrir) {
    if ($('#re-sobre').hidden) focoAntes = document.activeElement;
    $('#re-sobre').hidden = false;
    const d = $('#re-dialogo');
    d.className = 're-dialogo';
    d.innerHTML = html;
    d.querySelector('[data-fechar]')?.addEventListener('click', fecharDialogo);
    aoAbrir?.(d);
    (d.querySelector('[autofocus]') || d.querySelector('input, textarea, select, button') || d).focus();
  }
  function fecharDialogo() {
    // anima a saída (fundo some, janela desce) e só depois esconde
    const sobre = $('#re-sobre');
    if (sobre.hidden || sobre.classList.contains('ei-saindo')) return;
    sobre.classList.add('ei-saindo');
    setTimeout(() => {
      sobre.classList.remove('ei-saindo');
      sobre.hidden = true;
      $('#re-dialogo').innerHTML = '';
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
    if (focoAntes?.isConnected) focoAntes.focus({ preventScroll: true });
  }
  const cabDialogo = (titulo) => `<div class="re-d-cab"><h3 class="re-d-titulo" id="re-d-titulo">${titulo}</h3><button type="button" class="re-fechar" data-fechar aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button></div>`;

  raiz.querySelector('.re-raiz').addEventListener('keydown', (ev) => {
    if ($('#re-sobre').hidden) return;
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); fecharDialogo(); return; }
    if (ev.key !== 'Tab') return;
    const foc = [...$('#re-dialogo').querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled && el.getClientRects().length);
    if (!foc.length) return;
    const pri = foc[0], ult = foc[foc.length - 1];
    if (ev.shiftKey && (document.activeElement === pri || !$('#re-dialogo').contains(document.activeElement))) { ev.preventDefault(); ult.focus(); }
    else if (!ev.shiftKey && (document.activeElement === ult || !$('#re-dialogo').contains(document.activeElement))) { ev.preventDefault(); pri.focus(); }
  });
  $('#re-sobre').addEventListener('mousedown', (ev) => { if (ev.target === $('#re-sobre')) fecharDialogo(); });

  /* ---------------- Ler mais ---------------- */
  // Leitura do relato: coluna estreita, autor em cima, as duas partes bem separadas.
  function lerMais(r) {
    const nome = r.apelido || 'Usuário removido';
    const meta = [R.tempoDeUso(r.mesesDeUso), r.uf ? esc(r.uf) : '', r.kwp ? `sistema de ${fmt(r.kwp, r.kwp % 1 ? 1 : 0)} kWp` : ''].filter(Boolean).join(' · ');
    abrirDialogo(`
      <article class="re-ler" aria-labelledby="re-d-titulo">
        <button type="button" class="re-fechar re-ler-fechar" data-fechar aria-label="Fechar"><svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
        <header class="re-ler-cab">
          <div class="re-ler-selos">${r.nota ? estrelas(r.nota) : ''}<span class="re-tag re-valeu-${esc(r.valeu)}">${esc(R.VALEU[r.valeu] || '')}</span><span class="re-ler-assunto">${esc(R.nomeCategoria(r.categoria))}</span></div>
          <h3 class="re-ler-titulo" id="re-d-titulo">${esc(r.titulo)}</h3>
          <div class="re-autor re-ler-autor"><span class="re-avatar" aria-hidden="true">${esc(nome.trim().charAt(0).toUpperCase() || '?')}</span><span class="re-autor-texto"><b>${esc(nome)}</b><span>${meta}</span></span></div>
        </header>
        <div class="re-ler-corpo">
          <section class="re-ler-parte"><h4>O que só descobri depois</h4><p>${esc(r.descoberta)}</p></section>
          ${r.faria ? `<section class="re-ler-parte re-ler-parte--faria"><h4>O que faria diferente</h4><p>${esc(r.faria)}</p></section>` : ''}
        </div>
        <footer class="re-ler-rodape">${r.exemplo ? 'Exemplo ilustrativo, escrito pela equipe. ' : ''}Relatos são experiências pessoais, sem verificação. Não garantem o mesmo resultado para você.</footer>
      </article>`);
    $('#re-dialogo').classList.add('re-dialogo--leitura');
  }

  /* ---------------- Escrever ---------------- */
  async function podeEscrever() {
    const u = usuario();
    if (!u) { abrirLogin(); return false; }
    if (!banco) { mensagem('Não foi possível conectar ao banco agora.', true); return false; }
    try {
      const perfil = await D.perfilAtual(banco, u.uid);
      if (!perfil || perfil.bloqueado === true || !podeComentar({ ...u, ...perfil })) {
        mensagem('Você não pode mais escrever relatos.', true);
        return false;
      }
    } catch {
      mensagem('Sem conexão. Tente de novo.', true);
      return false;
    }
    return true;
  }

  const campoTexto = (nome, rotulo, o = {}) => `<label class="re-campo${o.largo ? ' re-campo-largo' : ''}"><span class="re-rotulo">${rotulo}${o.opcional ? ' <span class="re-opcional">(opcional)</span>' : ''}</span>
    ${o.area ? `<textarea name="${nome}" maxlength="${o.max}" rows="${o.linhas || 3}">${esc(o.valor || '')}</textarea>` : `<input name="${nome}" ${o.max ? `maxlength="${o.max}"` : ''} ${o.modo ? `inputmode="${o.modo}"` : ''} value="${esc(o.valor || '')}" ${o.ph ? `placeholder="${o.ph}"` : ''}>`}
    ${o.max && o.area ? `<span class="re-contador" data-contador="${nome}">${(o.valor || '').length}/${o.max}</span>` : ''}<span class="re-erro" data-erro="${nome}"></span></label>`;

  async function abrirFormulario(rascunho = null) {
    if (!(await podeEscrever())) return;
    const u = usuario();
    const v = rascunho || { apelido: u.apelido || u.usuario, nota: '' };
    abrirDialogo(`${cabDialogo('Escrever o meu relato')}
      <form class="re-form" novalidate>
        <div class="re-form-grade">
          ${campoTexto('titulo', 'Título', { max: R.LIMITES.titulo, valor: v.titulo, largo: true, ph: 'Ex.: A conta não zera, e tudo bem' })}
          ${campoTexto('descoberta', 'O que eu só descobri depois', { area: true, max: R.LIMITES.descoberta, valor: v.descoberta, largo: true, linhas: 4 })}
          ${campoTexto('faria', 'O que faria diferente', { area: true, max: R.LIMITES.faria, valor: v.faria, largo: true, opcional: true, linhas: 2 })}
          <label class="re-campo"><span class="re-rotulo">Categoria</span><select name="categoria"><option value="">Escolha</option>${R.CATEGORIAS.map((c) => `<option value="${c.id}" ${v.categoria === c.id ? 'selected' : ''}>${c.nome}</option>`).join('')}</select><span class="re-erro" data-erro="categoria"></span></label>
          <fieldset class="re-campo re-grupo"><legend class="re-rotulo">Valeu a pena?</legend><div class="re-opcoes">${Object.entries(R.VALEU).map(([k, n]) => `<label class="re-opcao"><input type="radio" name="valeu" value="${k}" ${v.valeu === k ? 'checked' : ''}>${k === 'sim' ? 'Sim' : k === 'parte' ? 'Em parte' : 'Não'}</label>`).join('')}</div><span class="re-erro" data-erro="valeu"></span></fieldset>
          <fieldset class="re-campo re-grupo"><legend class="re-rotulo">Nota</legend><div class="re-opcoes">${[1, 2, 3, 4, 5].map((n) => `<label class="re-opcao"><input type="radio" name="nota" value="${n}" ${String(v.nota) === String(n) ? 'checked' : ''}>${n}</label>`).join('')}</div><span class="re-erro" data-erro="nota"></span></fieldset>
          ${campoTexto('mesesDeUso', 'Tempo de uso (meses)', { modo: 'numeric', valor: v.mesesDeUso, ph: '0 a 240' })}
          ${campoTexto('kwp', 'Tamanho do sistema (kWp)', { modo: 'decimal', valor: v.kwp, opcional: true, ph: '0,5 a 100' })}
          ${campoTexto('apelido', 'Apelido', { max: R.LIMITES.apelido, valor: v.apelido })}
          <label class="re-campo"><span class="re-rotulo">Estado <span class="re-opcional">(opcional)</span></span><select name="uf"><option value="">Não informar</option>${R.UFS.map((uf) => `<option ${v.uf === uf ? 'selected' : ''}>${uf}</option>`).join('')}</select><span class="re-erro" data-erro="uf"></span></label>
        </div>
        <p class="re-dica">Use um apelido: não escreva o seu nome real, e-mail, cidade ou endereço.</p>
        <label class="re-aceite"><input type="checkbox" name="aceite" ${v.aceite ? 'checked' : ''}> É uma experiência real minha e não incluí dados pessoais meus nem de outras pessoas.</label>
        <span class="re-erro" data-erro="aceite"></span>
        <div class="re-d-botoes"><button type="button" class="re-botao" data-fechar-form>Cancelar</button><button type="submit" class="re-principal re-principal-auto">Ver prévia</button></div>
      </form>`, (d) => {
      const form = d.querySelector('form');
      d.querySelector('[data-fechar-form]').onclick = fecharDialogo;
      form.querySelectorAll('textarea').forEach((t) => t.addEventListener('input', () => { const c = form.querySelector(`[data-contador="${t.name}"]`); if (c) c.textContent = `${t.value.length}/${t.maxLength}`; }));
      form.onsubmit = (ev) => {
        ev.preventDefault();
        const campos = Object.fromEntries(new FormData(form));
        campos.aceite = form.aceite.checked;
        const { erros, relato } = R.validarRelato(campos);
        const erroApelido = !erros.apelido && validarApelido(relato.apelido, { admin: ehAdmin(usuario()) });
        if (erroApelido) erros.apelido = erroApelido;
        form.querySelectorAll('[data-erro]').forEach((el) => { el.textContent = erros[el.dataset.erro] || ''; });
        const primeiro = Object.keys(erros)[0];
        if (primeiro) { form.querySelector(`[name="${primeiro}"]`)?.focus(); return; }
        mostrarPrevia(relato, { ...campos });
      };
    });
  }

  function mostrarPrevia(relato, rascunho) {
    abrirDialogo(`${cabDialogo('Prévia do seu relato')}
      <div class="re-d-corpo">
        <p class="re-dica">É assim que o relato vai aparecer na lista.</p>
        <div class="re-previa">${cartaoRelato({ ...relato, id: 'previa', autorUid: null, curtidas: 0, exemplo: false }).replace(/<div class="re-item-acoes">[\s\S]*?<\/div>\s*<\/article>/, '</article>')}</div>
        ${relato.faria ? `<h4 class="re-d-sub">O que faria diferente</h4><p class="re-d-texto">${esc(relato.faria)}</p>` : ''}
        <p class="re-msg" id="re-envio" role="status" aria-live="polite"></p>
        <div class="re-d-botoes"><button type="button" class="re-botao" data-editar>Editar</button><button type="button" class="re-principal re-principal-auto" data-publicar autofocus>Publicar</button></div>
      </div>`, (d) => {
      d.querySelector('[data-editar]').onclick = () => abrirFormulario(rascunho);
      const botao = d.querySelector('[data-publicar]');
      botao.onclick = async () => {
        if (!(await podeEscrever())) return fecharDialogo();
        botao.disabled = true;
        d.querySelector('#re-envio').textContent = 'Publicando…';
        try {
          const novo = await D.publicar(banco, usuario(), relato);
          E.relatos.push(novo);
          E.ordem = 'recentes'; E.categoria = 'todas'; E.pagina = 1;
          fecharDialogo();
          render();
          mensagem('Obrigado! Seu relato já está na lista.');
        } catch (erro) {
          console.error('Não foi possível publicar o relato.', erro);
          botao.disabled = false;
          d.querySelector('#re-envio').textContent = 'Não foi possível publicar agora. Tente de novo.';
        }
      };
    });
  }

  /* ---------------- Votar, denunciar, apagar ---------------- */
  async function votar(id, clicado) {
    const u = usuario();
    if (!u) return abrirLogin();
    const r = E.relatos.find((x) => x.id === id);
    if (!r || r.autorUid === u.uid) return;
    const novo = R.proximoVoto(E.votos.get(id) ?? 0, clicado);
    E.ocupado.add(id); render();
    try {
      const contagem = await D.votar(banco, id, u.uid, novo);
      if (contagem) Object.assign(r, contagem);
      E.votos.set(id, novo);
    } catch (erro) {
      console.error('Não foi possível registrar o voto.', erro);
      mensagem('Não foi possível registrar o voto. Tente de novo.', true);
    }
    E.ocupado.delete(id); render();
    raiz.querySelector(`[data-id="${CSS.escape(id)}"][data-votar="${clicado}"]`)?.focus();
  }

  async function abrirDenuncia(id) {
    const u = usuario();
    if (!u) return abrirLogin();
    const r = E.relatos.find((x) => x.id === id);
    if (!r || r.autorUid === u.uid) return;
    try {
      if (await D.jaDenunciou(banco, id, u.uid)) return mensagem('Você já denunciou este relato. Obrigado, vamos analisar.');
    } catch { return mensagem('Sem conexão. Tente de novo.', true); }
    const admin = ehAdmin(u);
    abrirDialogo(`${cabDialogo('Denunciar relato')}
      <form class="re-d-corpo re-denuncia">
        <p class="re-d-texto">Por que este relato não deveria estar aqui?</p>
        <fieldset class="re-grupo"><legend class="re-sr">Motivo</legend>${R.MOTIVOS.map((m, i) => `<label class="re-opcao re-opcao-linha"><input type="radio" name="motivo" value="${m.id}" ${i === 0 ? 'checked' : ''}>${m.nome}</label>`).join('')}</fieldset>
        <p class="re-dica">${admin ? 'Como administrador, a sua denúncia tira o relato da lista na hora. Depois decida no painel.' : `Com ${R.LIMITE_DENUNCIAS} denúncias de pessoas diferentes, o relato sai da lista até ser revisado.`}</p>
        <p class="re-msg" id="re-den-msg" role="status" aria-live="polite"></p>
        <div class="re-d-botoes"><button type="button" class="re-botao" data-cancelar>Cancelar</button><button type="submit" class="re-principal re-principal-auto">Enviar denúncia</button></div>
      </form>`, (d) => {
      d.querySelector('[data-cancelar]').onclick = fecharDialogo;
      const form = d.querySelector('form');
      form.onsubmit = async (ev) => {
        ev.preventDefault();
        const botao = form.querySelector('[type="submit"]');
        botao.disabled = true;
        try {
          const resp = await D.denunciar(banco, id, u.uid, form.motivo.value, admin);
          if (resp.status) { r.status = resp.status; r.denuncias = resp.denuncias; }
          fecharDialogo();
          render();
          mensagem(resp.repetida ? 'Você já denunciou este relato.' : 'Obrigado, vamos analisar.');
        } catch (erro) {
          console.error('Não foi possível registrar a denúncia.', erro);
          botao.disabled = false;
          d.querySelector('#re-den-msg').textContent = 'Não foi possível enviar agora. Tente de novo.';
        }
      };
    });
  }

  function confirmarApagar(id) {
    abrirDialogo(`${cabDialogo('Apagar o seu relato?')}
      <div class="re-d-corpo"><p class="re-d-texto">O relato, as curtidas e as denúncias dele serão apagados. Não dá para desfazer.</p>
      <p class="re-msg" id="re-apagar-msg" role="status"></p>
      <div class="re-d-botoes"><button type="button" class="re-botao" data-cancelar autofocus>Cancelar</button><button type="button" class="re-botao re-botao-perigo" data-confirmar>Apagar relato</button></div></div>`, (d) => {
      d.querySelector('[data-cancelar]').onclick = fecharDialogo;
      d.querySelector('[data-confirmar]').onclick = async (ev) => {
        ev.target.disabled = true;
        try {
          await D.apagarRelato(banco, id);
          E.relatos = E.relatos.filter((r) => r.id !== id);
          fecharDialogo(); render();
          mensagem('Relato apagado.');
        } catch {
          ev.target.disabled = false;
          d.querySelector('#re-apagar-msg').textContent = 'Não foi possível apagar agora. Tente de novo.';
        }
      };
    });
  }

  /* ---------------- Ligações ---------------- */
  raiz.addEventListener('click', (ev) => {
    let alvo = ev.target.closest('button');
    // clicar em qualquer parte do cartão abre o relato inteiro (o título é o botão para teclado)
    if (!alvo) alvo = ev.target.closest('.re-item[data-relato]')?.querySelector('[data-ler]');
    if (!alvo || !raiz.contains(alvo)) return;
    if (alvo.dataset.ordem) { E.ordem = alvo.dataset.ordem; E.pagina = 1; render(); }
    else if (alvo.dataset.cat) { E.categoria = alvo.dataset.cat; E.pagina = 1; render(); }
    else if (alvo.dataset.pag) { E.pagina = Number(alvo.dataset.pag); render(); $('#re-grade').querySelector('.re-item-titulo')?.focus?.(); }
    else if (alvo.dataset.ler) { const r = listaAtual().find((x) => x.id === alvo.dataset.ler); if (r) lerMais(r); }
    else if (alvo.dataset.votar) votar(alvo.dataset.id, Number(alvo.dataset.votar));
    else if (alvo.dataset.denunciar) abrirDenuncia(alvo.dataset.denunciar);
    else if (alvo.dataset.apagar) confirmarApagar(alvo.dataset.apagar);
    else if (alvo.hasAttribute('data-recarregar')) carregar();
  });
  $('#re-escrever').addEventListener('click', () => { mensagem(''); abrirFormulario(); });

  escutar(document, 'ei:login-mudou', () => queueMicrotask(() => {
    E.votos.clear(); mensagem('');
    if (!$('#re-sobre').hidden && !usuario()) fecharDialogo();
    render();
  }));
  escutar(window, 'hashchange', () => {
    const c = R.categoriaDaAncora(location.hash);
    if (c) { E.categoria = c; E.pagina = 1; render(); }
  });
  // Exclusão da conta: apagar ou manter os relatos como "Usuário removido".
  escutar(document, 'ei:conta-excluindo', (evento) => {
    const { uid, relatos, tarefas } = evento.detail || {};
    if (!banco || !uid || !Array.isArray(tarefas)) return;
    tarefas.push(D.tratarExclusaoDaConta(banco, uid, relatos === 'apagar' ? 'apagar' : 'manter').then(() => carregar()));
  });

  await carregarExemplos();
  carregar();
}

export function destruir() {
  while (escutas.length) escutas.pop()();
  raizAtual?.replaceChildren();
  raizAtual = null;
  contextoAtual = null;
}
