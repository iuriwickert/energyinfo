// Dados da Solis: só o arquivo solis-base.json, desta pasta. Não usa o banco
// e não salva nada (nem as conversas, nem as perguntas sem resposta).

export async function carregarBase() {
  const resposta = await fetch(new URL('./solis-base.json', import.meta.url), { cache: 'no-cache' });
  if (!resposta.ok) throw new Error(`solis-base.json respondeu ${resposta.status}`);
  const base = await resposta.json();
  if (!Array.isArray(base?.perguntas) || base.perguntas.length === 0) {
    throw new Error('solis-base.json não tem perguntas');
  }
  return base;
}
