# Finix

SaaS de gestão financeira pessoal e para pequenos negócios: receitas, despesas, parcelamentos, cartões, metas, orçamentos, dívidas, investimentos e um painel com previsões e insights.

- **Site:** https://www.finixapp.com.br
- **Frontend:** React + TypeScript + Vite (Vercel)
- **API:** Express + TypeScript + Prisma (Render)
- **Banco:** PostgreSQL (Neon)

## Estrutura

```
frontend/      SPA em React
backend-ts/    API em Express
  prisma/        schema do banco
  src/
    server.ts      ponto de entrada (conexão, admin, jobs, shutdown)
    app.ts         montagem do Express (CORS, rotas, tratamento de erros)
    config/        variáveis de ambiente e definição dos planos
    routes/        um arquivo de rotas por domínio (transações, cartões, metas...)
    services/      regras de negócio (parcelas, Stripe, previsão, impostos...)
    middlewares/   autenticação, paywall e rate limit
    lib/           utilitários (datas, dinheiro, uploads, proteção SSRF)
  tests/         testes unitários (vitest)
docs/          resumo técnico do projeto
.github/workflows/  CI e agendamento diário
```

## Rodando localmente

Pré-requisitos: Node.js 22+ e um PostgreSQL (local ou um banco gratuito no [Neon](https://neon.tech)).

### 1. API

```bash
cd backend-ts
npm install
cp .env.example .env        # preencha DATABASE_URL e JWT_SECRET
npx prisma db push          # cria as tabelas
npm run dev                 # http://localhost:8000
```

No primeiro boot é criado o usuário administrador com `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Em desenvolvimento, sem `ADMIN_PASSWORD`, a senha é `Admin@123`.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:8000
npm run dev                 # http://localhost:3000
```

## Comandos

| Onde | Comando | O que faz |
| --- | --- | --- |
| `backend-ts` | `npm run dev` | API com recarga automática |
| `backend-ts` | `npm test` | testes unitários |
| `backend-ts` | `npm run test:integration` | testes das rotas contra um PostgreSQL local descartável (`TEST_DATABASE_URL`) |
| `backend-ts` | `npm run typecheck` | checagem de tipos |
| `backend-ts` | `npm run build` / `npm start` | compila para `dist/` e roda |
| `backend-ts` | `npm run db:push` | aplica o `schema.prisma` no banco |
| `backend-ts` | `npm run db:studio` | abre o Prisma Studio |
| `frontend` | `npm run dev` | app em modo desenvolvimento |
| `frontend` | `npm run lint` | ESLint |
| `frontend` | `npm test` | testes unitários |
| `frontend` | `npm run build` | checa tipos e gera o bundle |

## Variáveis de ambiente

Todas estão documentadas em [backend-ts/.env.example](backend-ts/.env.example) e [frontend/.env.example](frontend/.env.example). Apenas `DATABASE_URL` e `JWT_SECRET` são obrigatórias; Stripe, e-mail (Gmail), login Google, push, Open Finance e IA ficam desligados quando não configurados.

Em produção, defina também:

- `NODE_ENV=production`
- `FRONTEND_URL` com o endereço do site
- `ADMIN_PASSWORD` com uma senha forte
- `GMAIL_USER` e `GMAIL_REFRESH_TOKEN`, se quiser os lembretes de vencimento por e-mail (ver "E-mail")
- `CRON_SECRET` (ver "Jobs agendados")

## Deploy

- **Frontend (Vercel):** diretório `frontend`, comando `npm run build`, variável `VITE_API_URL` apontando para a API.
- **API (Render):** diretório `backend-ts`, build `npm install && npm run build`, start `npm start`.
- **Banco:** toda mudança em `prisma/schema.prisma` precisa de `npx prisma db push` contra o banco de produção **antes** de publicar o código que depende dela.
- **Stripe:** crie um endpoint de webhook para `https://SUA-API/api/stripe/webhook` com os eventos `checkout.session.completed`, `invoice.payment_succeeded` e `customer.subscription.deleted`, e coloque o segredo em `STRIPE_WEBHOOK_SECRET`.

Cada push na `main` dispara o CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)): tipos e testes da API; lint, testes e build do frontend.

## E-mail

O único e-mail que a API envia hoje é o lembrete de vencimento. Ele sai de uma conta Gmail (`GMAIL_USER`). O plano gratuito do Render bloqueia as portas SMTP, então em produção o envio usa a **API do Gmail por HTTPS**:

1. No Google Cloud Console (mesmo projeto do login com Google): ative a **Gmail API** e, no cliente OAuth, adicione o redirect `https://SUA-API/google/gmail/callback`.
2. Na tela de consentimento OAuth, deixe o app **Em produção** (em modo de teste o token expira em 7 dias).
3. Abra `https://SUA-API/google/gmail/connect`, entre com a conta de `GMAIL_USER` e autorize.
4. Copie o token mostrado para a variável `GMAIL_REFRESH_TOKEN` no servidor.

`GET /health` mostra o estado em `email`: `ok`, `not_configured`, `auth_failed` ou `connection_failed`.

Em desenvolvimento local dá para usar só `GMAIL_APP_PASSWORD` (SMTP com senha de app).

## Jobs agendados

Uma vez por dia a API cria as transações recorrentes vencidas e envia os lembretes (vencimentos e compras por impulso). Ela roda isso sozinha no boot e a cada 24h, mas em hospedagem que suspende instâncias ociosas esse timer não é confiável. Por isso existe o endpoint:

```
POST /api/cron/run-jobs
Authorization: Bearer <CRON_SECRET>
```

O workflow [daily-jobs.yml](.github/workflows/daily-jobs.yml) chama esse endpoint todo dia às 06:00 (Brasília). Para ativá-lo, cadastre os secrets `API_URL` e `CRON_SECRET` no repositório do GitHub. Os jobs são idempotentes: rodar mais de uma vez no dia não duplica nada.

## Como funciona

### Autenticação

- Login por e-mail e senha (bcrypt) ou com Google. O cadastro não tem etapa de confirmação de e-mail: a conta já nasce ativa e a pessoa é levada para o login.
- 2FA opcional por aplicativo autenticador (TOTP), com códigos de backup.
- A API emite um token de acesso de 15 minutos e um refresh token de 30 dias. O frontend renova o token de acesso automaticamente quando ele expira.
- Integrações externas podem usar API keys (`X-Api-Key`), que são **somente leitura**.

### Planos

Definidos em [backend-ts/src/config/plans.ts](backend-ts/src/config/plans.ts). O que vale para cada requisição é o **plano efetivo**:

- conta Grátis nova tem os limites do Básico por 7 dias (trial);
- plano pago vencido (`planExpiresAt` + 3 dias de tolerância) volta a contar como Grátis — antes disso a API confere a assinatura no Stripe, para não bloquear quem está pagando por causa de um webhook perdido;
- cancelar a assinatura mantém o plano até o fim do período já pago.

Os limites são sempre verificados na API; o frontend só esconde o que o plano não permite.

### Parcelamento

Uma compra em 12x cria 1 registro de parcelamento e 12 transações, uma por mês, na data de vencimento. Os centavos que sobram da divisão vão para a última parcela, e um vencimento no dia 31 cai no último dia dos meses mais curtos.

### Datas e dinheiro

- Datas de transação são datas de calendário guardadas como meia-noite UTC. "Hoje" e "mês atual" são calculados no fuso `APP_TIMEZONE` (Brasília por padrão).
- Somas de valores são feitas em centavos inteiros ([lib/money.ts](backend-ts/src/lib/money.ts)) para não acumular erro de ponto flutuante.

## Pendências conhecidas

- Os valores ainda são colunas `Float` no banco; a migração para `Decimal` exige uma janela de manutenção e teste contra uma cópia dos dados reais.
- Fotos, logos e comprovantes ficam no banco como base64 (reduzidos no navegador antes do envio). O ideal é movê-los para um storage de arquivos (S3, R2, Cloudinary).
- O rate limit é em memória, por instância. Com mais de uma instância da API, precisa de um armazenamento compartilhado (Redis).
- As páginas `Landing`, `Profile` e `Dashboard` do frontend já tiveram componentes e hooks extraídos, mas ainda têm entre 800 e 1000 linhas cada.
