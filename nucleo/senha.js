// Hash de senha: PBKDF2-SHA256 pela Web Crypto do navegador.
// A senha nunca é guardada em texto: só o sal, o hash e o número de iterações.

export const ITERACOES = 150000;
const BYTES_SAL = 16;
const BITS_SAIDA = 256;

// O navegador só libera a Web Crypto em https (como no GitHub Pages) ou em localhost.
function cripto() {
  if (globalThis.crypto?.subtle) return globalThis.crypto;
  throw new Error('Este navegador não oferece a Web Crypto. Abra o site por https ou por http://localhost.');
}

function paraBase64(bytes) {
  let texto = '';
  for (const byte of bytes) texto += String.fromCharCode(byte);
  return btoa(texto);
}

function deBase64(texto) {
  const bruto = atob(texto);
  const bytes = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i += 1) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

/** Calcula o hash (base64) de uma senha com um sal (base64) e um número de iterações. */
export async function calcularHash(senha, salt, iteracoes = ITERACOES) {
  const api = cripto();
  const chave = await api.subtle.importKey('raw', new TextEncoder().encode(String(senha)), 'PBKDF2', false, ['deriveBits']);
  const bits = await api.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: deBase64(salt), iterations: iteracoes },
    chave,
    BITS_SAIDA
  );
  return paraBase64(new Uint8Array(bits));
}

/** Gera { salt, senhaHash, iteracoes } para guardar no banco. O sal é aleatório. */
export async function gerarCredencial(senha) {
  const api = cripto();
  const salt = paraBase64(api.getRandomValues(new Uint8Array(BYTES_SAL)));
  const senhaHash = await calcularHash(senha, salt, ITERACOES);
  return { salt, senhaHash, iteracoes: ITERACOES };
}

// Compara sem parar no primeiro byte diferente (tempo constante).
function iguais(a, b) {
  let diferenca = a.length ^ b.length;
  const tamanho = Math.max(a.length, b.length);
  for (let i = 0; i < tamanho; i += 1) {
    diferenca |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diferenca === 0;
}

/** Confere uma senha contra a credencial guardada. Credencial inválida devolve false. */
export async function conferirSenha(senha, credencial) {
  const { salt, senhaHash, iteracoes } = credencial ?? {};
  if (typeof senha !== 'string' || typeof salt !== 'string' || typeof senhaHash !== 'string') return false;
  if (!Number.isInteger(iteracoes) || iteracoes < 1) return false;
  try {
    return iguais(await calcularHash(senha, salt, iteracoes), senhaHash);
  } catch {
    return false;
  }
}
