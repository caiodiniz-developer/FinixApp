import {
  Utensils, Home, Car, HeartPulse, Gamepad2, GraduationCap, Banknote, Laptop,
  TrendingUp, Tag, ShoppingBag, Plane, PawPrint, Shirt, Wifi, Gift, Fuel,
  Dumbbell, Receipt, Baby, Sparkles, Landmark, type LucideIcon,
} from "lucide-react";
import { CATEGORY_COLORS } from "./format";

// Matched against the category name without accents, so custom categories
// ("Mercado do mês", "Pet shop") get a fitting icon too.
const RULES: [RegExp, LucideIcon][] = [
  [/aliment|mercado|restaurante|comida|lanche|padaria|ifood|delivery/, Utensils],
  [/moradia|aluguel|casa|condominio|imovel/, Home],
  [/combust|gasolina|posto/, Fuel],
  [/transporte|carro|uber|onibus|metro|estaciona/, Car],
  [/saude|farmacia|medic|plano|dentista|hospital/, HeartPulse],
  [/academia|esporte|treino/, Dumbbell],
  [/lazer|jogo|cinema|diversao|streaming|bar|festa/, Gamepad2],
  [/educa|curso|escola|faculdade|livro/, GraduationCap],
  [/salario|pagamento|renda|pro-labore/, Banknote],
  [/freela|servico|projeto/, Laptop],
  [/invest|acoes|tesouro|cripto|poupanca|dividendo/, TrendingUp],
  [/compra|shopping|loja/, ShoppingBag],
  [/roupa|vestuario|calcado/, Shirt],
  [/viagem|passagem|hotel|ferias/, Plane],
  [/pet|cachorro|gato|veterin/, PawPrint],
  [/internet|telefone|celular|assinatura/, Wifi],
  [/presente|doacao/, Gift],
  [/imposto|taxa|tarifa|conta|boleto|luz|agua|energia/, Receipt],
  [/filho|crianca|bebe/, Baby],
  [/beleza|cabelo|estetica|cuidado/, Sparkles],
  [/banco|emprestimo|financiamento|cartao|juros/, Landmark],
];

const FALLBACK_COLORS = ["#2563eb", "#0891b2", "#059669", "#d97706", "#be185d", "#7c3aed", "#0ea5e9", "#64748b"];

const normalize = (name: string) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function categoryIcon(name: string): LucideIcon {
  const key = normalize(name || "");
  return RULES.find(([pattern]) => pattern.test(key))?.[1] ?? Tag;
}

/** The category's own colour; unknown categories always get the same one from a small palette. */
export function categoryColor(name: string): string {
  if (CATEGORY_COLORS[name]) return CATEGORY_COLORS[name];
  let hash = 0;
  for (const ch of normalize(name || "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}
