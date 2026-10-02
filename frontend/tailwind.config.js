/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        // One brand colour. Green and red are reserved for income / expense.
        brand: {
          blue: "#2563EB",
          "blue-strong": "#1D4ED8",
          green: "#22C55E",
          dark: "#0F172A",
          light: "#F3F7FF",
          soft: "#E0E7FF",
        },
        surface: "var(--color-surface)",
        "surface-strong": "var(--color-surface-strong)",
        background: "var(--color-background)",
        border: "var(--color-border)",
        "border-strong": "var(--color-border-strong)",
        text: "var(--color-text)",
        muted: "var(--color-text-muted)",
        "text-low": "var(--color-text-low)",
        primary: "var(--color-primary)",
        "primary-soft": "var(--color-primary-soft)",
        overlay: "var(--color-overlay)",
        income: "var(--color-income)",
        expense: "var(--color-expense)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Poppins", "Inter", "sans-serif"],
      },
      // The type scale: 2xs (dense labels) · xs · sm · base · lg and up for
      // headings and figures. Avoid arbitrary sizes like text-[10px].
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      // Two radii: `card` for surfaces, `control` for buttons, inputs, chips.
      borderRadius: {
        card: "var(--radius-card)",
        control: "var(--radius-control)",
      },
      boxShadow: {
        // A single, quiet elevation for things that float (menus, modals).
        soft: "0 24px 80px -32px rgba(15, 23, 42, 0.12)",
        float: "var(--shadow-float)",
      },
      backdropBlur: {
        glass: "var(--glass-blur)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
      },
    },
  },
  plugins: [],
};
