// Formatação em português do Brasil: R$, kWh, números e datas.

const VAZIO = '—';
const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const diaHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
});

function numeroValido(valor) {
  return typeof valor === 'number' && Number.isFinite(valor);
}

function comoData(valor) {
  const data = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

/** 1234.5 → "R$ 1.234,50" */
export function formatarReais(valor) {
  return numeroValido(valor) ? reais.format(valor) : VAZIO;
}

/** 1234.5 → "1.234,5" (com o número de casas pedido) */
export function formatarNumero(valor, casas = 0) {
  if (!numeroValido(valor)) return VAZIO;
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** 350 → "350 kWh" */
export function formatarKwh(valor, casas = 0) {
  return numeroValido(valor) ? `${formatarNumero(valor, casas)} kWh` : VAZIO;
}

/** Data ISO, número ou Date → "16/11/2026" */
export function formatarData(valor) {
  const data = valor === null || valor === undefined || valor === '' ? null : comoData(valor);
  return data ? dia.format(data) : VAZIO;
}

/** Data ISO, número ou Date → "16/11/2026, 14:30" */
export function formatarDataHora(valor) {
  const data = valor === null || valor === undefined || valor === '' ? null : comoData(valor);
  return data ? diaHora.format(data) : VAZIO;
}
