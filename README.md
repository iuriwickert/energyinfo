# Energy Information

Plataforma web do Projeto Integrador sobre a ODS 7 (meta 7.2, energias renováveis): uma página
em cascata com a Solis (chatbot sem inteligência artificial), o planejador solar e os relatos de
quem já instalou, mais conta de usuário, políticas e um painel administrativo em página separada.

## Só HTML, CSS e JavaScript

Não há instalação, build, servidor próprio nem API. O navegador abre os arquivos desta pasta e
conversa direto com o Firebase Realtime Database. Qualquer hospedagem de arquivos estáticos
serve, como o GitHub Pages.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie o conteúdo desta pasta, com o `index.html` na raiz.
2. No repositório, abra **Settings → Pages**.
3. Em **Source**, escolha **Deploy from a branch**; em **Branch**, escolha `main` e `/ (root)`.
4. Salve. Em um ou dois minutos o site abre em `https://<usuario>.github.io/<repositorio>/`.

Todos os caminhos do site são relativos, então ele funciona dentro da pasta do repositório.

## Abrir no computador

Dois cliques no `index.html` não funcionam: o navegador bloqueia módulos JavaScript abertos como
arquivo (`file://`). Use o endereço publicado ou um servidor de arquivos local, como a extensão
**Live Server** do VS Code. O endereço precisa ser `https` ou `localhost`, porque o hash de senha
usa a Web Crypto do navegador.

## Banco de dados

Firebase Realtime Database, com o endereço em `nucleo/firebase-config.js`. O login é próprio,
sem Firebase Authentication e sem `apiKey`.

| Nó | Conteúdo |
|---|---|
| `usuarios/{uid}` | perfil, sem senha |
| `credenciais/{uid}` | `salt`, `senhaHash`, `iteracoes` (PBKDF2-SHA256, 150 000 iterações) |
| `indiceUsuarios/{usuario}` | `{ uid }`, garante nome de usuário único |
| `simulacoes/{uid}/{id}` | histórico do planejador (até 20), **sem localização** |
| `relatos/{id}` | relatos, com `status` (`publicado`, `em_revisao`, `removido`) e contadores |
| `votos/{relatoId}/{uid}` | `1` (curtir) ou `-1` (descurtir) |
| `denuncias/{relatoId}/{uid}` | `motivo`, `criadoEm` |
| `parametros/...` | opcional: valores do planejador (`valor`, `fonte`, `data`); fora da faixa é ignorado |

O admin padrão (usuário `admin`) já está criado no banco. Troque a senha dele em Minha conta
antes de divulgar o site. Para tornar outra conta admin, crie a conta pelo site e, no console do
Firebase, mude `usuarios/{uid}/papel` para `"admin"`.

### Limite que precisa ficar claro

As regras do banco estão abertas (leitura e escrita liberadas) e o endereço do banco fica visível
no código. Por isso, **admin, bloqueio e permissões são regras só do aplicativo**: quem mexer
direto no banco consegue burlá-las, apagar dados e ler os hashes de senha. É um limite aceito
para um projeto escolar, e é por isso que as telas de senha avisam para não usar senhas de verdade.

No navegador, a sessão guarda só `{ uid }` em `localStorage` (chave `ei.sessao`). O SDK do
Firebase guarda, por conta própria, o nome do servidor do banco (chave `firebase:host:...`).

## Arquitetura modular

Cada ferramenta fica na sua pasta, não importa nada de outra e se inicia sozinha pela casca.
Ajustar uma seção não exige mexer em outra.

```
index.html     casca: só posiciona as seções e inicia cada uma
nucleo/        compartilhado: tokens.css, firebase.js, senha.js, sessao.js, sobreposicao.js, formato.js
secoes/        cabecalho, hero, jornada, solis, ponte, planejador, destaques, relatos,
               convite, rodape, conta, politicas
admin/         painel administrativo (página separada, só para admin)
```

### Novo design (aspecto de site)

Ordem da página: cabeçalho → hero → **Como funciona** (`jornada`) → Solis → **Antes de simular**
(`ponte`) → Planejador →
**Por que falar de energia solar?** (`destaques`, faixa escura) → Relatos → **convite**
para criar conta (muda quando a pessoa entra) → rodapé.

- As três ferramentas não mudaram. A casca (`index.html` + `nucleo/tokens.css`) envolve cada uma
  num **capítulo**: faixa de largura total com fundo alternado (branco / âmbar-claro) e uma
  **abertura de site** (`.pi-capitulo__abertura`): trilha de 3 traços com "Passo X de 3 · Verbo",
  título de 28 px em forma de pergunta, texto de apoio e 3 pontos com visto âmbar à direita.
  Abaixo, a ferramenta dentro de uma moldura arredondada (`.pi-palco`, padding 16 px, raio 20 px).
  Espaço do capítulo: 72 px em cima, 88 px embaixo.
- **Ponte** (`secoes/ponte/`, `.ei-pon`), entre a Solis e o planejador: "Antes de simular, separe
  três coisas" (conta de luz, CEP, medidas do telhado), com ilustração de uma conta de luz e da
  planta do telhado numeradas 1, 2 e 3, e o botão "Abrir o planejador". O fundo vai do branco ao
  âmbar-claro, e o capítulo do planejador começa sem borda, então as duas faixas se emendam.
- `jornada`, `ponte`, `destaques` e `convite` são seções como as outras: pasta própria, prefixo
  próprio (`.ei-jor`, `.ei-pon`, `.ei-dest`, `.ei-conv`), `iniciarX` e `destruir()`.
- Títulos das seções de site: 28 px (24 px abaixo de 600 px de largura). As ferramentas seguem
  com o padrão de 20 px.

- A casca carrega `secoes/<nome>/<nome>.js` com `import()` dentro de `try/catch`. Se uma seção
  falhar, as outras continuam e no lugar dela aparece "Não foi possível carregar esta ferramenta".
- Cada seção exporta `iniciarX(raiz, contexto)` e `destruir()`. O contexto é
  `{ usuario, abrirLogin(modo), firebase }`. Os modos são `'entrar'`, `'criar'` e `'conta'`.
- Uma seção só importa dela mesma e de `nucleo/`, e carrega o próprio CSS, com prefixo próprio:
  `.ei-` (cabeçalho, hero, jornada, ponte, destaques, convite, rodapé, políticas), `.so-`, `.co-`, `.pl-`, `.re-`, `.ad-`.
- As seções não conversam entre si. O contrato entre elas é o endereço com âncora:
  `#solis`, `#planejador?historico=1`, `#relatos?categoria=...`, `#politicas/termos`.
- Eventos no `document`: `ei:login-mudou` (`detail: { usuario }`), `ei:conta-excluindo`
  (`detail: { uid, relatos, tarefas }`) e `ei:simulacoes-excluir` (`detail: { uid, tarefas }`).
  Quem escuta os dois últimos põe uma promessa em `detail.tarefas`, e a conta espera todas.
- Nomes de arquivos e pastas ficam em minúsculas e sem acento: o GitHub Pages diferencia
  maiúsculas de minúsculas, e um nome com a caixa errada não carrega.

## Solis

As perguntas ficam em `secoes/solis/solis-base.json`. Para mudar uma resposta ou acrescentar um
jeito de perguntar, edite esse arquivo.

- A ordem das pílulas é a ordem do arquivo, entre as perguntas com `"sugestao": true`.
- `ordem` só decide empates, e o menor vence. Os assuntos específicos têm número menor que os
  gerais, para ganharem deles no empate.
- Uma palavra-chave pode ter mais de uma palavra ("vale a pena"). Ela conta quando todas aparecem.
- Links nas respostas usam `[texto](#ancora)` e só valem para âncoras da própria página.
- As respostas não trazem preço, percentual nem prazo.

## Planejador solar

Três modos (Facilitado, Padrão e Expert) sobre o mesmo cálculo, em `secoes/planejador/`:
`calculo.js` (motor), `apis.js` (BrasilAPI/ViaCEP, IBGE, NASA POWER e Open-Meteo, com 8 s de
espera e reserva), `parametros.js` (valores-base e a tabela de tarifas da ANEEL), `telhado.js`
(editor do telhado), `graficos.js`, `ui.js` e `historico.js`.

- A API da ANEEL não libera o navegador (CORS); a tarifa vem da tabela da ANEEL embutida em
  `parametros.js`, extraída em 16/11/2026, e a pessoa pode digitar a da conta.
- O CEP, a cidade e as coordenadas ficam só na memória da página. O histórico guarda as entradas
  e o resultado, nunca a localização; para refazer, a pessoa digita o CEP de novo.
- Com login, cada simulação é salva sozinha (até 20). Sem login, o resultado avisa que nada será
  salvo; se a pessoa entrar com o resultado aberto, ele é salvo na hora.
- `#planejador?historico=1` abre o histórico.

## Relatos

Em `secoes/relatos/`. Visitante lê; para escrever, curtir, descurtir e denunciar é preciso entrar.

- Ordem padrão: mais curtidos (curtidas − descurtidas). 4 por página.
- Cada pessoa vota e denuncia uma vez por relato. Com 10 denúncias de pessoas diferentes, ou uma
  de admin, o relato sai da lista e vai para a revisão no painel.
- `exemplos.json` traz 4 **exemplos ilustrativos**, escritos pela equipe: aparecem sempre com a
  etiqueta, depois dos relatos reais, fora do resumo e sem votos. Para tirá-los, esvazie a lista.
- `#relatos?categoria=desempenho` abre a lista filtrada.

## Painel administrativo

`admin/index.html`, aberto pelo botão do rodapé (só aparece para admin). Abas:

- **Relatos em revisão:** texto completo, denúncias e motivos. **Restaurar** volta para a lista e
  zera as denúncias. **Remover** tira de vez (o texto fica guardado) e impede o autor de comentar.
- **Todos os relatos:** busca, filtro por status e "Tirar da lista".
- **Usuários:** papel, permissão de comentar, bloqueio, ver relatos e remover todos os relatos.
  O admin padrão não perde o papel nem é bloqueado, o último admin não perde o papel, e ninguém
  muda a própria conta por aqui.

## Políticas

Os textos ficam em `secoes/politicas/textos/*.html`, separados do código. Vieram das notas
"Politica - ..." do cofre, a partir da seção "Texto", sem alteração de conteúdo.

## Avisos que não podem sair em ajustes de layout

Faixa inferior do rodapé; linha abaixo do chat da Solis; caixa de aceite do cadastro; caixa de
aviso de senha (cadastro e trocar senha) e a linha curta na tela de Entrar; botões "Excluir
simulações" e "Excluir minha conta e meus dados". No planejador: o aviso do CEP, a faixa fixa do
resultado, "Limites desta estimativa", a nota da precisão e a da faixa de investimento. Nos
relatos: a linha de apoio do cabeçalho, a caixa de aceite do formulário e a etiqueta "Exemplo
ilustrativo".
