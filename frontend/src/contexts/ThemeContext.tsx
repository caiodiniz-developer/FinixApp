import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const PublicThemeContext = createContext<ThemeContextValue | undefined>(
  undefined,
);
const DashboardThemeContext = createContext<ThemeContextValue | undefined>(
  undefined,
);

const getInitialTheme = (storageKey: string): ThemeMode => {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(storageKey) as ThemeMode | null;
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

function ThemeProviderBase({
  children,
  storageKey,
  scopeClass,
  context,
  allowDark = true,
}: {
  children: React.ReactNode;
  storageKey: string;
  scopeClass: string;
  context: React.Context<ThemeContextValue | undefined>;
  allowDark?: boolean;
}) {
  const [theme, setThemeState] = useState<ThemeMode>(() =>
    getInitialTheme(storageKey),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, theme);
  }, [storageKey, theme]);

  // Layers drawn outside this wrapper (toasts) read the theme from <html>.
  useEffect(() => {
    if (scopeClass !== "dashboard-theme") return;
    document.documentElement.dataset.appTheme = theme;
    return () => { delete document.documentElement.dataset.appTheme; };
  }, [scopeClass, theme]);

  const setTheme = (nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
  };

  const toggleTheme = () => {
    setThemeState((current) => (current === "dark" ? "light" : "dark"));
  };

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme]);

  return (
    <context.Provider value={value}>
      <div
        className={`${scopeClass} ${allowDark && theme === "dark" ? "dark" : ""}`}
        data-theme={theme}
      >
        {children}
      </div>
    </context.Provider>
  );
}

export function PublicThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProviderBase
      storageKey="finix_public_theme"
      scopeClass="public-theme"
      context={PublicThemeContext}
      allowDark={false}
    >
      {children}
    </ThemeProviderBase>
  );
}

export function DashboardThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProviderBase
      storageKey="finix_dashboard_theme"
      scopeClass="dashboard-theme"
      context={DashboardThemeContext}
    >
      {children}
    </ThemeProviderBase>
  );
}

export function usePublicTheme() {
  const context = useContext(PublicThemeContext);
  if (!context) {
    throw new Error("usePublicTheme must be used within PublicThemeProvider");
  }
  return context;
}

export function useDashboardTheme() {
  const context = useContext(DashboardThemeContext);
  if (!context) {
    throw new Error(
      "useDashboardTheme must be used within DashboardThemeProvider",
    );
  }
  return context;
}
