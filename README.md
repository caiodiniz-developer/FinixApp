Finix — Resumo Técnico
O que é?

Sistema SaaS de gestão financeira onde o usuário controla receitas, despesas, metas, cartões, orçamentos e recebe dashboards e insights financeiros.

Principais funcionalidades

Login (e-mail ou Google)
Controle de receitas e despesas
Parcelamento automático
Metas e orçamentos
Dashboard financeiro
Exportação PDF/Excel
Pagamentos via Stripe
Painel Admin
Stack
Frontend
React + TypeScript
Vite
React Router
Axios
React Hook Form
Tailwind CSS
Recharts
Framer Motion + GSAP
Three.js
Backend
Express
Prisma
PostgreSQL
Zod
JWT
bcrypt
Stripe
Gateway
FastAPI
httpx
Arquitetura

São 3 serviços:

React
↓
FastAPI (Gateway)
↓
Express API
↓
PostgreSQL
Papel de cada um

Frontend

Interface do usuário.

Gateway (FastAPI)

Recebe todas as requisições.
Gerencia Stripe.
Encaminha as outras requisições para o Express.

Express

Toda regra de negócio.
Autenticação.
CRUD.
Dashboard.
Relatórios.
Admin.
Fluxo de Login
Usuário faz login.
Backend valida senha com bcrypt.
Gera JWT.
Frontend salva o token.
Axios envia automaticamente o token em todas as requisições.
Banco de Dados

Entidades principais:

User
Transaction
Installment
Account
CreditCard
Goal
Budget
Category
PaymentTransaction
Parcelamento

Ao invés de guardar apenas "12x":

O sistema cria:

1 registro de parcelamento
12 transações futuras

Assim fica muito mais fácil controlar vencimentos, gráficos e fluxo de caixa.

Segurança
JWT para autenticação.
bcrypt para senhas.
Zod valida todas as entradas.
Helmet e CORS.
Rate Limit.
Verificação de e-mail.
Google OAuth.
Paywall validado no backend.

Nunca confia no frontend.

Stripe

Fluxo:

Usuário
↓

Checkout

↓

Pagamento

↓

Webhook

↓

Plano atualizado

O backend garante que o plano seja atualizado apenas uma vez (idempotência).

Frontend

Organizado em:

Pages
Components
Contexts
Hooks
Services

Usa:

Context API para autenticação
React Router para proteger rotas
Axios Interceptors para adicionar o JWT automaticamente
Decisões importantes (isso entrevista adora)
Gateway separado

Foi mantido porque Stripe já funcionava em Python.

Vantagem:

Não precisou reescrever pagamento.

Desvantagem:

Mais uma camada.
Deploy mais complexo.
Dashboard

O backend envia dados "crus".

O frontend calcula:

Score financeiro
Reserva financeira
Taxa de economia

Assim o backend fica mais simples.

Paywall

As permissões ficam no backend.

Mesmo usando Postman ou curl o usuário não consegue acessar funções do plano Pro.

Prisma

Foi escolhido porque:

ORM moderno.
Tipagem automática.
Migrations.
Evita muitos erros em tempo de desenvolvimento.
Dívidas técnicas

Você pode comentar isso numa entrevista.

server.ts muito grande (~3000 linhas)
Gateway e Express dividindo Stripe
Refresh Token implementado mas não usado pelo frontend
Rate Limit em memória (ideal seria Redis)
Algumas rotas antigas ainda existem e precisam ser removidas

Mostrar que você sabe reconhecer essas melhorias costuma contar pontos.

O que falar em 1 minuto para um recrutador

"O Finix é um SaaS de gestão financeira desenvolvido com React, TypeScript, Express, Prisma e PostgreSQL. A arquitetura possui um frontend React, uma API Express responsável por toda a regra de negócio e um gateway FastAPI que gerencia o Stripe e encaminha as requisições para o backend principal. A autenticação utiliza JWT e bcrypt, as entradas são validadas com Zod e o banco é acessado pelo Prisma. O sistema possui controle de transações, parcelamentos, metas, orçamentos, dashboard financeiro, exportação de relatórios, integração com Stripe e um painel administrativo. Durante o desenvolvimento também considerei trade-offs de arquitetura e identifiquei pontos de melhoria, como modularizar melhor o backend e unificar a integração de pagamentos."

Se você dominar esses tópicos e entender o código relacionado a cada um, já terá uma base sólida para explicar o projeto de forma técnica em uma entrevista.
