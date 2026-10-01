import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export function PreviewCard({
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
