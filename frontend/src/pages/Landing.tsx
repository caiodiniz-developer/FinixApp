import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  AnimatePresence,
} from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Target,
  TrendingUp,
  BarChart3,
  Sparkles,
  Wallet,
  FileDown,
  RefreshCw,
  Brain,
  Star,
  Quote,
  ChevronRight,
  ChevronLeft,
  Play,
  ShieldCheck,
  Clock,
  PiggyBank,
  Loader2,
  Crown,
  Zap,
  Globe,
  Lock,
  BarChart2,
  CreditCard,
  Bell,
  ChevronDown,
  MessageCircle,
  Mail,
  Phone,
  Send,
} from "lucide-react";
import { Logo } from "../components/Logo";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../services/api";

function useCountUp(to: number, duration = 1.6, start = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / (duration * 1000));
      setVal(Math.floor(to * (0.5 - Math.cos(Math.PI * p) / 2)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, start]);
  return val;
}

function StatCounter({
  value,
  label,
  suffix = "",
  prefix = "",
}: {
  value: number;
  label: string;
  suffix?: string;
  prefix?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const n = useCountUp(value, 1.8, inView);
  return (
    <div ref={ref} className="text-center">
      <div className="text-4xl sm:text-5xl font-display font-extrabold bg-gradient-to-br from-brand-blue via-brand-purple to-brand-green bg-clip-text text-transparent tabular-nums">
        {prefix}
        {n.toLocaleString("pt-BR")}
        {suffix}
      </div>
      <div className="text-sm text-muted mt-2">{label}</div>
    </div>
  );
}

const features = [
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
    gradient: "from-brand-purple to-pink-500",
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

const faqs = [
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

export default function Landing() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -60]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.35], [1, 0.2]);
  const { user } = useAuth();
  const nav = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({
    nome: "",
    email: "",
    empresa: "",
    mensagem: "",
  });
  const [sendingContact, setSendingContact] = useState(false);
  const handleCheckout = async (planId: string) => {
    if (!user) {
      toast.error("Faça login para continuar");
      nav("/login");
      return;
    }
    try {
      setLoadingPlan(planId);
      const { data } = await api.post("/api/stripe/checkout", { plan_id: planId });
      window.location.href = data.url;
    } catch (e) {
      toast.error(apiErrorMessage(e) || "Erro ao processar pagamento");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleContactSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!contactForm.nome || !contactForm.email) {
      toast.error("Preencha nome e email");
      return;
    }
    setSendingContact(true);
    const msg = `Olá! Tenho interesse no Finix.%0A%0ANome: ${contactForm.nome}%0AEmail: ${contactForm.email}%0AEmpresa: ${contactForm.empresa}%0AMensagem: ${contactForm.mensagem}`;
    window.open(`https://wa.me/5519994737425?text=${msg}`, "_blank");
    toast.success("Redirecionando para o WhatsApp!");
    setContactForm({ nome: "", email: "", empresa: "", mensagem: "" });
    setSendingContact(false);
  };

  return (
    <div className="min-h-screen bg-surface overflow-x-hidden">
      {/* Progress bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-blue via-brand-purple to-brand-green origin-left z-50"
        style={{ scaleX: scrollYProgress }}
      />

      {/* Nav - fundo branco, pill branca com borda sutil */}
      <div className="sticky top-0 z-40 bg-surface border-b border-border py-3 px-4">
        <nav className="max-w-7xl mx-auto">
          <div className="bg-surface rounded-2xl border border-border px-4 py-2.5 flex items-center justify-between shadow-sm">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Logo />
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="hidden md:flex items-center gap-0.5 text-sm text-text"
            >
              <a
                href="#features"
                className="px-3 py-1.5 rounded-lg hover:bg-surface transition font-medium"
              >
                Funcionalidades
              </a>
              <a
                href="#testimonials"
                className="px-3 py-1.5 rounded-lg hover:bg-surface transition font-medium"
              >
                Depoimentos
              </a>
              <a
                href="#pricing"
                className="px-3 py-1.5 rounded-lg hover:bg-surface transition font-medium"
              >
                Planos
              </a>
              <a
                href="#faq"
                className="px-3 py-1.5 rounded-lg hover:bg-surface transition font-medium"
              >
                FAQ
              </a>
              <a
                href="#contact"
                className="px-3 py-1.5 rounded-lg hover:bg-surface transition font-medium"
              >
                Contato
              </a>
              <span className="text-muted mx-1">·</span>
              <a
                href="#features"
                className="px-3 py-1.5 rounded-lg hover:bg-surface transition font-medium flex items-center gap-1"
              >
                Recursos <ChevronDown className="w-3.5 h-3.5" />
              </a>
              <a
                href="#features"
                className="px-3 py-1.5 rounded-lg hover:bg-surface transition font-medium"
              >
                Institucional
              </a>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2"
            >
              <Link
                to="/login"
                className="hidden sm:inline-flex px-4 py-1.5 text-sm font-semibold text-text hover:bg-surface rounded-lg transition"
              >
                Entrar
              </Link>
              <Link
                to="/register"
                className="bg-black text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-slate-900 transition"
              >
                Teste Grátis!
              </Link>
            </motion.div>
          </div>
        </nav>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <motion.div
          className="absolute -top-32 -left-32 w-[38rem] h-[38rem] rounded-full blur-3xl opacity-30 hidden md:block"
          style={{
            background: "radial-gradient(circle, #2563EB, transparent 60%)",
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.35, 0.25] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-10 -right-32 w-[34rem] h-[34rem] rounded-full blur-3xl opacity-30 hidden md:block"
          style={{
            background: "radial-gradient(circle, #7C3AED, transparent 60%)",
          }}
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.35, 0.25, 0.35] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-0 left-1/3 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-25 hidden md:block"
          style={{
            background: "radial-gradient(circle, #22C55E, transparent 60%)",
          }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-24 pb-16 sm:pb-32 grid lg:grid-cols-2 gap-8 lg:gap-14 items-center"
        >
          <div className="order-2 lg:order-1">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="chip bg-gradient-to-r from-brand-blue/10 to-brand-purple/10 text-brand-blue mb-5 border border-brand-blue/20 backdrop-blur w-fit"
            >
              <Sparkles className="w-3.5 h-3.5" /> Powered por Finix IA
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="text-3xl sm:text-4xl lg:text-6xl font-display font-extrabold leading-[1.1] sm:leading-[1.05] tracking-tight"
            >
              Controle suas finanças como um{" "}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-brand-blue via-brand-purple to-brand-green bg-clip-text text-transparent">
                  PROFISSIONAL
                </span>
                <motion.span
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ delay: 0.8, duration: 0.6 }}
                  className="absolute -bottom-1 left-0 h-1 bg-gradient-to-r from-brand-blue via-brand-purple to-brand-green rounded-full"
                />
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-5 text-base sm:text-lg text-muted max-w-xl leading-relaxed"
            >
              O painel financeiro mais completo do Brasil. Dashboard premium,
              Finix IA, metas, orçamentos, calendário financeiro e muito mais.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3"
            >
              <Link
                to="/register"
                className="btn-primary !px-6 sm:!px-7 !py-3 sm:!py-3.5 text-sm sm:text-base group w-full sm:w-auto justify-center"
              >
                Começar grátis
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#preview"
                className="btn-outline !px-6 sm:!px-7 !py-3 sm:!py-3.5 text-sm sm:text-base group w-full sm:w-auto justify-center"
              >
                <Play className="w-4 h-4 group-hover:scale-110 transition" />{" "}
                Ver demonstração
              </a>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-8 flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 sm:gap-5 text-xs sm:text-sm text-muted"
            >
              {[
                { icon: CheckCircle2, text: "Sem cartão de crédito" },
                { icon: ShieldCheck, text: "Criptografia bcrypt + JWT" },
                { icon: Clock, text: "Configure em 1 minuto" },
              ].map((t) => (
                <div key={t.text} className="flex items-center gap-1.5">
                  <t.icon className="w-4 h-4 text-brand-green flex-shrink-0" />{" "}
                  {t.text}
                </div>
              ))}
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65 }}
              className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4"
            >
              <div className="flex -space-x-2">
                {[
                  "#F59E0B",
                  "#2563EB",
                  "#7C3AED",
                  "#22C55E",
                  "#EC4899",
                  "#FB7185",
                  "#F97316",
                ].map((c, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full ring-2 ring-white flex items-center justify-center text-white font-bold text-xs"
                    style={{ background: c }}
                  >
                    {["R", "M", "A", "L", "C", "S", "P"][i]}
                  </div>
                ))}
              </div>
              <div className="text-sm">
                <div className="flex items-center gap-1 text-amber-500">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-current" />
                  ))}
                </div>
                <p className="text-muted font-medium">
                  Centenas de pessoas no controle
                </p>
              </div>
            </motion.div>
          </div>

          <div className="order-1 lg:order-2 hidden sm:block">
            <HeroDashboard />
          </div>
        </motion.div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-border bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          <StatCounter value={100} label="Satisfação garantida" suffix="%" />
          <StatCounter value={9} label="Módulos financeiros" suffix="+" />
          <StatCounter value={7} label="Dias trial grátis" suffix=" dias" />
          <StatCounter value={24} label="Suporte disponível" suffix="/7" />
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="py-16 sm:py-24 bg-gradient-to-b from-white via-slate-50 to-white"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-2xl mx-auto mb-12"
          >
            <div className="chip bg-brand-purple/10 text-brand-purple mb-3 mx-auto border border-brand-purple/20 w-fit">
              Funcionalidades
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-display font-extrabold tracking-tight">
              Tudo que você precisa para{" "}
              <span className="text-brand-blue">dominar seu dinheiro</span>
            </h2>
            <p className="mt-4 text-muted text-sm sm:text-lg">
              9 módulos integrados. Uma plataforma completa.
            </p>
          </motion.div>

          <div className="hidden md:block overflow-hidden">
            <motion.div
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 30, ease: "linear", repeat: Infinity }}
              className="flex gap-6"
            >
              {[...features, ...features].map((f, index) => (
                <FeatureCard key={`${f.title}-${index}`} feature={f} />
              ))}
            </motion.div>
          </div>

          <div className="mt-12 md:hidden grid grid-cols-1 gap-4">
            {features.map((f) => (
              <FeatureCard key={f.title} feature={f} />
            ))}
          </div>

          <div className="mt-16 grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Lock,
                title: "Segurança total",
                desc: "Bcrypt + JWT + HTTPS. Seus dados nunca saem do servidor seguro.",
                badge: "Seguro",
                badgeColor: "bg-green-100 text-green-800",
              },
              {
                icon: Zap,
                title: "Performance real",
                desc: "Backend TypeScript + Prisma + MySQL otimizado para milhares de transações.",
                badge: "Rápido",
                badgeColor: "bg-blue-100 text-blue-800",
              },
              {
                icon: Globe,
                title: "Acesse de qualquer lugar",
                desc: "Web responsivo, mobile-first. Funciona no celular, tablet e computador.",
                badge: "Multiplataforma",
                badgeColor: "bg-purple-100 text-purple-800",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="card hover:shadow-glow transition-all group p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-surface group-hover:bg-brand-blue/10 transition flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-muted group-hover:text-brand-blue transition" />
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                </div>
                <h3 className="font-display font-bold text-lg">{item.title}</h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Product preview */}
      <section
        id="preview"
        className="py-16 sm:py-24 bg-background border-y border-border"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-2xl mx-auto mb-12 sm:mb-16"
          >
            <div className="chip bg-brand-green/10 text-brand-green mb-3 mx-auto border border-brand-green/20 w-fit">
              Preview
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-display font-extrabold tracking-tight">
              Veja o Finix em ação
            </h2>
            <p className="mt-4 text-muted text-sm sm:text-lg">
              Cada pixel foi pensado para você tomar decisões melhores.
            </p>
          </motion.div>

          <PreviewCard
            order={1}
            badge="Dashboard"
            title="Seu panorama financeiro em 1 olhada"
            desc="Saldo, receitas, despesas, economizado, insights e gráficos com zoom nos últimos 6 meses. Tudo na mesma tela."
            align="left"
            visual={<DashboardVisual />}
          />
          <PreviewCard
            order={2}
            badge="Finix IA"
            title="Análise personalizada em segundos"
            desc="Clique em 'Análise com Finix IA' e receba recomendações específicas com base nos seus números reais. Não é genérico — é o seu dinheiro."
            align="right"
            visual={<AIInsightsVisual />}
          />
          <PreviewCard
            order={3}
            badge="Metas + Orçamentos"
            title="Transforme desejos em planos concretos"
            desc="Defina objetivos, acompanhe o progresso com barras animadas e limite gastos por categoria com alertas em tempo real."
            align="left"
            visual={<GoalsVisual />}
          />
          <PreviewCard
            order={4}
            badge="Calendário Financeiro"
            title="Visualize o mês inteiro de uma vez"
            desc="Veja cada dia com receitas, despesas e saldo diário. Identifique padrões e picos de gasto instantaneamente."
            align="right"
            visual={<CalendarVisual />}
          />
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-16 sm:py-24 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-2xl mx-auto mb-12"
          >
            <div className="chip bg-amber-100 text-amber-700 mb-3 mx-auto border border-amber-200 w-fit">
              Depoimentos
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-display font-extrabold tracking-tight">
              Pessoas que{" "}
              <span className="text-brand-green">economizaram de verdade</span>
            </h2>
            <p className="mt-4 text-muted text-sm sm:text-lg">
              Resultados reais de usuários do Finix.
            </p>
          </motion.div>
          <TestimonialCarousel />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 sm:py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="chip bg-brand-blue/10 text-brand-blue mb-3 mx-auto border border-brand-blue/20 w-fit">
              Planos
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-display font-extrabold tracking-tight">
              Escolha seu plano perfeito
            </h2>
            <p className="mt-3 text-muted text-sm sm:text-lg">
              7 dias grátis em qualquer plano pago. Sem cartão no plano
              gratuito.
            </p>
          </motion.div>

          {/* Cards: Free | Pro (destaque central) | Basic */}
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto items-center">
            {/* Free */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative rounded-3xl border border-border bg-surface shadow p-7 flex flex-col"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-surface">
                  <Globe className="w-6 h-6 text-muted" />
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold">Grátis</h3>
                  <p className="text-xs text-muted">Para começar</p>
                </div>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-display font-extrabold text-text">
                    R$0
                  </span>
                  <span className="text-sm text-muted">/mês</span>
                </div>
                <p className="text-xs text-muted mt-1">Para sempre gratuito</p>
              </div>
              <div className="space-y-2 mb-6 flex-1">
                {[
                  "Dashboard básica",
                  "Até 2 metas financeiras",
                  "Visualização de categorias",
                  "Sem transações",
                ].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-muted flex-shrink-0" />
                    <span className="text-muted">{f}</span>
                  </div>
                ))}
              </div>
              <Link
                to="/register"
                className="w-full mt-auto py-3 px-6 border border-border text-text rounded-2xl font-semibold hover:bg-background transition text-center"
              >
                Criar conta grátis
              </Link>
            </motion.div>

            {/* Pro - DESTAQUE no centro */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              whileHover={{ y: -6 }}
              className="relative rounded-3xl bg-gradient-to-br from-[#1a0030] via-[#3d006e] to-[#5c00a3] border-2 border-[#c084fc] shadow-[0_0_60px_rgba(192,132,252,0.6)] transition-all p-8 flex flex-col scale-105 z-10"
            >
              <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-to-r from-yellow-300 to-amber-400 text-purple-950 px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-lg">
                  ⭐ MAIS POPULAR
                </span>
              </div>
              {/* Glow ring */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 pointer-events-none" />
              <div className="flex items-center gap-3 mb-5 mt-4">
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-300 to-amber-400 shadow-lg">
                  <Crown className="w-7 h-7 text-purple-900" />
                </div>
                <div>
                  <h3 className="text-xl font-display font-bold text-white">
                    🚀 Finix Pro
                  </h3>
                  <p className="text-xs text-purple-200">
                    Para pequenas empresas
                  </p>
                </div>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-display font-extrabold text-white">
                    R$35
                  </span>
                  <span className="text-sm text-purple-200">/mês</span>
                </div>
                <p className="text-xs text-purple-300 mt-1">
                  R$350/ano · economia de R$70
                </p>
              </div>
              <div className="space-y-2.5 mb-8 flex-1">
                {[
                  "Transações ilimitadas",
                  "Finix IA avançada",
                  "Exportação PDF + Excel",
                  "Metas ilimitadas",
                  "Gestão de cartões",
                  "DRE gerencial automático",
                  "Centros de custo",
                  "Personalização da marca",
                  "Suporte prioritário WhatsApp",
                ].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <div className="w-4 h-4 rounded-full bg-yellow-300 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-purple-900" />
                    </div>
                    <span className="text-purple-100 font-medium">{f}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => handleCheckout("PRO")}
                disabled={loadingPlan === "PRO"}
                className="w-full mt-auto py-4 px-6 bg-gradient-to-r from-yellow-300 to-amber-400 text-purple-900 rounded-2xl font-black hover:brightness-110 transition disabled:opacity-50 shadow-xl text-base"
              >
                {loadingPlan === "PRO" ? (
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                ) : null}
                {loadingPlan === "PRO" ? "Processando..." : "🎉 7 dias grátis"}
              </button>
            </motion.div>

            {/* Básico */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              whileHover={{ y: -4 }}
              className="relative rounded-3xl border border-border bg-surface shadow-lg hover:shadow-xl transition-all p-7 flex flex-col"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-surface">
                  <PiggyBank className="w-6 h-6 text-text" />
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold">
                    Finix Básico
                  </h3>
                  <p className="text-xs text-muted">Para autônomos</p>
                </div>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-display font-extrabold text-text">
                    R$10
                  </span>
                  <span className="text-sm text-muted">/mês</span>
                </div>
                <p className="text-xs text-muted mt-1">
                  R$100/ano · economia de R$20
                </p>
              </div>
              <div className="space-y-2 mb-6 flex-1">
                {[
                  "Até 500 transações/mês",
                  "Dashboard completo",
                  "Finix IA",
                  "Exportação PDF",
                  "Até 5 metas",
                  "Calendário financeiro",
                  "Alertas de pagamento",
                  "Suporte por e-mail",
                ].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-text flex-shrink-0" />
                    <span className="text-text">{f}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => handleCheckout("BASIC")}
                disabled={loadingPlan === "BASIC"}
                className="w-full mt-auto py-3 px-6 bg-surface-strong text-white rounded-2xl font-bold hover:bg-surface-strong transition disabled:opacity-50"
              >
                {loadingPlan === "BASIC" ? (
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                ) : null}
                {loadingPlan === "BASIC" ? "Processando..." : "7 dias grátis"}
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 sm:py-24 bg-surface">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="chip bg-surface text-text mb-3 mx-auto border border-border w-fit">
              FAQ
            </div>
            <h2 className="text-2xl sm:text-4xl font-display font-extrabold tracking-tight">
              Perguntas frequentes
            </h2>
            <p className="mt-4 text-muted">
              Tudo que você precisa saber antes de começar.
            </p>
          </motion.div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="card overflow-hidden p-0"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-background transition"
                >
                  <span className="font-semibold text-text pr-4">{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-muted flex-shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                  />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 text-muted text-sm leading-relaxed border-t border-border pt-4">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final + Formulário de contato */}
      <section className="py-16 sm:py-24 bg-gradient-to-br from-brand-blue via-brand-purple to-brand-green relative overflow-hidden">
        <motion.div
          className="absolute inset-0 opacity-20"
          animate={{ backgroundPosition: ["0% 0%", "100% 100%"] }}
          transition={{ duration: 20, repeat: Infinity, repeatType: "reverse" }}
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="text-5xl mb-6">💰</div>
            <h2 className="text-3xl sm:text-5xl font-display font-extrabold text-white leading-tight">
              Comece hoje. <br className="hidden sm:block" />
              Seus dados financeiros merecem isso.
            </h2>
            <p className="mt-5 text-lg text-white/80 max-w-xl mx-auto">
              Junte-se a pessoas que tomaram o controle das próprias finanças
              com o Finix.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 bg-black text-white font-bold px-8 py-4 rounded-2xl hover:bg-slate-900 transition shadow-xl text-base"
              >
                Criar conta grátis <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 border border-white/40 text-white font-semibold px-8 py-4 rounded-2xl hover:bg-surface/10 transition text-base"
              >
                Ver planos
              </a>
            </div>
            <p className="mt-5 text-white/60 text-sm">
              Sem cartão de crédito · Cancele quando quiser
            </p>
          </motion.div>
        </div>

        {/* Formulário de contato */}
        <div
          id="contact"
          className="relative max-w-2xl mx-auto px-4 sm:px-6 mt-16"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-surface/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 sm:p-8"
          >
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-surface/20 text-white text-sm font-semibold px-4 py-1.5 rounded-full mb-3">
                <MessageCircle className="w-4 h-4" /> Fale com a gente
              </div>
              <h3 className="text-2xl font-display font-bold text-white">
                Preencha os campos abaixo e retornaremos em breve.
              </h3>
            </div>
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/80 text-xs font-semibold mb-1.5">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    value={contactForm.nome}
                    onChange={(e) =>
                      setContactForm((p) => ({ ...p, nome: e.target.value }))
                    }
                    placeholder="João Silva"
                    className="w-full bg-surface/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/50 focus:bg-surface/15 transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-white/80 text-xs font-semibold mb-1.5">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) =>
                      setContactForm((p) => ({ ...p, email: e.target.value }))
                    }
                    placeholder="joao@empresa.com.br"
                    className="w-full bg-surface/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/50 focus:bg-surface/15 transition"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-white/80 text-xs font-semibold mb-1.5">
                  Nome da Empresa
                </label>
                <input
                  type="text"
                  value={contactForm.empresa}
                  onChange={(e) =>
                    setContactForm((p) => ({ ...p, empresa: e.target.value }))
                  }
                  placeholder="Minha Empresa Ltda."
                  className="w-full bg-surface/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/50 focus:bg-surface/15 transition"
                />
              </div>
              <div>
                <label className="block text-white/80 text-xs font-semibold mb-1.5">
                  Como podemos ajudar?
                </label>
                <textarea
                  value={contactForm.mensagem}
                  onChange={(e) =>
                    setContactForm((p) => ({ ...p, mensagem: e.target.value }))
                  }
                  placeholder="Conte-nos um pouco sobre o que você precisa..."
                  rows={3}
                  className="w-full bg-surface/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/50 focus:bg-surface/15 transition resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={sendingContact}
                className="w-full py-4 bg-surface text-white font-bold rounded-2xl hover:bg-surface/90 transition shadow-xl flex items-center justify-center gap-2 text-base"
              >
                {sendingContact ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {sendingContact ? "Enviando..." : "Enviar via WhatsApp"}
              </button>
              <p className="text-center text-white/50 text-xs">
                Ao enviar, você será redirecionado para o WhatsApp
              </p>
            </form>
          </motion.div>
        </div>
      </section>

      {/* Support */}
      <section className="py-12 sm:py-16 bg-surface border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl border border-border bg-background p-6 sm:p-8"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <div className="text-xs uppercase tracking-[0.35em] text-brand-blue font-semibold mb-2">
                  Suporte
                </div>
                <h2 className="text-xl sm:text-3xl font-display font-bold text-text">
                  Precisa de ajuda? Estamos aqui.
                </h2>
                <p className="mt-3 text-muted max-w-2xl text-sm sm:text-base">
                  Nossa equipe responde em menos de 24h por e-mail e em tempo
                  real pelo WhatsApp para clientes Pro.
                </p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" /> cvdinizramos@gmail.com
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" /> +55 19 99473-7425
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="https://wa.me/5519994737425?text=Olá%20Finix"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
                <a
                  href="mailto:cvdinizramos@gmail.com"
                  className="btn-outline inline-flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" /> E-mail
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-border py-8 sm:py-10 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <Logo size={32} />
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted">
              <a href="#features" className="hover:text-brand-blue transition">
                Funcionalidades
              </a>
              <a href="#pricing" className="hover:text-brand-blue transition">
                Planos
              </a>
              <a href="#faq" className="hover:text-brand-blue transition">
                FAQ
              </a>
              <Link to="/login" className="hover:text-brand-blue transition">
                Entrar
              </Link>
              <Link to="/register" className="hover:text-brand-blue transition">
                Cadastrar
              </Link>
            </div>
            <div className="text-xs text-muted">
              © 2026 Finix · Feito com 💙 por{" "}
              <a
                href="https://caiodiniz.dev.br"
                target="_blank"
                rel="noreferrer"
                className="text-brand-blue hover:underline"
              >
                Caio Diniz
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ===== Visual components ===== */

function FeatureCard({ feature }: { feature: (typeof features)[number] }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="group relative card hover:shadow-glow transition-all min-w-[22rem] flex-shrink-0 h-full"
    >
      <div
        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform shadow-md`}
      >
        <feature.icon className="w-5 h-5" />
      </div>
      <h3 className="font-display font-bold text-lg">{feature.title}</h3>
      <p className="text-muted mt-2 text-sm leading-relaxed">{feature.desc}</p>
    </motion.div>
  );
}

const testimonials = [
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

function TestimonialCarousel() {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setCurrent((prev) => (prev + 1) % testimonials.length),
      4500,
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="relative max-w-4xl mx-auto">
      <AnimatePresence mode="wait">
        <motion.div
          key={testimonials[current].name}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.45 }}
          className="card p-6 sm:p-8 shadow-xl relative"
        >
          <Quote className="absolute top-6 right-6 w-10 h-10 text-text" />
          <div className="flex items-center gap-1 text-amber-500 mb-4">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className="w-4 h-4 fill-current" />
            ))}
            <span className="ml-2 text-xs font-semibold text-brand-green bg-green-50 px-2 py-1 rounded-full">
              {testimonials[current].saving}
            </span>
          </div>
          <p className="text-base sm:text-xl text-text leading-relaxed">
            "{testimonials[current].text}"
          </p>
          <div className="mt-6 flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
              style={{ background: testimonials[current].color }}
            >
              {testimonials[current].name.charAt(0)}
            </div>
            <div>
              <div className="font-semibold text-text">
                {testimonials[current].name}
              </div>
              <div className="text-sm text-muted">
                {testimonials[current].role}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          onClick={() =>
            setCurrent(
              (p) => (p - 1 + testimonials.length) % testimonials.length,
            )
          }
          className="btn-outline inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm"
        >
          <ChevronLeft className="w-4 h-4" /> Anterior
        </button>
        <div className="flex items-center gap-2">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-3 h-3 rounded-full transition-all ${i === current ? "bg-brand-green scale-125" : "bg-border"}`}
            />
          ))}
        </div>
        <button
          onClick={() => setCurrent((p) => (p + 1) % testimonials.length)}
          className="btn-outline inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm"
        >
          Próximo <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function HeroDashboard() {
  const bars = [40, 62, 50, 78, 55, 84, 70, 92, 66, 88, 75, 95];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, rotateX: -5 }}
      animate={{ opacity: 1, scale: 1, rotateX: 0 }}
      transition={{ duration: 0.8, delay: 0.2, type: "spring", stiffness: 70 }}
      className="relative perspective"
    >
      <div className="absolute -inset-4 sm:-inset-8 bg-gradient-to-br from-brand-blue/30 via-brand-purple/30 to-brand-green/30 blur-3xl rounded-full opacity-60" />
      <motion.div
        initial={{ opacity: 0, x: 30, y: 20 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.8 }}
        className="hidden sm:block absolute -left-8 top-44 z-20 card !p-4 w-56 bg-surface/95 backdrop-blur"
        style={{ boxShadow: "0 20px 60px -20px rgba(37,99,235,0.4)" }}
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-purple to-pink-500 flex items-center justify-center text-white">
              <Brain className="w-4 h-4" />
            </div>
            <div className="text-xs font-semibold">Finix IA</div>
          </div>
          <p className="text-xs text-muted mt-2 leading-snug">
            Você economizou <b className="text-brand-green">62%</b> da sua renda
            este mês! 🎉
          </p>
        </motion.div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: -30, y: -10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 1 }}
        className="hidden sm:block absolute -right-6 -bottom-6 z-20 card !p-4 w-52 bg-surface/95 backdrop-blur"
        style={{ boxShadow: "0 20px 60px -20px rgba(34,197,94,0.4)" }}
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-green to-emerald-500 flex items-center justify-center text-white">
              <Target className="w-4 h-4" />
            </div>
            <div className="text-xs font-semibold">Meta atingível</div>
          </div>
          <div className="text-xs text-muted mt-1.5">Notebook novo</div>
          <div className="h-2 bg-surface rounded-full mt-1.5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "69%" }}
              transition={{ delay: 1.2, duration: 1.2 }}
              className="h-full bg-gradient-to-r from-brand-green to-emerald-500"
            />
          </div>
          <div className="text-[10px] text-muted mt-1">
            R$ 5.500 / 8.000 · 69%
          </div>
        </motion.div>
      </motion.div>
      <div
        className="relative card !p-4 sm:!p-6 bg-surface/95 backdrop-blur border border-white"
        style={{ boxShadow: "0 30px 80px -30px rgba(37,99,235,0.5)" }}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          <div>
            <div className="text-xs font-semibold text-muted uppercase tracking-wider">
              Saldo total
            </div>
            <div className="text-2xl sm:text-3xl font-display font-extrabold mt-1 tabular-nums">
              R$ 19.230,75
            </div>
          </div>
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="chip bg-brand-green/10 text-brand-green border border-brand-green/30"
          >
            <TrendingUp className="w-3.5 h-3.5" /> +18%
          </motion.div>
        </div>
        <div className="mt-4 sm:mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          {[
            {
              label: "Receitas",
              value: "R$ 31,1k",
              color: "from-green-500 to-emerald-500",
            },
            {
              label: "Despesas",
              value: "R$ 11,9k",
              color: "from-rose-500 to-red-500",
            },
            {
              label: "Metas",
              value: "R$ 16,0k",
              color: "from-brand-blue to-brand-purple",
            },
          ].map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className="rounded-lg sm:rounded-xl bg-background p-2 sm:p-3"
            >
              <div
                className={`h-0.5 sm:h-1 rounded-full bg-gradient-to-r ${c.color} mb-1 sm:mb-2`}
              />
              <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted">
                {c.label}
              </div>
              <div className="font-bold text-xs sm:text-sm">{c.value}</div>
            </motion.div>
          ))}
        </div>
        <div className="mt-4 sm:mt-6 h-24 sm:h-32 flex items-end gap-1">
          {bars.map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{
                delay: 0.3 + i * 0.04,
                duration: 0.6,
                ease: "easeOut",
              }}
              className="flex-1 rounded-t-md bg-gradient-to-t from-brand-blue to-brand-purple"
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-muted mt-1">
          <span>Nov</span>
          <span className="hidden sm:inline">Dez</span>
          <span>Jan</span>
          <span className="hidden sm:inline">Fev</span>
          <span>Mar</span>
          <span className="hidden sm:inline">Abr</span>
        </div>
      </div>
    </motion.div>
  );
}

function PreviewCard({
  order,
  badge,
  title,
  desc,
  align,
  visual,
}: {
  order: number;
  badge: string;
  title: string;
  desc: string;
  align: "left" | "right";
  visual: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      className={`grid lg:grid-cols-2 gap-8 lg:gap-12 items-center mb-16 sm:mb-24 ${align === "right" ? "lg:[&>*:first-child]:order-2" : ""}`}
    >
      <div>
        <div className="chip bg-brand-blue/10 text-brand-blue border border-brand-blue/20 mb-3 w-fit">
          #{order} · {badge}
        </div>
        <h3 className="text-2xl sm:text-3xl lg:text-4xl font-display font-extrabold tracking-tight">
          {title}
        </h3>
        <p className="mt-4 text-muted text-sm sm:text-lg leading-relaxed">
          {desc}
        </p>
        <Link
          to="/register"
          className="inline-flex items-center gap-1 mt-5 text-brand-blue font-semibold hover:gap-2 transition-all text-sm sm:text-base"
        >
          Experimente agora <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <motion.div whileHover={{ y: -4 }} className="relative perspective">
        {visual}
      </motion.div>
    </motion.div>
  );
}

function DashboardVisual() {
  return (
    <div
      className="card !p-5 bg-surface"
      style={{ boxShadow: "0 30px 60px -30px rgba(0,0,0,0.3)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="text-xs text-muted">finixapp.com.br/dashboard</div>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          {
            label: "Saldo",
            v: "R$ 19,2k",
            c: "from-brand-blue to-brand-purple",
          },
          {
            label: "Receitas",
            v: "R$ 31,1k",
            c: "from-green-500 to-emerald-500",
          },
          { label: "Despesas", v: "R$ 11,9k", c: "from-rose-500 to-red-500" },
          { label: "Metas", v: "R$ 16,0k", c: "from-amber-500 to-orange-500" },
        ].map((k) => (
          <div key={k.label} className="rounded-lg bg-background p-2">
            <div className={`h-0.5 rounded bg-gradient-to-r ${k.c} mb-1`} />
            <div className="text-[9px] uppercase text-muted">{k.label}</div>
            <div className="font-bold text-xs">{k.v}</div>
          </div>
        ))}
      </div>
      <svg viewBox="0 0 400 120" className="w-full">
        <defs>
          <linearGradient id="gLine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22C55E" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rLine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5 }}
          d="M0 80 C 50 70, 90 40, 150 45 S 250 20, 320 15 L 400 10 L 400 120 L 0 120 Z"
          fill="url(#gLine)"
          stroke="#22C55E"
          strokeWidth="2"
        />
        <motion.path
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, delay: 0.3 }}
          d="M0 100 C 60 95, 100 85, 170 88 S 270 70, 340 65 L 400 62 L 400 120 L 0 120 Z"
          fill="url(#rLine)"
          stroke="#EF4444"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

function AIInsightsVisual() {
  const items = [
    {
      t: "success",
      title: "Excelente controle! 🎉",
      msg: "Você economizou 62% da sua renda. Continue assim!",
    },
    {
      t: "warning",
      title: "Atenção: Moradia",
      msg: "Representa 67% dos gastos. Reavalie se possível.",
    },
    {
      t: "info",
      title: "Meta próxima 🎯",
      msg: "Notebook 69% concluído. Faltam R$ 2.500.",
    },
    {
      t: "success",
      title: "Saldo saudável 💰",
      msg: "R$ 19k é 62% da receita total. Ótima gestão.",
    },
  ];
  const colors: Record<string, string> = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-900",
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    info: "bg-blue-50 border-blue-200 text-blue-900",
  };
  return (
    <div
      className="relative rounded-2xl p-5 border border-brand-purple/20"
      style={{
        background:
          "linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(124,58,237,0.12) 50%, rgba(34,197,94,0.08) 100%)",
        boxShadow: "0 30px 60px -30px rgba(124,58,237,0.4)",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-blue to-brand-purple flex items-center justify-center text-white">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <div className="font-bold text-sm">Finix IA</div>
          <div className="text-[10px] text-muted">Análise inteligente</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.15 }}
            className={`rounded-lg border p-2.5 ${colors[item.t]}`}
          >
            <div className="font-semibold text-[11px]">{item.title}</div>
            <div className="text-[10px] opacity-80 mt-0.5 leading-snug">
              {item.msg}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function GoalsVisual() {
  const goals = [
    {
      t: "Reserva de emergência",
      pct: 41,
      cur: "R$ 6.200",
      tgt: "R$ 15.000",
      c: "from-brand-blue to-brand-purple",
    },
    {
      t: "Viagem Europa",
      pct: 17,
      cur: "R$ 4.300",
      tgt: "R$ 25.000",
      c: "from-brand-purple to-pink-500",
    },
    {
      t: "Notebook novo",
      pct: 69,
      cur: "R$ 5.500",
      tgt: "R$ 8.000",
      c: "from-brand-green to-emerald-500",
    },
  ];
  return (
    <div
      className="card !p-5 space-y-3"
      style={{ boxShadow: "0 30px 60px -30px rgba(0,0,0,0.3)" }}
    >
      {goals.map((g, i) => (
        <motion.div
          key={g.t}
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.15 }}
          className="rounded-xl border border-border p-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-brand-blue" />
              <span className="font-semibold text-sm">{g.t}</span>
            </div>
            <span className="text-xs font-bold text-brand-blue">{g.pct}%</span>
          </div>
          <div className="h-2 bg-surface rounded-full overflow-hidden mt-2">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${g.pct}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: i * 0.15 }}
              className={`h-full rounded-full bg-gradient-to-r ${g.c}`}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted mt-1">
            <span>{g.cur}</span>
            <span>de {g.tgt}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function CalendarVisual() {
  const days = [
    { d: 1, inc: 5000, exp: 0 },
    { d: 2, inc: 0, exp: 120 },
    { d: 3, inc: 0, exp: 350 },
    { d: 4, inc: 0, exp: 0 },
    { d: 5, inc: 0, exp: 89 },
    { d: 6, inc: 0, exp: 210 },
    { d: 7, inc: 2000, exp: 1200 },
    { d: 8, inc: 0, exp: 45 },
    { d: 9, inc: 0, exp: 0 },
    { d: 10, inc: 0, exp: 890 },
    { d: 11, inc: 500, exp: 67 },
    { d: 12, inc: 0, exp: 340 },
    { d: 13, inc: 0, exp: 123 },
    { d: 14, inc: 3000, exp: 2100 },
  ];
  return (
    <div
      className="card !p-5 bg-surface"
      style={{ boxShadow: "0 30px 60px -30px rgba(0,0,0,0.3)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-sm">Maio 2026</h4>
        <span className="text-xs text-brand-green font-semibold">
          +R$ 10.300
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <div key={i} className="text-[10px] text-muted font-semibold pb-1">
            {d}
          </div>
        ))}
        {days.map((day) => (
          <motion.div
            key={day.d}
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: day.d * 0.03 }}
            className={`rounded-lg p-1 text-center cursor-pointer hover:scale-105 transition ${day.inc > 0 ? "bg-green-50 border border-green-200" : day.exp > 0 ? "bg-red-50 border border-red-100" : "bg-background"}`}
          >
            <div className="text-[10px] font-semibold text-text">{day.d}</div>
            {day.inc > 0 && (
              <div className="text-[8px] text-green-600 font-bold truncate">
                +{(day.inc / 1000).toFixed(1)}k
              </div>
            )}
            {day.exp > 0 && (
              <div className="text-[8px] text-red-500 truncate">-{day.exp}</div>
            )}
          </motion.div>
        ))}
      </div>
      <div className="mt-3 flex gap-3 text-[10px] text-muted">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-green-100 border border-green-200" />{" "}
          Receita
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-red-50 border border-red-100" />{" "}
          Despesa
        </div>
      </div>
    </div>
  );
}
