import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Star,
  Play,
  ShieldCheck,
  Clock,
  PiggyBank,
  Loader2,
  Crown,
  Zap,
  Globe,
  Lock,
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
import { StatCounter } from "../components/landing/StatCounter";
import { features, faqs } from "../components/landing/content";
import { FeatureCard } from "../components/landing/FeatureCard";
import { TestimonialCarousel } from "../components/landing/TestimonialCarousel";
import { HeroDashboard } from "../components/landing/HeroDashboard";
import { PreviewCard } from "../components/landing/PreviewCard";
import { DashboardVisual, AIInsightsVisual, GoalsVisual, CalendarVisual } from "../components/landing/visuals";

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

