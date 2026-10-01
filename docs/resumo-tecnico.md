# Finix — Resumo Técnico

## O que é?

Sistema SaaS de gestão financeira onde o usuário controla receitas, despesas, metas, cartões, orçamentos e recebe dashboards e insights financeiros.

## Principais funcionalidades

- Login (e-mail ou Google) com 2FA opcional
- Controle de receitas e despesas
- Parcelamento automático
- Metas e orçamentos
- Dashboard financeiro com previsão de saldo
- Exportação PDF/Excel/CSV/OFX
- Pagamentos via Stripe
- Painel Admin

## Stack

**Frontend:** React + TypeScript, Vite, React Router, Axios, React Hook Form, Tailwind CSS, Recharts, Framer Motion + GSAP, Three.js

**Backend:** Express, Prisma, PostgreSQL, Zod, JWT, bcrypt, Stripe

**Qualidade:** Vitest (testes unitários), ESLint, GitHub Actions (CI)

## Arquitetura

São 2 serviços:

```
React (Vercel)
   ↓
Express API (Render)
   ↓
PostgreSQL (Neon)
```

- **Frontend:** interface do usuário.
- **Express:** toda a regra de negócio — autenticação, CRUD, dashboard, relatórios, Stripe e admin.

A API é organizada por domínio: `routes/` (um arquivo por área), `services/` (regras de negócio), `middlewares/` (autenticação, paywall, rate limit) e `lib/` (datas, dinheiro, uploads).

## Fluxo de login

1. Usuário faz login.
2. Backend valida a senha com bcrypt (e o código 2FA, se ativado).
3. Gera um token de acesso (JWT, 15 minutos) e um refresh token (30 dias).
4. Frontend salva os dois.
5. O Axios envia o token em todas as requisições; quando ele expira, o interceptor troca o refresh token por um novo token e repete a requisição, sem deslogar o usuário.

## Banco de dados

Entidades principais: User, Transaction, Installment, Account, CreditCard, Goal, Budget, Category, PaymentTransaction.

## Parcelamento

Ao invés de guardar apenas "12x", o sistema cria:

- 1 registro de parcelamento
- 12 transações futuras

Assim fica muito mais fácil controlar vencimentos, gráficos e fluxo de caixa. A criação é atômica (ou grava tudo, ou nada) e a divisão é feita em centavos: o que sobra vai para a última parcela.

## Segurança

- JWT para autenticação, com renovação por refresh token.
- bcrypt para senhas.
- Zod valida todas as entradas.
- Helmet e CORS com lista exata de origens.
- Rate limit nas rotas de login e cadastro.
- Google OAuth.
- Paywall validado no backend.
- API keys somente leitura.
- Webhooks do usuário não podem apontar para endereços internos (proteção contra SSRF).
- Uploads com limite de tamanho e tipos permitidos.

Nunca confia no frontend.

## Stripe

```
Usuário → Checkout → Pagamento → Webhook → Plano atualizado
```

- O plano só muda quando o webhook assinado do Stripe chega.
- Renovação estende a validade do plano; cancelamento mantém o plano até o fim do período já pago.
- Se um webhook de renovação se perder, a API confere a assinatura direto no Stripe antes de bloquear o usuário.

## Frontend

Organizado em Pages, Components, Contexts, Hooks e Services.

- Context API para autenticação
- React Router para proteger rotas
- Axios Interceptors para enviar e renovar o token automaticamente

## Decisões importantes (isso entrevista adora)

### Gateway removido

O projeto começou com um gateway FastAPI na frente do Express, só para o Stripe.

- **Por que existia:** o pagamento já funcionava em Python.
- **Por que saiu:** era mais uma camada, um deploy mais complexo e duas integrações Stripe diferentes para manter. O Stripe foi unificado no Express.

### Dashboard

Os totais e o gasto por categoria são agregados pelo banco (`groupBy`/`aggregate`), em vez de carregar todas as transações em memória.

O frontend calcula, a partir desses totais:

- Score financeiro
- Reserva financeira
- Taxa de economia

### Paywall

As permissões ficam no backend. Mesmo usando Postman ou curl o usuário não consegue acessar funções do plano Pro. O que vale é o "plano efetivo": trial de 7 dias, plano pago dentro da validade ou Grátis.

### Datas e dinheiro

- Datas de transação são datas de calendário (meia-noite UTC); "hoje" e "mês atual" são calculados no horário de Brasília.
- Somas são feitas em centavos inteiros para não acumular erro de ponto flutuante.

### Prisma

Foi escolhido porque:

- ORM moderno.
- Tipagem automática.
- Migrations.
- Evita muitos erros em tempo de desenvolvimento.

## Dívidas técnicas

- Valores ainda são `Float` no banco (o ideal é `Decimal`).
- Imagens ficam no banco em base64 (o ideal é um storage de arquivos).
- Rate limit em memória (com mais de uma instância, precisa de Redis).
- Faltam testes de integração das rotas.
