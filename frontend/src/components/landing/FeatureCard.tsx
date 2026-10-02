import { motion } from "framer-motion";
import { features } from "./content";

export function FeatureCard({ feature }: { feature: (typeof features)[number] }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="group relative card hover:shadow-soft transition-all min-w-[22rem] flex-shrink-0 h-full"
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
