# 🌙 Sleep City

**Sleep City** é um ajudante para a brincadeira **Cidade Dorme**: uma pessoa cria a sala e compartilha o link, os amigos entram com o próprio nome, e o dono da sala sorteia **Assassinos**, **Detetives** e **SAMU**. O resto da sala fica como cidadão. Cada pessoa vê **apenas a própria função**, no próprio celular.

- **Frontend:** React 19 + Vite + Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com)
- **Backend:** Node.js + Express, publicado como Vercel Function (`api/index.ts`)
- **Estado:** Upstash Redis (pelo Marketplace da Vercel); usa memória quando roda localmente

## Como funciona

1. Quem abre o site recebe uma **sessão única naquele navegador**: um id aleatório salvo no `localStorage`, sem cadastro.
2. Essa pessoa cria a sala e compartilha o link (`/sala/CODIGO`) copiando, pelo menu de compartilhar do celular ou mostrando o QR code.
3. Os convidados abrem o link, escolhem um nome e entram.
4. O dono da sala escolhe quantos assassinos, detetives e SAMU haverá e clica em **Sortear**. O sorteio acontece no servidor com `crypto.randomInt` (Fisher–Yates).
5. O servidor devolve a cada navegador **somente a função dele**. Nem o dono da sala vê a função dos outros.
6. **Sortear nova rodada** sorteia as funções de novo com os mesmos jogadores.

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
src/pages/            # Home e Sala
src/components/       # RoleReveal, HostPanel, SharePanel, PlayerList, JoinForm
src/components/ui/    # componentes shadcn/ui
```

### API

Todas as rotas exigem o header `x-client-id`, que identifica a sessão do navegador.

| Método | Rota                        | Quem         | Descrição                                   |
| ------ | --------------------------- | ------------ | ------------------------------------------- |
| POST   | `/api/rooms`                | qualquer um  | cria uma sala (`{ name, plays }`)           |
| GET    | `/api/rooms/:code`          | qualquer um  | estado da sala + a **sua** função           |
| POST   | `/api/rooms/:code/join`     | qualquer um  | entra na sala (`{ name }`)                  |
| POST   | `/api/rooms/:code/leave`    | jogador      | sai da sala                                 |
| POST   | `/api/rooms/:code/start`    | dono         | sorteia as funções (`{ counts }`)           |
| POST   | `/api/rooms/:code/reset`    | dono         | encerra a rodada e volta ao lobby           |
| POST   | `/api/rooms/:code/kick`     | dono         | remove um jogador (`{ pid }`)               |

As salas expiram depois de 12 horas sem alterações. Os clientes consultam o estado a cada 2,5 s, o que dá folga de sobra no plano gratuito do Upstash para uma noite de jogo.
