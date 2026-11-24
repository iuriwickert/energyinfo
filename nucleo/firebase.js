// Acesso ao Firebase Realtime Database.
// Este é o único arquivo que conhece o SDK. As seções recebem este módulo pela
// casca (contexto.firebase) e usam só as seis funções abaixo. Se um dia o acesso
// trocar (REST, outro banco), troca-se só este arquivo.
import { firebaseConfig } from './firebase-config.js';

// Versão fixa do SDK modular, pela CDN oficial.
const URL_APP = 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js';
const URL_BANCO = 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';
const PRAZO_MS = 12000;

let carregando = null;

// O SDK só é baixado na primeira vez que alguém usa o banco.
function carregarSdk() {
  if (!carregando) {
    carregando = Promise.all([import(URL_APP), import(URL_BANCO)])
      .then(([app, sdk]) => ({ sdk, db: sdk.getDatabase(app.initializeApp(firebaseConfig)) }))
      .catch((erro) => {
        carregando = null;
        throw erro;
      });
  }
  return carregando;
}

function limparCaminho(caminho) {
  const limpo = String(caminho ?? '').replace(/^\/+|\/+$/g, '');
  if (/[.$#[\]]/.test(limpo) || limpo.includes('//')) {
    throw new Error(`Caminho inválido no banco: "${caminho}"`);
  }
  return limpo;
}

function comPrazo(promessa) {
  let relogio;
  const prazo = new Promise((_, rejeitar) => {
    relogio = setTimeout(() => rejeitar(new Error('O banco de dados não respondeu a tempo.')), PRAZO_MS);
  });
  return Promise.race([promessa, prazo]).finally(() => clearTimeout(relogio));
}

async function referencia(caminho) {
  const limpo = limparCaminho(caminho);
  const { sdk, db } = await comPrazo(carregarSdk());
  return { sdk, ref: limpo ? sdk.ref(db, limpo) : sdk.ref(db) };
}

/** Lê o valor de um caminho. Devolve null se não existir. */
export async function ler(caminho) {
  const { sdk, ref } = await referencia(caminho);
  const foto = await comPrazo(sdk.get(ref));
  return foto.exists() ? foto.val() : null;
}

/** Grava (substitui) o valor de um caminho. */
export async function gravar(caminho, valor) {
  const { sdk, ref } = await referencia(caminho);
  await comPrazo(sdk.set(ref, valor));
}

/** Atualiza só os campos informados de um caminho. */
export async function atualizar(caminho, objeto) {
  const { sdk, ref } = await referencia(caminho);
  await comPrazo(sdk.update(ref, objeto));
}

/** Apaga um caminho. */
export async function apagar(caminho) {
  const { sdk, ref } = await referencia(caminho);
  await comPrazo(sdk.remove(ref));
}

/**
 * Transação: fn recebe o valor atual (ou null) e devolve o novo valor, ou
 * undefined para desistir. fn pode ser chamada mais de uma vez.
 * Devolve { confirmada, valor }.
 */
export async function transacao(caminho, fn) {
  const { sdk, ref } = await referencia(caminho);
  const resultado = await comPrazo(sdk.runTransaction(ref, (atual) => fn(atual), { applyLocally: false }));
  return {
    confirmada: resultado.committed,
    valor: resultado.snapshot.exists() ? resultado.snapshot.val() : null
  };
}

/** Gera uma chave nova (única) dentro de um caminho, sem gravar nada. */
export async function novaChave(caminho) {
  const { sdk, ref } = await referencia(caminho);
  return sdk.push(ref).key;
}
