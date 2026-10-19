# 🌙 Sleep City

**Sleep City** é um ajudante para a brincadeira **Cidade Dorme**: uma pessoa cria a sala e compartilha o link, os amigos entram com o próprio nome, e quem criou a sala — o **narrador** — sorteia **Assassinos**, **Detetives**, **SAMU**, **Espelhos** e **Justiceiros**. O resto da sala fica como cidadão. Cada jogador vê **apenas a própria função**, no próprio celular; o narrador vê a de todos.

- **Frontend:** React 19 + Vite + Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com)
- **Backend:** Node.js + Express, publicado como Vercel Function (`api/index.ts`)
- **Estado:** Upstash Redis (pelo Marketplace da Vercel); usa memória quando roda localmente

## Como funciona

1. Quem abre o site recebe uma **sessão única naquele navegador**: um id aleatório salvo no `localStorage`, sem cadastro.
2. Essa pessoa cria a sala e compartilha o link (`/sala/CODIGO`) copiando, pelo menu de compartilhar do celular ou mostrando o QR code.
3. Os convidados abrem o link, escolhem um nome e entram. Se alguém entrar com o **nome de quem já está na sala** (por exemplo, pelo celular de outra pessoa depois que a bateria acabou), a nova sessão **assume o lugar** dela, com a mesma função, vivo ou morto, e a sessão antiga sai da sala. O nome do narrador continua bloqueado.
4. O narrador (quem criou a sala, que não entra no sorteio) escolhe quantos assassinos, detetives, SAMU, espelhos e justiceiros haverá e clica em **Sortear**. O sorteio acontece no servidor com `crypto.randomInt` e lembra as **2 últimas rodadas** de cada jogador: quem tirou a mesma função nas duas tem **10× menos chance** de tirá-la pela 3ª vez seguida (um cidadão nessa situação tem mais chance de ganhar uma função especial). No longo prazo, cada um continua com a mesma chance de cada função.
5. O servidor devolve a cada jogador **somente a função dele**. Só o narrador recebe a lista com a função de todo mundo, que aparece na tela dele ao lado de cada nome.
6. **Sortear nova rodada** sorteia as funções de novo com os mesmos jogadores.
7. Durante a rodada, o narrador conduz as **noites e os dias** pelo celular:
   - **🌙 Noite:** toca em quem os assassinos atacaram, em quem o SAMU salvou e, quando ele tem vez, em quem o Justiceiro atirou. O painel mostra na hora quem vai morrer, já aplicando o Espelho e a culpa do Justiceiro. Ao tocar em **Amanhecer**, o resultado vale para todos.
   - **🪞 Espelho:** se for atacado, o ataque volta para um assassino sorteado, e ele não morre. Funciona **uma vez** por rodada; depois, morre normalmente. O SAMU pode salvar o assassino que morreria pelo reflexo.
   - **🔫 Justiceiro:** em cada noite ele tem **1 chance em 3** de ter vez, sorteada pelo servidor quando a noite começa. O narrador recebe um **pop-up** e uma lista a mais no fim do painel. Se ele acertar um assassino, continua vivo e pode ter vez de novo. Se acertar um inocente, os dois morrem (culpa). O SAMU pode salvar o alvo; nesse caso ninguém morre e não há culpa.
   - Ordem da noite: ataques (com o Espelho) → tiro do Justiceiro → SAMU salva → culpa do Justiceiro. As regras ficam em `shared/night.ts`, usado pelo servidor e pela tela do narrador.
   - **☀️ Dia:** marca quem a cidade eliminou na votação (ou ninguém) e toca em **Anoitecer**.
   - **Desfazer** volta um passo, caso tenha tocado errado. O narrador também vê o **histórico da rodada** e um aviso quando a cidade ou os assassinos vencem.
8. Todo jogador vê uma **faixa com a rodada e a fase atual** (Noite 2, Dia 2…) e, a cada nova rodada, amanhecer ou anoitecer, um **aviso em tela cheia** (com vibração, quando o celular suporta) que só some ao tocar em "Entendi". Quem estava com o celular bloqueado vê o aviso ao voltar. Quem morreu aparece riscado com 💀 na lista. Os jogadores veem só quem morreu, sem dizer como; quem foi atacado, quem o SAMU salvou, o Espelho e o Justiceiro ficam só com o narrador.
9. O narrador pode **passar a narração** tocando em 🎙️ ao lado de qualquer jogador. Essa pessoa vira o narrador (sai do sorteio e passa a ver as funções) e quem narrava entra na lista como **jogador comum**. Se houver uma rodada em andamento, ela é encerrada e todos voltam ao lobby, porque quem narrava já conhece as funções de todo mundo.

### Privacidade na tela

- A função fica escondida e só aparece **enquanto o botão "Segure para revelar" estiver pressionado**. Ao soltar, ela some.
- Ela também se esconde sozinha ao trocar de aba, bloquear a tela ou começar uma nova rodada.
- Todas as funções usam as **mesmas cores, ícones e tamanho de texto**, então quem está do lado não consegue adivinhar pela aparência.
- O tema é escuro e de pouco brilho, para não chamar atenção em uma sala com pouca luz.

## Rodando localmente

```bash
npm install
npm run dev
```

- Web: http://localhost:5173 (a porta `/api` é redirecionada para `localhost:3001`)
- Para testar com vários "jogadores" no mesmo computador, use navegadores diferentes ou janelas anônimas. Cada uma vira uma sessão.
- Para testar no celular na mesma rede Wi-Fi, abra o endereço `Network` que o Vite mostra no terminal.
- Sem variáveis de ambiente, as salas ficam em memória e somem quando o servidor reinicia. Para usar Redis localmente, copie `.env.example` para `.env` e preencha.

## Deploy na Vercel (cerca de 2 minutos)

1. Suba este repositório para o GitHub.
2. Na Vercel: **Add New → Project →** importe o repositório. O `vercel.json` já configura tudo (Vite + `/api`), então é só clicar em **Deploy**.
3. No projeto: **Storage → Create Database → Upstash (Redis) →** crie o banco no plano gratuito e **conecte ao projeto**. As variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN` (ou `UPSTASH_REDIS_REST_*`) são injetadas automaticamente.
4. **Redeploy** para que as variáveis entrem em vigor. Pronto!

> ⚠️ O Redis é necessário em produção: as funções serverless da Vercel não compartilham memória entre si, então sem ele as salas "somem" aleatoriamente.

Também dá para publicar pela CLI: `npx vercel` e depois `npx vercel --prod`.

## Estrutura

```
api/index.ts          # entrada da Vercel Function (exporta o app Express)
server/app.ts         # rotas da API
server/game.ts        # regras: sorteio, validações, códigos de sala
server/store.ts       # Redis (Upstash) ou memória
server/dev.ts         # servidor local da API
shared/night.ts       # regras da noite e da vitória (servidor + tela do narrador)
src/pages/            # Home e Sala
src/components/       # RoleReveal, HostPanel, TurnPanel, TurnHistory, PhaseBar, Announcement, SharePanel, PlayerList, JoinForm
src/components/ui/    # componentes shadcn/ui
```

### API

Todas as rotas exigem o header `x-client-id`, que identifica a sessão do navegador.

| Método | Rota                        | Quem         | Descrição                                   |
| ------ | --------------------------- | ------------ | ------------------------------------------- |
| POST   | `/api/rooms`                | qualquer um  | cria uma sala (`{ name }`)                  |
| GET    | `/api/rooms/:code`          | qualquer um  | estado da sala + funções que você pode ver   |
| POST   | `/api/rooms/:code/join`     | qualquer um  | entra na sala (`{ name }`)                  |
| POST   | `/api/rooms/:code/leave`    | jogador      | sai da sala                                 |
| POST   | `/api/rooms/:code/start`    | narrador     | sorteia as funções (`{ counts }`)           |
| POST   | `/api/rooms/:code/dawn`     | narrador     | fecha a noite (`{ attacked, saved }` = pids, `shots` = `[{ by, target }]`) |
| POST   | `/api/rooms/:code/dusk`     | narrador     | fecha o dia (`{ voted }` = pids)            |
| POST   | `/api/rooms/:code/undo`     | narrador     | desfaz o último amanhecer/anoitecer         |
| POST   | `/api/rooms/:code/reset`    | narrador     | encerra a rodada e volta ao lobby           |
| POST   | `/api/rooms/:code/kick`     | narrador     | remove um jogador (`{ pid }`)               |
| POST   | `/api/rooms/:code/transfer` | narrador     | passa a narração a um jogador (`{ pid }`)   |

As salas expiram depois de 12 horas sem alterações. Os clientes consultam o estado a cada 2,5 s, o que dá folga de sobra no plano gratuito do Upstash para uma noite de jogo.

### Logs

O servidor escreve uma linha por evento do jogo, começando com `[sala CODIGO]`: sala criada, entradas e saídas, cada sorteio com a função de todos, sequências de função repetida, noites, votações, desfazer e troca de narrador. Os erros de regra (ex.: `409 A rodada já mudou`) também aparecem. Na Vercel, abra o projeto → **Logs** e busque pelo código da sala. No plano gratuito os logs ficam disponíveis por pouco tempo (cerca de 1 hora), então confira durante ou logo depois do jogo. Localmente, eles aparecem no terminal do `npm run dev`.
