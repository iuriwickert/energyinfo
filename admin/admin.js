// Painel administrativo (página separada). Só para papel = "admin".
// Abas: Relatos em revisão, Todos os relatos e Usuários. Cada mudança pede confirmação.
import { iniciar, ehAdmin } from '../nucleo/sessao.js';
import { abrirSobreposicao } from '../nucleo/sobreposicao.js';
import { formatarData, formatarDataHora } from '../nucleo/formato.js';
import * as A from './acoes.js';

const raiz = document.getElementById('ad-painel');

const CATEGORIAS = { instalacao: 'Instalação', conta: 'Conta de luz', manutencao: 'Manutenção', burocracia: 'Burocracia e concessionária', desempenho: 'Desempenho', dinheiro: 'Dinheiro', outros: 'Outros' };
const VALEU = { sim: 'Valeu a pena', parte: 'Em parte', nao: 'Não valeu' };
const MOTIVOS = { spam: 'Spam ou propaganda', ofensivo: 'Conteúdo ofensivo', falso: 'Informação falsa', dados: 'Dados pessoais', outro: 'Outro motivo' };
const STATUS = { publicado: 'Publicado', em_revisao: 'Em revisão', removido: 'Removido' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sem = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function semAcesso(titulo, texto) {
  raiz.innerHTML = `<div class="ad-vazio-pagina"><h1 class="ad-titulo">${esc(titulo)}</h1><p class="ad-texto">${esc(texto)}</p><a class="ad-link" href="../index.html">Voltar ao site</a></div>`;
}

const eu = await iniciar();
if (!ehAdmin(eu)) {
  semAcesso('Você não tem acesso', 'Esta página é só para administradores.');
} else {
  montarPainel();
}

function montarPainel() {
  const E = {
    dados: { usuarios: [], relatos: [] }, carregando: true, erro: false,
    aba: 'revisao', busca: '', status: 'todos', autor: null, buscaUsuario: '',
    motivos: new Map(), aviso: ''
  };

  raiz.innerHTML = `
    <header class="ad-topo">
      <div class="ad-topo-interno">
        <a class="ad-marca" href="../index.html"><svg width="22" height="22" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="5.2" fill="#f59e0b"/><path d="M13 2.2v3.2M13 20.6v3.2M2.2 13h3.2M20.6 13h3.2M5.36 5.36l2.27 2.27M18.37 18.37l2.27 2.27M5.36 20.64l2.27-2.27M18.37 7.63l2.27-2.27" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/></svg><span>Energy <span class="ad-marca-b">Information</span></span></a>
        <span class="ad-topo-quem">Entrou como ${esc(eu.apelido)}</span>
        <a class="ad-link" href="../index.html">Voltar ao site</a>
      </div>
    </header>
    <div class="ad-conteudo">
      <div class="ad-cab">
        <div><h1 class="ad-titulo">Painel administrativo</h1><p class="ad-texto">Moderação dos relatos e gestão das contas. As regras do banco são abertas: estas proteções valem só dentro do aplicativo.</p></div>
        <button type="button" class="ad-botao" id="ad-recarregar">Atualizar</button>
      </div>
      ${eu.senhaPadrao ? '<p class="ad-faixa" role="alert">A senha padrão está em uso. Troque em Minha conta, no site.</p>' : ''}
      <div class="ad-contadores" id="ad-contadores" aria-live="polite"></div>
      <div class="ad-abas" role="tablist" aria-label="Partes do painel">
        <button type="button" role="tab" class="ad-aba" data-aba="revisao" id="ad-tab-revisao" aria-controls="ad-area">Relatos em revisão</button>
        <button type="button" role="tab" class="ad-aba" data-aba="relatos" id="ad-tab-relatos" aria-controls="ad-area">Todos os relatos</button>
        <button type="button" role="tab" class="ad-aba" data-aba="usuarios" id="ad-tab-usuarios" aria-controls="ad-area">Usuários</button>
      </div>
      <p class="ad-aviso" id="ad-aviso" role="status" aria-live="polite"></p>
      <section class="ad-area" id="ad-area" role="tabpanel" tabindex="-1"></section>
    </div>`;

  const $ = (s) => raiz.querySelector(s);

  async function carregar() {
    E.carregando = true; E.erro = false; render();
    try {
      E.dados = await A.carregarTudo();
      E.motivos.clear();
      await Promise.all(E.dados.relatos.filter((r) => r.status === 'em_revisao').map(async (r) => {
        const den = await A.lerDenuncias(r.id);
        const conta = {};
        for (const d of Object.values(den || {})) conta[d?.motivo || 'outro'] = (conta[d?.motivo || 'outro'] || 0) + 1;
        E.motivos.set(r.id, conta);
      }));
    } catch (erro) {
      console.error('Não foi possível carregar o painel.', erro);
      E.erro = true;
    }
    E.carregando = false;
    render();
  }

  function aviso(texto) { $('#ad-aviso').textContent = texto; }

  const nomeAutor = (uid) => {
    const u = E.dados.usuarios.find((x) => x.uid === uid);
    return u ? `${u.apelido || u.usuario} (@${u.usuario})` : 'Usuário removido';
  };

  function render() {
    const c = A.contadores(E.dados);
    $('#ad-contadores').innerHTML = [['Usuários', c.usuarios], ['Relatos publicados', c.publicados], ['Em revisão', c.emRevisao], ['Removidos', c.removidos]]
      .map(([n, v]) => `<div class="ad-contador"><span class="ad-contador-v">${E.carregando && !E.dados.usuarios.length ? '—' : v}</span><span class="ad-contador-n">${n}</span></div>`).join('');
    raiz.querySelectorAll('[data-aba]').forEach((b) => {
      const ativa = b.dataset.aba === E.aba;
      b.setAttribute('aria-selected', String(ativa));
      b.tabIndex = ativa ? 0 : -1;
      if (b.dataset.aba === 'revisao') b.textContent = `Relatos em revisão (${c.emRevisao})`;
    });
    $('#ad-area').setAttribute('aria-labelledby', `ad-tab-${E.aba}`);
    const area = $('#ad-area');
    if (E.carregando && !E.dados.usuarios.length) { area.innerHTML = '<p class="ad-texto">Carregando…</p>'; return; }
    if (E.erro) { area.innerHTML = '<div class="ad-vazio"><p>Sem conexão. Tente de novo.</p><button type="button" class="ad-botao" data-recarregar>Tentar de novo</button></div>'; return; }
    if (E.aba === 'revisao') area.innerHTML = renderRevisao();
    else if (E.aba === 'relatos') area.innerHTML = renderRelatos();
    else area.innerHTML = renderUsuarios();
  }

  /* ---------- Relatos em revisão ---------- */
  function renderRevisao() {
    const fila = E.dados.relatos.filter((r) => r.status === 'em_revisao').sort((a, b) => (b.denuncias ?? 0) - (a.denuncias ?? 0));
    if (!fila.length) return '<div class="ad-vazio"><p>Nenhum relato em revisão.</p></div>';
    return `<ul class="ad-fila">${fila.map((r) => {
      const motivos = Object.entries(E.motivos.get(r.id) || {}).map(([m, n]) => `${MOTIVOS[m] || m}: ${n}`).join(' · ') || 'Tirado da lista manualmente ou por um administrador';
      return `<li class="ad-cartao">
        <div class="ad-cartao-topo"><span class="ad-tag">${esc(CATEGORIAS[r.categoria] || 'Outros')}</span><span class="ad-tag">${esc(VALEU[r.valeu] || '')}</span><span class="ad-tag ad-tag-alerta">${r.denuncias ?? 0} ${(r.denuncias ?? 0) === 1 ? 'denúncia' : 'denúncias'}</span></div>
        <h2 class="ad-cartao-titulo">${esc(r.titulo)}</h2>
        <p class="ad-cartao-texto">${esc(r.descoberta)}</p>
        ${r.faria ? `<p class="ad-cartao-texto"><b>O que faria diferente:</b> ${esc(r.faria)}</p>` : ''}
        <p class="ad-meta">Autor: ${esc(r.autorUid ? nomeAutor(r.autorUid) : r.apelido || 'Usuário removido')} · ${formatarDataHora(r.criadoEm)} · nota ${esc(r.nota)}/5</p>
        <p class="ad-meta">Motivos: ${esc(motivos)}</p>
        <div class="ad-acoes"><button type="button" class="ad-botao" data-restaurar="${esc(r.id)}">Restaurar</button><button type="button" class="ad-botao ad-botao-perigo" data-remover="${esc(r.id)}">Remover</button></div>
      </li>`;
    }).join('')}</ul>`;
  }

  /* ---------- Todos os relatos ---------- */
  function renderRelatos() {
    const termo = sem(E.busca);
    const lista = E.dados.relatos
      .filter((r) => E.status === 'todos' || r.status === E.status)
      .filter((r) => !E.autor || r.autorUid === E.autor)
      .filter((r) => !termo || sem(`${r.titulo} ${r.descoberta} ${r.apelido}`).includes(termo))
      .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
    const filtroAutor = E.autor ? `<span class="ad-filtro-autor">Relatos de ${esc(nomeAutor(E.autor))} <button type="button" class="ad-link-btn" data-limpar-autor>Ver todos</button></span>` : '';
    return `<div class="ad-barra">
        <label class="ad-campo"><span class="ad-rotulo">Buscar</span><input type="search" id="ad-busca" value="${esc(E.busca)}" placeholder="Título, texto ou apelido"></label>
        <label class="ad-campo"><span class="ad-rotulo">Status</span><select id="ad-status">${[['todos', 'Todos'], ...Object.entries(STATUS)].map(([k, n]) => `<option value="${k}" ${E.status === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        ${filtroAutor}
      </div>
      ${lista.length ? `<div class="ad-tabela-caixa"><table class="ad-tabela"><thead><tr><th>Relato</th><th>Autor</th><th>Status</th><th>Curtidas</th><th>Denúncias</th><th>Data</th><th><span class="ad-sr">Ações</span></th></tr></thead><tbody>
        ${lista.map((r) => `<tr><td class="ad-td-titulo">${esc(r.titulo)}</td><td>${esc(r.autorUid ? nomeAutor(r.autorUid) : r.apelido || 'Usuário removido')}</td><td><span class="ad-status ad-status-${esc(r.status)}">${STATUS[r.status] || esc(r.status)}</span></td><td>${r.curtidas ?? 0}</td><td>${r.denuncias ?? 0}</td><td>${formatarData(r.criadoEm)}</td>
          <td class="ad-td-acoes">${r.status === 'publicado' ? `<button type="button" class="ad-botao ad-botao-p" data-tirar="${esc(r.id)}">Tirar da lista</button>` : ''}${r.status !== 'publicado' ? `<button type="button" class="ad-botao ad-botao-p" data-restaurar="${esc(r.id)}">Restaurar</button>` : ''}${r.status === 'em_revisao' ? `<button type="button" class="ad-botao ad-botao-p ad-botao-perigo" data-remover="${esc(r.id)}">Remover</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="ad-vazio"><p>Nenhum relato encontrado.</p></div>'}`;
  }

  /* ---------- Usuários ---------- */
  function renderUsuarios() {
    const termo = sem(E.buscaUsuario);
    const lista = E.dados.usuarios
      .filter((u) => !termo || sem(`${u.usuario} ${u.apelido}`).includes(termo))
      .sort((a, b) => (a.papel === 'admin' ? 0 : 1) - (b.papel === 'admin' ? 0 : 1) || String(a.usuario).localeCompare(String(b.usuario)));
    const relatosDe = (uid) => E.dados.relatos.filter((r) => r.autorUid === uid).length;
    return `<div class="ad-barra"><label class="ad-campo"><span class="ad-rotulo">Buscar</span><input type="search" id="ad-busca-usuario" value="${esc(E.buscaUsuario)}" placeholder="Usuário ou apelido"></label></div>
      ${lista.length ? `<div class="ad-tabela-caixa"><table class="ad-tabela"><thead><tr><th>Usuário</th><th>Papel</th><th>Comentar</th><th>Situação</th><th>Relatos</th><th>Criada em</th><th><span class="ad-sr">Ações</span></th></tr></thead><tbody>
        ${lista.map((u) => {
          const sou = u.uid === eu.uid;
          const n = relatosDe(u.uid);
          return `<tr><td><b>${esc(u.apelido || u.usuario)}</b><br><span class="ad-meta">@${esc(u.usuario)}${sou ? ' · você' : ''}${A.ehPadrao(u) ? ' · admin padrão' : ''}</span></td>
          <td>${u.papel === 'admin' ? '<span class="ad-status ad-status-admin">Admin</span>' : 'Comum'}</td>
          <td>${u.podeComentar === false ? `<span class="ad-status ad-status-removido">Impedido</span>` : 'Pode'}</td>
          <td>${u.bloqueado ? `<span class="ad-status ad-status-removido">Bloqueada</span>` : 'Ativa'}${u.motivo ? `<br><span class="ad-meta">${esc(u.motivo)}</span>` : ''}</td>
          <td>${n}</td><td>${formatarData(u.criadoEm)}</td>
          <td class="ad-td-acoes">
            <button type="button" class="ad-botao ad-botao-p" data-papel="${esc(u.uid)}">${u.papel === 'admin' ? 'Tirar admin' : 'Tornar admin'}</button>
            <button type="button" class="ad-botao ad-botao-p" data-comentar="${esc(u.uid)}">${u.podeComentar === false ? 'Permitir comentar' : 'Impedir de comentar'}</button>
            <button type="button" class="ad-botao ad-botao-p${u.bloqueado ? '' : ' ad-botao-perigo'}" data-bloquear="${esc(u.uid)}">${u.bloqueado ? 'Desbloquear' : 'Bloquear'}</button>
            ${n ? `<button type="button" class="ad-botao ad-botao-p" data-ver-relatos="${esc(u.uid)}">Ver relatos</button><button type="button" class="ad-botao ad-botao-p ad-botao-perigo" data-remover-todos="${esc(u.uid)}">Remover todos os relatos</button>` : ''}
          </td></tr>`;
        }).join('')}
      </tbody></table></div>` : '<div class="ad-vazio"><p>Nenhum usuário encontrado.</p></div>'}`;
  }

  /* ---------- Confirmações ---------- */
  function confirmar({ titulo, texto, botao, perigo = false, motivo = false, acao }) {
    const caixa = document.createElement('div');
    caixa.className = 'ad-confirma';
    caixa.innerHTML = `<p class="ad-confirma-texto">${texto}</p>
      ${motivo ? '<label class="ad-campo"><span class="ad-rotulo">Motivo (opcional, a pessoa vê)</span><input name="motivo" maxlength="120"></label>' : ''}
      <p class="ad-confirma-erro" role="alert"></p>
      <div class="ad-acoes ad-acoes-fim"><button type="button" class="ad-botao" data-nao>Cancelar</button><button type="button" class="ad-botao ${perigo ? 'ad-botao-perigo' : 'ad-botao-principal'}" data-sim>${botao}</button></div>`;
    const sob = abrirSobreposicao({ titulo, conteudo: caixa, largura: 440, focoInicial: motivo ? 'input' : '[data-nao]' });
    caixa.querySelector('[data-nao]').onclick = () => sob.fechar();
    caixa.querySelector('[data-sim]').onclick = async (ev) => {
      ev.target.disabled = true;
      try {
        const m = caixa.querySelector('input[name="motivo"]')?.value.trim() || '';
        const msg = await acao(m);
        sob.fechar();
        aviso(msg || 'Pronto.');
        await carregar();
      } catch (erro) {
        console.error('A ação do painel falhou.', erro);
        ev.target.disabled = false;
        caixa.querySelector('.ad-confirma-erro').textContent = 'Não foi possível concluir agora. Tente de novo.';
      }
    };
  }

  const acharRelato = (id) => E.dados.relatos.find((r) => r.id === id);
  const acharUsuario = (uid) => E.dados.usuarios.find((u) => u.uid === uid);
  function impedido(acao, alvo) {
    const motivo = A.bloqueioDaAcao(acao, alvo, eu, E.dados.usuarios);
    if (motivo) aviso(motivo);
    return Boolean(motivo);
  }

  raiz.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.aba) { E.aba = d.aba; aviso(''); render(); return; }
    if (b.id === 'ad-recarregar' || b.hasAttribute('data-recarregar')) { aviso(''); carregar(); return; }
    if (b.hasAttribute('data-limpar-autor')) { E.autor = null; render(); return; }
    if (d.restaurar) {
      const r = acharRelato(d.restaurar);
      confirmar({ titulo: 'Restaurar relato', texto: `"${esc(r.titulo)}" volta para a lista pública e as denúncias são zeradas. O autor não é banido.`, botao: 'Restaurar', acao: async () => { await A.restaurar(r, eu); return 'Relato restaurado.'; } });
    } else if (d.remover) {
      const r = acharRelato(d.remover);
      confirmar({ titulo: 'Remover relato', texto: `"${esc(r.titulo)}" sai da lista de vez (o texto fica guardado) e o autor perde a permissão de escrever relatos.`, botao: 'Remover', perigo: true, motivo: true, acao: async (m) => { await A.remover(r, eu, m); return 'Relato removido e autor impedido de comentar.'; } });
    } else if (d.tirar) {
      const r = acharRelato(d.tirar);
      confirmar({ titulo: 'Tirar da lista', texto: `"${esc(r.titulo)}" sai da lista pública e vai para Relatos em revisão.`, botao: 'Tirar da lista', acao: async () => { await A.tirarDaLista(r, eu); return 'Relato enviado para revisão.'; } });
    } else if (d.papel) {
      const u = acharUsuario(d.papel);
      if (impedido('papel', u)) return;
      const novo = u.papel === 'admin' ? 'usuario' : 'admin';
      confirmar({ titulo: novo === 'admin' ? 'Tornar administrador' : 'Tirar administrador', texto: novo === 'admin' ? `${esc(u.apelido || u.usuario)} passa a ter acesso a este painel.` : `${esc(u.apelido || u.usuario)} deixa de ser administrador.`, botao: 'Confirmar', acao: async () => { await A.mudarPapel(u.uid, novo); return 'Papel atualizado.'; } });
    } else if (d.comentar) {
      const u = acharUsuario(d.comentar);
      if (impedido('comentar', u)) return;
      const pode = u.podeComentar === false;
      confirmar({ titulo: pode ? 'Permitir comentar' : 'Impedir de comentar', texto: pode ? `${esc(u.apelido || u.usuario)} volta a poder escrever relatos.` : `${esc(u.apelido || u.usuario)} não poderá mais escrever relatos (ainda navega, simula e vota).`, botao: 'Confirmar', perigo: !pode, motivo: !pode, acao: async (m) => { await A.definirComentar(u.uid, pode, m); return 'Permissão atualizada.'; } });
    } else if (d.bloquear) {
      const u = acharUsuario(d.bloquear);
      if (impedido('bloquear', u)) return;
      const bloquear = u.bloqueado !== true;
      confirmar({ titulo: bloquear ? 'Bloquear conta' : 'Desbloquear conta', texto: bloquear ? `${esc(u.apelido || u.usuario)} não conseguirá mais entrar no site.` : `${esc(u.apelido || u.usuario)} volta a poder entrar.`, botao: bloquear ? 'Bloquear' : 'Desbloquear', perigo: bloquear, motivo: bloquear, acao: async (m) => { await A.definirBloqueio(u.uid, bloquear, m); return bloquear ? 'Conta bloqueada.' : 'Conta desbloqueada.'; } });
    } else if (d.verRelatos) {
      E.autor = d.verRelatos; E.aba = 'relatos'; E.status = 'todos'; E.busca = ''; render();
    } else if (d.removerTodos) {
      const u = acharUsuario(d.removerTodos);
      confirmar({ titulo: 'Remover todos os relatos', texto: `Todos os relatos de ${esc(u.apelido || u.usuario)} saem da lista (os textos ficam guardados) e a pessoa perde a permissão de escrever relatos.`, botao: 'Remover todos', perigo: true, motivo: true, acao: async (m) => { const n = await A.removerTodos(E.dados.relatos, u.uid, eu, m); return `${n} ${n === 1 ? 'relato removido' : 'relatos removidos'}.`; } });
    }
  });

  raiz.addEventListener('input', (ev) => {
    if (ev.target.id === 'ad-busca') { E.busca = ev.target.value; manterFoco('ad-busca'); }
    if (ev.target.id === 'ad-busca-usuario') { E.buscaUsuario = ev.target.value; manterFoco('ad-busca-usuario'); }
  });
  raiz.addEventListener('change', (ev) => { if (ev.target.id === 'ad-status') { E.status = ev.target.value; manterFoco('ad-status'); } });
  function manterFoco(id) {
    const antes = $(`#${id}`), pos = antes?.selectionStart;
    render();
    const depois = $(`#${id}`);
    depois?.focus();
    if (pos != null && depois?.setSelectionRange) depois.setSelectionRange(pos, pos);
  }

  // Setas entre as abas.
  raiz.querySelector('.ad-abas').addEventListener('keydown', (ev) => {
    const ordem = ['revisao', 'relatos', 'usuarios'];
    const passo = { ArrowRight: 1, ArrowLeft: -1 }[ev.key];
    if (!passo) return;
    ev.preventDefault();
    E.aba = ordem[(ordem.indexOf(E.aba) + passo + ordem.length) % ordem.length];
    render();
    raiz.querySelector(`[data-aba="${E.aba}"]`).focus();
  });

  carregar();
}
