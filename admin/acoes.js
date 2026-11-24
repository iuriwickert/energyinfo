// Painel administrativo: regras e ações no banco. Importa só de nucleo/.
// Com as regras do banco abertas, estas proteções são só do aplicativo (ver README).
import * as banco from '../nucleo/firebase.js';
import { USUARIO_ADMIN } from '../nucleo/sessao.js';

const agora = () => new Date().toISOString();

export async function carregarTudo() {
  const [usuarios, relatos] = await Promise.all([banco.ler('usuarios'), banco.ler('relatos')]);
  return {
    usuarios: Object.entries(usuarios || {}).map(([uid, u]) => ({ uid, ...u })),
    relatos: Object.entries(relatos || {}).map(([id, r]) => ({ id, ...r }))
  };
}

export const lerDenuncias = (relatoId) => banco.ler(`denuncias/${relatoId}`);

export function contadores(dados) {
  const status = (s) => dados.relatos.filter((r) => r.status === s).length;
  return { usuarios: dados.usuarios.length, publicados: status('publicado'), emRevisao: status('em_revisao'), removidos: status('removido') };
}

/* ---------- Regras de proteção (puras) ---------- */
export const ehPadrao = (u) => u?.usuario === USUARIO_ADMIN;
const totalAdmins = (usuarios) => usuarios.filter((u) => u.papel === 'admin').length;

/** Devolve o motivo para NÃO permitir a ação, ou '' se pode. */
export function bloqueioDaAcao(acao, alvo, eu, usuarios) {
  if (alvo.uid === eu.uid && ['papel', 'bloquear', 'comentar'].includes(acao)) return 'Você não pode mudar a própria conta por aqui.';
  if (acao === 'papel' && alvo.papel === 'admin') {
    if (ehPadrao(alvo)) return 'O administrador padrão não pode perder o papel.';
    if (totalAdmins(usuarios) <= 1) return 'A plataforma precisa de pelo menos um administrador.';
  }
  if (acao === 'bloquear' && alvo.bloqueado !== true && ehPadrao(alvo)) return 'O administrador padrão não pode ser bloqueado.';
  return '';
}

/* ---------- Usuários ---------- */
export const mudarPapel = (uid, papel) => banco.atualizar(`usuarios/${uid}`, { papel: papel === 'admin' ? 'admin' : 'usuario' });

export const definirComentar = (uid, pode, motivo = '') =>
  banco.atualizar(`usuarios/${uid}`, pode ? { podeComentar: true, motivo: null } : { podeComentar: false, motivo: motivo || null });

export const definirBloqueio = (uid, bloquear, motivo = '') =>
  banco.atualizar(`usuarios/${uid}`, bloquear ? { bloqueado: true, motivo: motivo || null } : { bloqueado: false, motivo: null });

/* ---------- Relatos ---------- */
function registroRevisao(acao, eu, extra = {}) {
  return { acao, em: agora(), por: eu.uid, ...extra };
}

/** Restaurar: volta para a lista, zera as denúncias (precisa de 10 novas) e registra a revisão. Não bane ninguém. */
export async function restaurar(relato, eu) {
  const chave = await banco.novaChave(`relatos/${relato.id}/revisoes`);
  await banco.apagar(`denuncias/${relato.id}`);
  await banco.atualizar(`relatos/${relato.id}`, {
    status: 'publicado', denuncias: 0, revisadoEm: agora(), revisadoPor: eu.uid,
    [`revisoes/${chave}`]: registroRevisao('restaurado', eu, { denuncias: relato.denuncias ?? 0 })
  });
}

/** Remover: sai da lista para sempre (o texto fica guardado) e o autor perde a permissão de comentar. */
export async function remover(relato, eu, motivo = '') {
  const chave = await banco.novaChave(`relatos/${relato.id}/revisoes`);
  await banco.atualizar(`relatos/${relato.id}`, {
    status: 'removido', revisadoEm: agora(), revisadoPor: eu.uid,
    [`revisoes/${chave}`]: registroRevisao('removido', eu, motivo ? { motivo } : {})
  });
  if (relato.autorUid) await definirComentar(relato.autorUid, false, motivo || 'Relato removido pela moderação.');
}

/** Tirar da lista manualmente (vai para a fila de revisão sem esperar 10 denúncias). */
export async function tirarDaLista(relato, eu) {
  const chave = await banco.novaChave(`relatos/${relato.id}/revisoes`);
  await banco.atualizar(`relatos/${relato.id}`, {
    status: 'em_revisao',
    [`revisoes/${chave}`]: registroRevisao('tirado_da_lista', eu)
  });
}

/** Remove todos os relatos de uma pessoa (e tira dela a permissão de comentar). */
export async function removerTodos(relatos, uid, eu, motivo = '') {
  const dela = relatos.filter((r) => r.autorUid === uid && r.status !== 'removido');
  for (const r of dela) {
    const chave = await banco.novaChave(`relatos/${r.id}/revisoes`);
    await banco.atualizar(`relatos/${r.id}`, {
      status: 'removido', revisadoEm: agora(), revisadoPor: eu.uid,
      [`revisoes/${chave}`]: registroRevisao('removido', eu, { emLote: true })
    });
  }
  await definirComentar(uid, false, motivo || 'Relatos removidos pela moderação.');
  return dela.length;
}
