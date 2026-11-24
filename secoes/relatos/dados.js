// Relatos: acesso ao banco. O banco chega por parâmetro (contexto.firebase).
// Nós: relatos/{id}, votos/{relatoId}/{uid} (1 ou -1), denuncias/{relatoId}/{uid} { motivo, criadoEm }.
import { contarVotos, statusAposDenuncia } from './regras.js';

export async function carregarRelatos(banco) {
  const tudo = await banco.ler('relatos');
  return Object.entries(tudo || {}).map(([id, r]) => ({ id, ...r }));
}

/** Lê o perfil atual no banco (a sessão pode estar velha depois de uma ação do admin). */
export const perfilAtual = (banco, uid) => banco.ler(`usuarios/${uid}`);

export async function publicar(banco, usuario, relato) {
  const id = await banco.novaChave('relatos');
  const registro = {
    ...relato,
    autorUid: usuario.uid,
    criadoEm: new Date().toISOString(),
    status: 'publicado',
    curtidas: 0,
    descurtidas: 0,
    pontos: 0,
    denuncias: 0
  };
  await banco.gravar(`relatos/${id}`, registro);
  return { id, ...registro };
}

export async function meuVoto(banco, relatoId, uid) {
  const v = await banco.ler(`votos/${relatoId}/${uid}`);
  return v === 1 || v === -1 ? v : 0;
}

/** Grava o voto e recalcula os contadores a partir dos votos (sempre batem com o nó votos). */
export async function votar(banco, relatoId, uid, valor) {
  if (valor === 0) await banco.apagar(`votos/${relatoId}/${uid}`);
  else await banco.gravar(`votos/${relatoId}/${uid}`, valor);
  const contagem = contarVotos(await banco.ler(`votos/${relatoId}`));
  // A transação pode ser chamada primeiro com null (sem cache local). Devolver null, e não
  // undefined, faz o banco repetir com o valor real; se o relato não existe, nada é criado.
  const { valor: relato } = await banco.transacao(`relatos/${relatoId}`, (atual) => (atual ? { ...atual, ...contagem } : null));
  return relato ? { ...contagem } : null;
}

export async function jaDenunciou(banco, relatoId, uid) {
  return (await banco.ler(`denuncias/${relatoId}/${uid}`)) != null;
}

/**
 * Registra a denúncia (uma por pessoa) e atualiza o contador e o status numa transação.
 * Denúncia de admin tira o relato da lista na hora.
 */
export async function denunciar(banco, relatoId, uid, motivo, porAdmin) {
  if (await jaDenunciou(banco, relatoId, uid)) return { repetida: true };
  await banco.gravar(`denuncias/${relatoId}/${uid}`, { motivo, criadoEm: new Date().toISOString() });
  const total = Object.keys((await banco.ler(`denuncias/${relatoId}`)) || {}).length;
  const { valor } = await banco.transacao(`relatos/${relatoId}`, (atual) => {
    if (!atual) return null; // ver a nota em votar()
    return { ...atual, denuncias: total, status: statusAposDenuncia(atual.status, total, porAdmin) };
  });
  return { repetida: false, status: valor?.status ?? null, denuncias: total };
}

/** O autor apaga o próprio relato (com os votos e as denúncias dele). */
export async function apagarRelato(banco, relatoId) {
  await Promise.all([banco.apagar(`votos/${relatoId}`), banco.apagar(`denuncias/${relatoId}`)]);
  await banco.apagar(`relatos/${relatoId}`);
}

/** Exclusão da conta: apaga os relatos da pessoa ou mantém como "Usuário removido". */
export async function tratarExclusaoDaConta(banco, uid, escolha) {
  const meus = (await carregarRelatos(banco)).filter((r) => r.autorUid === uid);
  await Promise.all(meus.map((r) => (escolha === 'apagar'
    ? apagarRelato(banco, r.id)
    : banco.atualizar(`relatos/${r.id}`, { apelido: 'Usuário removido', autorUid: null }))));
}
