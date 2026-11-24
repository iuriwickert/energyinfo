// Animações de entrada: blocos surgem (sobem e aparecem) quando entram na tela.
// As seções desenham o conteúdo depois do carregamento, então o módulo observa
// a página e marca os elementos novos. Itens em grade entram um depois do outro.
// Com "reduzir movimento" ligado no sistema, nada é animado.

// O que anima: aberturas de capítulo, cartões, ferramentas e blocos de conteúdo.
const ALVOS = [
  '.pi-capitulo__abertura',
  '.pi-palco',
  '.ei-jor__cabeca', '.ei-jor__cartao',
  '#antes-de-simular > * > *',
  '#por-que-solar > * > *',
  '.re-item',
  '.ei-conv__painel',
  '#ei-rodape > * > *'
].join(',');
const ATRASO_MS = 70; // entre irmãos de uma mesma grade
const MAX_ATRASO_MS = 420;

export function iniciarAnimacoes() {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const vistos = new WeakSet();
  const observador = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      el.classList.add('ei-visivel');
      observador.unobserve(el);
      // terminada a entrada, devolve o elemento ao normal (hover e transições dele voltam a valer)
      el.addEventListener('transitionend', () => { el.classList.remove('ei-revelar', 'ei-visivel'); el.style.removeProperty('--ei-atraso'); }, { once: true });
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  function marcar() {
    const alturaTela = window.innerHeight;
    for (const el of document.querySelectorAll(ALVOS)) {
      if (vistos.has(el)) continue;
      vistos.add(el);
      // o que já está na primeira tela aparece direto, sem piscar
      if (el.getBoundingClientRect().top < alturaTela * 0.9 && window.scrollY < 10) continue;
      const irmaos = el.parentElement ? [...el.parentElement.children].filter((x) => x.matches(ALVOS)) : [];
      const ordem = Math.max(0, irmaos.indexOf(el));
      el.style.setProperty('--ei-atraso', `${Math.min(ordem * ATRASO_MS, MAX_ATRASO_MS)}ms`);
      el.classList.add('ei-revelar');
      observador.observe(el);
    }
  }

  let agendado = 0;
  const agendar = () => { if (!agendado) agendado = requestAnimationFrame(() => { agendado = 0; marcar(); }); };
  new MutationObserver(agendar).observe(document.body, { childList: true, subtree: true });
  marcar();
}
