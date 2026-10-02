import {
  Target,
  BarChart3,
  Wallet,
  FileDown,
  RefreshCw,
  Brain,
  BarChart2,
  CreditCard,
  Bell,
} from "lucide-react";

export const features = [
  {
    icon: BarChart3,
    title: "Dashboard Inteligente",
    desc: "Gráficos em tempo real com visão completa de receitas, despesas e saldo.",
    gradient: "from-brand-blue to-cyan-500",
  },
  {
    icon: Brain,
    title: "Finix IA",
    desc: "Recomendações personalizadas com inteligência artificial para economizar mais.",
    gradient: "from-brand-blue-strong to-pink-500",
  },
  {
    icon: Target,
    title: "Metas Visuais",
    desc: "Acompanhe progresso com barras animadas e alertas de prazo.",
    gradient: "from-brand-green to-emerald-500",
  },
  {
    icon: Wallet,
    title: "Orçamentos Inteligentes",
    desc: "Limites por categoria com alertas antes de ultrapassar.",
    gradient: "from-amber-500 to-orange-500",
  },
  {
    icon: RefreshCw,
    title: "Transações Recorrentes",
    desc: "Automatize despesas mensais e nunca perca um vencimento.",
    gradient: "from-cyan-500 to-brand-blue",
  },
  {
    icon: FileDown,
    title: "Exportação PDF/Excel",
    desc: "Relatórios profissionais para contador ou arquivamento pessoal.",
    gradient: "from-rose-500 to-pink-500",
  },
  {
    icon: CreditCard,
    title: "Gestão de Cartões",
    desc: "Controle faturas, limites e parcelamentos em um único lugar.",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    icon: Bell,
    title: "Alertas de Pagamento",
    desc: "Notificações de parcelas a vencer para nunca atrasar.",
    gradient: "from-orange-500 to-red-500",
  },
  {
    icon: BarChart2,
    title: "Calendário Financeiro",
    desc: "Visualize receitas e despesas por dia em uma view de calendário.",
    gradient: "from-teal-500 to-cyan-600",
  },
];

export const faqs = [
  {
    q: "O plano gratuito tem limite de tempo?",
    a: "O plano FREE dá acesso à dashboard básica. Você pode testar qualquer plano pago por 7 dias sem cartão de crédito.",
  },
  {
    q: "Posso cancelar a qualquer momento?",
    a: "Sim. Sem fidelidade e sem taxa de cancelamento. Você cancela com 1 clique nas configurações da conta.",
  },
  {
    q: "Os dados são seguros?",
    a: "Sim. Todas as senhas são criptografadas com bcrypt e autenticação via JWT. Seus dados financeiros ficam apenas no banco de dados privado.",
  },
  {
    q: "Funciona para empresas?",
    a: "O plano Pro foi desenvolvido para pequenas empresas, com DRE gerencial, centros de custo e suporte prioritário.",
  },
  {
    q: "Posso importar extratos do banco?",
    a: "Sim. O Finix suporta importação de arquivos OFX, XLS, CSV e PDF gerados pelos principais bancos brasileiros.",
  },
  {
    q: "A IA é realmente personalizada?",
    a: "Sim. O Finix IA analisa seus dados reais para gerar insights específicos para o seu perfil financeiro.",
  },
];

export const testimonials = [
  {
    name: "Rafael Mendes",
    role: "Designer · SP",
    text: "O Finix mudou meu jogo. Em 3 meses economizei R$ 4.200 só descobrindo para onde meu dinheiro ia.",
    color: "#2563EB",
    saving: "R$ 4.200 economizados",
  },
  {
    name: "Marina Costa",
    role: "Engenheira · RJ",
    text: "O Finix IA foi impressionante. Identificou que eu gastava demais com delivery e me ajudou a cortar 40%.",
    color: "#7C3AED",
    saving: "40% menos em delivery",
  },
  {
    name: "Lucas Almeida",
    role: "Dev · BH",
    text: "Finalmente um app de finanças bonito e rápido. Os gráficos e as metas me mantêm motivado todo mês.",
    color: "#22C55E",
    saving: "3 metas atingidas",
  },
  {
    name: "Patrícia Soares",
    role: "Empreendedora · RJ",
    text: "A exportação em PDF e Excel salvou meu relatório mensal e facilitou a apresentação ao meu contador.",
    color: "#F97316",
    saving: "8h/mês economizadas",
  },
  {
    name: "Guilherme Rocha",
    role: "Consultor · SP",
    text: "O recurso de metas me fez economizar para uma viagem em apenas 4 meses. Recomendo demais.",
    color: "#EC4899",
    saving: "Viagem em 4 meses",
  },
];
