# Finix — Plataforma de Gestão Financeira Pessoal/PJ

Finix é uma aplicação SaaS full-stack de controle financeiro (estilo "Mint/Organizze"), com planos pagos, insights automáticos, calendário de fluxo de caixa, orçamentos, metas, parcelamentos e um painel administrativo. Este README descreve a arquitetura e as decisões técnicas do projeto para quem for avaliar o código.

## Visão geral

O usuário cria conta, verifica o e-mail, passa por um onboarding (pessoal ou empresarial) e cai em um dashboard com saúde financeira, fluxo de caixa, categorias de gastos, orçamentos, metas e alertas de vencimento. Existem três planos (`FREE`, `BASIC`, `PRO`) que liberam progressivamente: transações ilimitadas, parcelamento, relatórios em PDF/Excel, categorias customizadas, análise por IA e um painel white-label (logo/cor da empresa). Um plano `ADMIN` acessa um painel para gerenciar usuários e ver métricas globais de receita.


- **Frontend** (`frontend/`): SPA em React 18 + TypeScript, roteada por página (`react-router-dom`), consumindo a API via Axios com interceptor de JWT.
- **Gateway** (`backend/server.py`): um processo **FastAPI** que fica na borda pública. Ele:
  - sobe o backend TypeScript como **subprocesso filho** e faz *health-check* até ele responder;
  - implementa a integração com o **Stripe Checkout** e o webhook de pagamento (a lib `emergentintegrations` abstrai a criação de sessão de checkout);
  - faz **proxy reverso transparente** de qualquer outra rota `/api/*` para o backend TypeScript, repassando headers e corpo da requisição.
- **Core API** (`backend-ts/`): a aplicação de negócio de fato — **Express + Prisma + PostgreSQL**, com toda a lógica de autenticação, transações, metas, orçamentos, parcelamentos, alertas, exportação de relatórios (PDFKit/ExcelJS), insights (heurísticas locais + chamada opcional a um LLM) e administração.

## Stack técnica

| Camada | Tecnologias |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router 6, Axios, React Hook Form + Yup, Recharts, Framer Motion, GSAP, Three.js |
| Gateway | Python 3, FastAPI, httpx (cliente async), Stripe Checkout |
| Backend core | Node.js, Express, TypeScript, Prisma ORM, Zod (validação), JWT (`jsonwebtoken`), bcrypt, Multer, PDFKit, ExcelJS, Nodemailer/Resend |
| Banco de dados | PostgreSQL (Neon), gerenciado via migrations do Prisma |
| Autenticação | JWT stateless (Bearer) + login social Google OAuth |
| Pagamentos | Stripe (Checkout Session + Webhooks assinados) |
| Infra | Frontend na Vercel, backend no Render |

## Por que um gateway em frente ao backend?

Esse é o ponto de arquitetura mais incomum do projeto e vale explicar o raciocínio: o histórico do produto começou com um protótipo em FastAPI e evoluiu para uma API mais robusta em Express/Prisma. Em vez de reescrever toda a camada de pagamentos, o FastAPI foi mantido como **gateway de borda** responsável só por Stripe (checkout, status, webhook), enquanto o restante das rotas de negócio passou a viver no backend TypeScript e é **repassado via proxy HTTP** (`httpx`) route por route (`/api/{full_path:path}`).

Trade-off consciente: isso introduz um hop de rede a mais e acopla o deploy (o Python sobe o Node como subprocesso e monitora sua saúde). Em uma reescrita, a opção mais limpa seria mover o fluxo de Stripe para dentro do próprio Express (que já importa o SDK `stripe` e já tem um handler de webhook em `backend-ts/src/server.ts`) e aposentar o gateway Python — ver [Limitações conhecidas](#limitações-conhecidas-e-próximos-passos).

## Autenticação e autorização

- Cadastro com verificação de e-mail obrigatória (código enviado por e-mail antes de liberar login) e login social via Google OAuth.
- Login emite um **JWT assinado** (`JWT_SECRET`, expiração de 7 dias) contendo `sub` (id do usuário), `email` e `role`; o frontend guarda o token em `localStorage`/`sessionStorage` conforme "lembrar de mim" e o envia como `Authorization: Bearer`.
- Middleware `authenticate` no Express valida o token, carrega o usuário do banco a cada requisição (permite bloquear usuários e resetar contadores mensais em tempo real) e injeta `req.user`.
- Middleware `requireAdmin` protege rotas administrativas; `requireFeature("hasAI" | "hasPDF" | ...)` é uma factory que lê a tabela de planos (`PLANS`) e devolve `403` com `{ upgrade: true }` quando o plano do usuário não tem aquele recurso — é assim que o paywall é reforçado no servidor (não só escondendo botão no frontend).
- Rotas internas (`/internal/*`, chamadas só pelo gateway Python para atualizar plano após pagamento) são protegidas por um header `x-internal-secret` compartilhado, e não por JWT de usuário.

## Modelo de dados

Schema Prisma (`backend-ts/prisma/schema.prisma`) com PostgreSQL. Principais entidades e relações:

- `User` — dono de tudo; guarda plano, uso mensal de transações (`transactionsUsed`/`transactionsMonth`, resetado automaticamente no primeiro request do novo mês), dados de whitelabel (`companyName`, `companyLogo`, `primaryColor`) e status de verificação/OAuth.
- `Transaction` — receita/despesa; pode pertencer a um `Installment` (parcelamento) via `installmentId`, guardando `installmentNumber`/`totalInstallments` para reconstruir a fatura.
- `Installment` — parcelamento (ex.: compra em 12x), gera N `Transaction`s automaticamente com data de vencimento ajustada para meses mais curtos (`getSafeDueDay`).
- `Goal`, `Budget`, `Category`, `FinancialAlert` — metas, orçamentos por categoria, categorias customizáveis e alertas persistentes (ex.: cobrança de cartão próxima do vencimento).
- `PaymentTransaction` / `Subscription` — rastreiam o ciclo de vida de um pagamento Stripe de forma idempotente (o webhook e o polling de status só promovem o plano do usuário uma vez).

## Planos, paywall e billing (Stripe)

Os planos (`FREE`, `BASIC`, `PRO`, e um `TEST` interno) são definidos como uma constante tipada no backend (`PLANS`, em `backend-ts/src/server.ts`), nunca calculados a partir do que o frontend envia — os preços usados no Stripe Checkout também vêm dessa constante no gateway (`backend/server.py`), por segurança. Cada plano define limites (`transactionsLimit`, `goalsLimit`, `categoriesLimit`, ...) e *feature flags* (`hasAI`, `hasPDF`, `canUseAlerts`, ...), checados nos middlewares de rota.

Fluxo de upgrade:
1. Frontend chama `POST /api/checkout/session` com o `plan_id`.
2. Gateway valida o plano contra a lista fechada, cria uma Stripe Checkout Session e grava uma `PaymentTransaction` "pending" via chamada interna ao backend TS.
3. Ao confirmar o pagamento (webhook `checkout.session.completed` **ou** polling de `GET /api/checkout/status/:id`, o que chegar primeiro), o backend promove `user.plan` e define `planExpiresAt` — de forma idempotente, checando se o status local já era `paid` antes de reprocessar.

## Principais funcionalidades

- **Dashboard**: saúde financeira (score calculado a partir de índice de gastos, taxa de poupança e saúde dos orçamentos), fluxo de caixa dos últimos 6 meses, distribuição por categoria, ritmo de gastos diário, projeção de saldo até o fim do mês, runway de reserva, mapa de calor de gastos por dia, orçamentos, metas e transações recentes — tudo em uma única chamada agregada (`GET /api/dashboard`) mais chamadas paralelas para widgets secundários.
- **Transações**: CRUD com filtros (tipo, categoria, busca, intervalo de datas), parcelamento automático (gera as N transações futuras de uma vez) e métodos de pagamento (pix/débito/crédito).
- **Alertas financeiros**: combina alertas persistentes no banco com alertas computados on-the-fly (parcelas e cobranças de cartão vencendo nos próximos 7 dias).
- **Calendário**: agregação diária de receita/despesa/saldo líquido do mês.
- **Metas e orçamentos**: acompanhamento de progresso com limites por plano.
- **Insights**: heurísticas locais (ex.: "gastos concentrados em uma categoria", "saldo negativo") sempre disponíveis no plano pago, com fallback para uma chamada a um LLM quando configurado.
- **Exportação**: relatórios em PDF (PDFKit) e Excel (ExcelJS) gerados sob demanda, gated por plano.
- **Onboarding & whitelabel**: fluxo pessoal vs. empresarial; empresas podem subir logo e cor primária, aplicados via CSS custom property (`--brand-primary`) no restante do app.
- **Admin**: listagem/edição/bloqueio de usuários, métricas agregadas (receita total, distribuição de planos, volume de transações).

## Estrutura de pastas

```
FInixApp/
├── frontend/                 # SPA React + Vite
│   └── src/
│       ├── pages/            # Uma página por rota (Dashboard, Transactions, Goals, Admin...)
│       ├── layouts/AppLayout.tsx   # Shell autenticado: sidebar, widgets, quick-add
│       ├── contexts/         # AuthContext (sessão/JWT) e ThemeContext (tema público/dashboard)
│       ├── services/api.ts   # Instância Axios com interceptors de auth e logging
│       └── types.ts          # Tipos compartilhados do domínio
├── backend/                  # Gateway FastAPI (Stripe + proxy)
│   └── server.py
├── backend-ts/                # API core (Express + Prisma)
│   ├── src/server.ts         # Grande parte das rotas de negócio + tabela de planos
│   ├── src/controllers|services|routes/  # Fluxo de auth (signup, login, OAuth Google, tokens)
│   └── prisma/schema.prisma  # Modelo de dados
└── README.md
```

## Deploy

- **Frontend**: Vercel (`frontend/vercel.json`), build via Vite, rewrite de SPA para `index.html`.
- **Backend**: Render, rodando o gateway FastAPI que por sua vez inicia o processo Node do backend core.
- **Banco**: PostgreSQL gerenciado (Neon).