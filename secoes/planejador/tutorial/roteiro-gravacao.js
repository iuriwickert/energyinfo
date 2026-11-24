// Roteiro do tutorial, rodado DENTRO da página durante a gravação.
// Desenha um cursor animado, o efeito de clique e balões explicando cada passo,
// e usa a ferramenta de verdade (cliques e digitação reais).
(() => {
  const css = `
  #tt-cursor{position:fixed;left:0;top:0;z-index:2147483647;width:26px;height:26px;pointer-events:none;
    transition:transform .85s cubic-bezier(.45,.05,.25,1);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
  #tt-cursor.tt-aperta svg{transform:scale(.85)}
  #tt-cursor svg{transition:transform .12s ease;transform-origin:4px 3px}
  .tt-onda{position:fixed;z-index:2147483646;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;
    border:3px solid #f59e0b;pointer-events:none;animation:tt-onda .55s ease-out forwards}
  @keyframes tt-onda{from{transform:scale(.4);opacity:1}to{transform:scale(3.2);opacity:0}}
  #tt-balao{position:fixed;z-index:2147483645;max-width:340px;padding:14px 16px 14px 18px;border-radius:14px;background:#1d2433;color:#fff;
    font:500 15px/22px system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 18px 40px -12px rgba(15,23,42,.55);
    opacity:0;transform:translateY(8px) scale(.97);transition:opacity .3s ease,transform .3s cubic-bezier(.2,.8,.2,1);pointer-events:none}
  #tt-balao.tt-ver{opacity:1;transform:none}
  #tt-balao b{display:block;margin-bottom:4px;font:700 11px/14px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#fbbf24}
  #tt-balao::after{content:"";position:absolute;width:14px;height:14px;background:#1d2433;transform:rotate(45deg);left:var(--tt-seta,28px)}
  #tt-balao.tt-baixo::after{top:-6px} #tt-balao.tt-cima::after{bottom:-6px}
  .tt-foco{outline:3px solid #f59e0b!important;outline-offset:4px!important;border-radius:10px;transition:outline-color .3s}`;
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);
  const cur = document.createElement('div'); cur.id = 'tt-cursor';
  cur.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 3l15 8.2-6.6 1.6 3.9 6.8-2.7 1.5-3.9-6.8L5 19z" fill="#fff" stroke="#1d2433" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  document.body.append(cur);
  const bal = document.createElement('div'); bal.id = 'tt-balao'; document.body.append(bal);

  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  let pos = { x: innerWidth * 0.55, y: innerHeight * 0.85 };
  cur.style.transform = `translate(${pos.x}px,${pos.y}px)`;
  const el = (s) => document.querySelector(s);
  const centro = (e) => { const b = e.getBoundingClientRect(); return { x: b.left + Math.min(b.width / 2, 60), y: b.top + b.height / 2 }; };

  async function mover(seletor, ms = 900) {
    const e = el(seletor); if (!e) throw new Error('não achei ' + seletor);
    const c = centro(e); pos = c;
    cur.style.transition = `transform ${ms}ms cubic-bezier(.45,.05,.25,1)`;
    cur.style.transform = `translate(${c.x - 4}px,${c.y - 3}px)`;
    await espera(ms + 80);
    return e;
  }
  async function clicar(seletor) {
    const e = await mover(seletor);
    cur.classList.add('tt-aperta');
    const o = document.createElement('div'); o.className = 'tt-onda'; o.style.left = pos.x + 'px'; o.style.top = pos.y + 'px';
    document.body.append(o); setTimeout(() => o.remove(), 700);
    await espera(120); cur.classList.remove('tt-aperta');
    e.focus?.({ preventScroll: true }); e.click();
    await espera(450);
  }
  async function digitar(seletor, texto) {
    await clicar(seletor);
    const e = el(seletor);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (const ch of texto) {
      setter.call(e, e.value + ch);
      e.dispatchEvent(new Event('input', { bubbles: true }));
      await espera(110);
    }
    e.dispatchEvent(new Event('change', { bubbles: true }));
    e.blur();
    await espera(400);
  }
  let focado = null;
  async function balao(seletor, titulo, texto, ms = 3200) {
    const alvo = seletor ? el(seletor) : null;
    focado?.classList.remove('tt-foco'); focado = alvo; alvo?.classList.add('tt-foco');
    bal.classList.remove('tt-ver', 'tt-cima', 'tt-baixo');
    await espera(180);
    bal.innerHTML = `<b>${titulo}</b>${texto}`;
    const w = 340;
    if (alvo) {
      const b = alvo.getBoundingClientRect();
      const abaixo = b.bottom + 16 + 120 < innerHeight;
      let x = Math.min(Math.max(12, b.left), innerWidth - w - 12);
      const y = abaixo ? b.bottom + 16 : b.top - 16;
      bal.classList.add(abaixo ? 'tt-baixo' : 'tt-cima');
      bal.style.left = x + 'px';
      bal.style.top = abaixo ? y + 'px' : '';
      bal.style.bottom = abaixo ? '' : (innerHeight - y) + 'px';
      bal.style.setProperty('--tt-seta', Math.min(Math.max(16, b.left + Math.min(b.width / 2, 60) - x - 7), w - 30) + 'px');
    } else {
      bal.style.left = (innerWidth - w) / 2 + 'px'; bal.style.top = innerHeight * 0.4 + 'px'; bal.style.bottom = '';
    }
    bal.classList.add('tt-ver');
    await espera(ms);
  }
  async function some() { bal.classList.remove('tt-ver'); focado?.classList.remove('tt-foco'); focado = null; await espera(350); }

  window.__tour = async function () {
    const C = '#pl-casinha';
    await espera(600);
    await balao('.pl-modo[data-modo="padrao"]', 'Modo Padrão', 'Vamos fazer uma simulação completa, do começo ao fim.', 3200);
    await some();
    await balao('#pl-cep', 'Passo 1 · Local', 'Comece pelo CEP do imóvel. Ele serve só para buscar o sol e a tarifa da região.', 2600);
    await digitar('#pl-cep', '01310100');
    await clicar('#pl-buscar');
    await espera(2600);
    await balao('#pl-etiquetas', 'Dados da região', 'Cidade, sol, tarifa e distribuidora vêm sozinhos. Dá para ajustar clicando no lápis.', 3200);
    await some();
    await balao('input[data-k="contaReais"]', 'Passo 2 · Conta de luz', 'Informe quanto vem, em média, na sua conta por mês.', 2400);
    await digitar('input[data-k="contaReais"]', '350');
    await some();
    await balao(C + ' .pl-casa-pergunta', 'Passo 3 · Telhado', 'Responda sobre o telhado. A casinha mostra na hora qual lado pega mais sol.', 3000);
    await clicar(C + ' [data-forma="duas"]');
    await clicar(C + ' [data-nav="1"]');
    await balao(C + ' .pl-casa-pergunta', 'Tamanho', 'Ajuste o tamanho aproximado da casa. Não precisa ser exato.', 2200);
    await clicar(C + ' [data-m="W"][data-d="1"]');
    await clicar(C + ' [data-m="W"][data-d="1"]');
    await clicar(C + ' [data-nav="1"]');
    await balao(C + ' .pl-casa-pergunta', 'Direção', 'Para onde a frente da casa está virada? Veja o sol mudar de lado.', 2200);
    await clicar(C + ' [data-frente="0"]');
    await espera(700);
    await clicar(C + ' [data-frente="180"]');
    await espera(900);
    await clicar(C + ' [data-nav="1"]');
    await clicar(C + ' [data-incl="20"]');
    await some();
    await balao('input[data-k="metas.reais"]', 'Passo 4 · Meta', 'Diga o que você quer. Por exemplo: reduzir a conta em R$ 250 por mês.', 2600);
    await digitar('input[data-k="metas.reais"]', '250');
    await some();
    await balao('#pl-stats', 'Precisão', 'A barra mostra o quanto a estimativa está completa. Quanto mais dados, mais certa.', 3000);
    await some();
    await clicar('#pl-simular');
    await espera(1200);
    await balao('#pl-dialogo', 'Resultado', 'Painéis, custo e em quanto tempo o sistema se paga. Use as abas para ver os detalhes.', 4200);
    await some();
    await espera(1500);
    await balao(null, 'Pronto!', 'Agora é a sua vez: feche este tutorial e faça a sua simulação.', 3200);
    await some();
    return 'ok';
  };
})();
