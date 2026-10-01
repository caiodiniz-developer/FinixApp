import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Quote, ChevronRight, ChevronLeft } from "lucide-react";
import { testimonials } from "./content";

export function TestimonialCarousel() {
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
