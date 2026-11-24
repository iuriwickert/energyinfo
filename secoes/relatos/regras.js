// Relatos: regras puras (sem DOM e sem banco). Especificação da Ferramenta 3.

export const POR_PAGINA = 6; // duas linhas de 3 no mural
export const LIMITE_DENUNCIAS = 10;

export const CATEGORIAS = [
  { id: 'instalacao', nome: 'Instalação' },
  { id: 'conta', nome: 'Conta de luz' },
  { id: 'manutencao', nome: 'Manutenção' },
  { id: 'burocracia', nome: 'Burocracia e concessionária' },
  { id: 'desempenho', nome: 'Desempenho' },
  { id: 'dinheiro', nome: 'Dinheiro' },
  { id: 'outros', nome: 'Outros' }
];
export const nomeCategoria = (id) => CATEGORIAS.find((c) => c.id === id)?.nome ?? 'Outros';

export const VALEU = { sim: 'Valeu a pena', parte: 'Em parte', nao: 'Não valeu' };

export const ORDENS = [
  { id: 'curtidos', nome: 'Mais curtidos' },
  { id: 'recentes', nome: 'Mais recentes' },
  { id: 'nota', nome: 'Maior nota' }
];

export const MOTIVOS = [
  { id: 'spam', nome: 'Spam ou propaganda' },
  { id: 'ofensivo', nome: 'Conteúdo ofensivo' },
  { id: 'falso', nome: 'Informação falsa' },
  { id: 'dados', nome: 'Dados pessoais' },
  { id: 'outro', nome: 'Outro motivo' }
];
export const nomeMotivo = (id) => MOTIVOS.find((m) => m.id === id)?.nome ?? 'Outro motivo';

export const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

export const LIMITES = { titulo: 80, descoberta: 500, faria: 300, apelido: 24 };

const texto = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const numero = (v) => {
  const s = String(v ?? '').trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Confere o formulário. Devolve { erros: { campo: mensagem }, relato } — relato só
 * com os campos do banco que vêm do formulário (sem autor, datas nem contadores).
 */
export function validarRelato(campos = {}) {
  const erros = {};
  const titulo = texto(campos.titulo);
  const descoberta = String(campos.descoberta ?? '').trim();
  const faria = String(campos.faria ?? '').trim();
  const apelido = texto(campos.apelido);
  const nota = Number(campos.nota);
  const meses = numero(campos.mesesDeUso);
  const kwp = numero(campos.kwp);

  if (!titulo) erros.titulo = 'Escreva um título.';
  else if (titulo.length > LIMITES.titulo) erros.titulo = `Use até ${LIMITES.titulo} caracteres.`;
  if (!descoberta) erros.descoberta = 'Conte o que você só descobriu depois.';
  else if (descoberta.length > LIMITES.descoberta) erros.descoberta = `Use até ${LIMITES.descoberta} caracteres.`;
  if (faria.length > LIMITES.faria) erros.faria = `Use até ${LIMITES.faria} caracteres.`;
  if (!CATEGORIAS.some((c) => c.id === campos.categoria)) erros.categoria = 'Escolha uma categoria.';
  if (!VALEU[campos.valeu]) erros.valeu = 'Diga se valeu a pena.';
  if (!(Number.isInteger(nota) && nota >= 1 && nota <= 5)) erros.nota = 'Dê uma nota de 1 a 5.';
  if (meses == null) erros.mesesDeUso = 'Diga há quantos meses usa.';
  else if (!(Number.isInteger(meses) && meses >= 0 && meses <= 240)) erros.mesesDeUso = 'Use um número inteiro de 0 a 240.';
  if (kwp != null && !(kwp >= 0.5 && kwp <= 100)) erros.kwp = 'Use um valor de 0,5 a 100.';
  if (apelido.length < 2) erros.apelido = 'O apelido precisa de pelo menos 2 caracteres.';
  else if (apelido.length > LIMITES.apelido) erros.apelido = `Use até ${LIMITES.apelido} caracteres.`;
  else if (/@|\S+\.\S+@|https?:/i.test(apelido)) erros.apelido = 'Não use e-mail nem endereço no apelido.';
  if (campos.uf && !UFS.includes(campos.uf)) erros.uf = 'Escolha um estado da lista.';
  if (campos.aceite !== true) erros.aceite = 'Confirme a declaração para publicar.';

  const relato = {
    titulo, descoberta, faria, categoria: campos.categoria, valeu: campos.valeu, nota,
    mesesDeUso: meses, apelido
  };
  if (kwp != null && !Number.isNaN(kwp)) relato.kwp = Math.round(kwp * 100) / 100;
  if (campos.uf) relato.uf = campos.uf;
  return { erros, relato };
}

/** O que aparece na lista pública. O autor também vê o próprio relato em revisão. */
export function visiveis(relatos, uid = null) {
  return relatos.filter((r) => r.status === 'publicado' || (uid && r.autorUid === uid && r.status === 'em_revisao'));
}

const tempo = (r) => String(r.criadoEm ?? '');

export function ordenar(relatos, ordem = 'curtidos') {
  const lista = relatos.slice();
  // Exemplos ilustrativos ficam sempre depois dos relatos reais.
  const exemplo = (r) => (r.exemplo ? 1 : 0);
  if (ordem === 'recentes') lista.sort((a, b) => exemplo(a) - exemplo(b) || tempo(b).localeCompare(tempo(a)));
  else if (ordem === 'nota') lista.sort((a, b) => exemplo(a) - exemplo(b) || (b.nota ?? 0) - (a.nota ?? 0) || (b.pontos ?? 0) - (a.pontos ?? 0) || tempo(b).localeCompare(tempo(a)));
  else lista.sort((a, b) => exemplo(a) - exemplo(b) || (b.pontos ?? 0) - (a.pontos ?? 0) || tempo(b).localeCompare(tempo(a)));
  return lista;
}

export function filtrar(relatos, categoria) {
  return categoria && categoria !== 'todas' ? relatos.filter((r) => r.categoria === categoria) : relatos;
}

export function paginar(relatos, pagina, porPagina = POR_PAGINA) {
  const paginas = Math.max(1, Math.ceil(relatos.length / porPagina));
  const atual = Math.min(Math.max(1, pagina), paginas);
  return { itens: relatos.slice((atual - 1) * porPagina, atual * porPagina), pagina: atual, paginas };
}

/** Resumo só com relatos reais publicados (os exemplos ficam de fora, seção 8). */
export function resumir(relatos) {
  const reais = relatos.filter((r) => r.status === 'publicado' && !r.exemplo);
  const n = reais.length;
  const conta = (v) => reais.filter((r) => r.valeu === v).length;
  const notas = reais.map((r) => Number(r.nota)).filter((x) => x >= 1 && x <= 5);
  return {
    total: n,
    media: notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null,
    sim: n ? conta('sim') / n : 0,
    parte: n ? conta('parte') / n : 0,
    nao: n ? conta('nao') / n : 0
  };
}

/** Novo voto ao clicar: clicar de novo no mesmo desfaz. */
export const proximoVoto = (atual, clicado) => (atual === clicado ? 0 : clicado);

/** Conta curtidas e descurtidas a partir do nó votos/{relatoId}. */
export function contarVotos(votos) {
  const valores = Object.values(votos || {});
  const curtidas = valores.filter((v) => v === 1).length;
  const descurtidas = valores.filter((v) => v === -1).length;
  return { curtidas, descurtidas, pontos: curtidas - descurtidas };
}

/** Status depois de uma denúncia: 10 pessoas diferentes, ou um admin, tiram da lista. */
export function statusAposDenuncia(status, denuncias, porAdmin) {
  if (status !== 'publicado') return status;
  return porAdmin || denuncias >= LIMITE_DENUNCIAS ? 'em_revisao' : 'publicado';
}

/** Contagem de motivos: { spam: 2, ofensivo: 1 } a partir de denuncias/{relatoId}. */
export function contarMotivos(denuncias) {
  const out = {};
  for (const d of Object.values(denuncias || {})) out[d?.motivo || 'outro'] = (out[d?.motivo || 'outro'] || 0) + 1;
  return out;
}

export function tempoDeUso(meses) {
  const m = Number(meses);
  if (!Number.isFinite(m)) return '';
  if (m < 1) return 'menos de 1 mês de uso';
  if (m < 24) return `${m} ${m === 1 ? 'mês' : 'meses'} de uso`;
  const anos = Math.floor(m / 12);
  return `${anos} anos de uso`;
}

/** Lê a categoria de #relatos?categoria=... (ou null). */
export function categoriaDaAncora(hash) {
  const [base, busca = ''] = String(hash ?? '').replace(/^#/, '').split('?');
  if (base !== 'relatos') return null;
  const c = new URLSearchParams(busca).get('categoria');
  return CATEGORIAS.some((x) => x.id === c) ? c : null;
}
