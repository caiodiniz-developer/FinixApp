import React, { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import "./index.css";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import {
  PublicThemeProvider,
  DashboardThemeProvider,
} from "./contexts/ThemeContext";
import { Logo } from "./components/Logo";

// Route-level code splitting: each page ships as its own chunk instead of
// one ~1.3MB bundle. This matters most for the public/auth pages (Landing,
// Login, Register, Signup) — they used to pay for the entire authenticated
// app (recharts, framer-motion animations, every dashboard page) before a
// single line of their own code ran.
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Signup = lazy(() => import("./pages/Signup"));
const OAuthCallback = lazy(() => import("./pages/OAuthCallback"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Recurring = lazy(() => import("./pages/Recurring"));
const Subscriptions = lazy(() => import("./pages/Subscriptions"));
const Debts = lazy(() => import("./pages/Debts"));
const Challenges = lazy(() => import("./pages/Challenges"));
const Goals = lazy(() => import("./pages/Goals"));
const Budgets = lazy(() => import("./pages/Budgets"));
const Accounts = lazy(() => import("./pages/Accounts"));
const Cards = lazy(() => import("./pages/Cards"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Plans = lazy(() => import("./pages/Plans"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Categories = lazy(() => import("./pages/Categories"));
const Profile = lazy(() => import("./pages/Profile"));
const Admin = lazy(() => import("./pages/Admin"));
const AppLayout = lazy(() => import("./layouts/AppLayout"));

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-surface text-text text-text">
      <Logo />
      <div className="w-10 h-10 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
    </div>
  );
}

function PublicRoutes() {
  return (
    <PublicThemeProvider>
      <Outlet />
    </PublicThemeProvider>
  );
}

function DashboardRoutes() {
  return (
    <DashboardThemeProvider>
      <Outlet />
    </DashboardThemeProvider>
  );
}

function OnboardingRequired({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user === undefined) return <FullScreenLoader />;
  if (user === null) return <Navigate to="/login" replace />;
  if (
    user.role !== "ADMIN" &&
    user.plan === "PRO" &&
    !user.hasCompletedOnboarding
  )
    return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function NeedsOnboarding({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user === undefined) return <FullScreenLoader />;
  if (user === null) return <Navigate to="/login" replace />;
  if (user.role === "ADMIN") return <Navigate to="/app/dashboard" replace />;
  if (user.plan !== "PRO") return <Navigate to="/app/dashboard" replace />;
  if (user.hasCompletedOnboarding)
    return <Navigate to="/app/dashboard" replace />;
  return <>{children}</>;
}

function ProtectedRoute({
  children,
  admin = false,
}: {
  children: React.ReactNode;
  admin?: boolean;
}) {
  const { user } = useAuth();
  if (user === undefined) return <FullScreenLoader />;
  if (user === null) return <Navigate to="/login" replace />;
  if (admin && user.role !== "ADMIN")
    return <Navigate to="/app/dashboard" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user === undefined) return <FullScreenLoader />;
  if (user) return <Navigate to="/app/dashboard" replace />;
  return <>{children}</>;
}

function Home() {
  const { user } = useAuth();
  if (user === undefined) return <FullScreenLoader />;
  if (user) return <Navigate to="/app/dashboard" replace />;
  return <Landing />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              borderRadius: 12,
              padding: "12px 16px",
              fontFamily: "Inter, sans-serif",
            },
            success: { iconTheme: { primary: "#22C55E", secondary: "white" } },
          }}
        />
        <Suspense fallback={<FullScreenLoader />}>
        <Routes>
          <Route element={<PublicRoutes />}>
            <Route path="/" element={<Home />} />
            <Route
              path="/login"
              element={
                <PublicOnly>
                  <Login />
                </PublicOnly>
              }
            />
            <Route
              path="/register"
              element={
                <PublicOnly>
                  <Register />
                </PublicOnly>
              }
            />
            <Route
              path="/signup"
              element={
                <PublicOnly>
                  <Signup />
                </PublicOnly>
              }
            />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route
              path="/oauth-callback"
              element={
                <PublicOnly>
                  <OAuthCallback />
                </PublicOnly>
              }
            />
          </Route>

          <Route element={<DashboardRoutes />}>
            <Route
              path="/onboarding"
              element={
                <NeedsOnboarding>
                  <Onboarding />
                </NeedsOnboarding>
              }
            />
            <Route
              path="/app"
              element={
                <OnboardingRequired>
                  <AppLayout />
                </OnboardingRequired>
              }
            >
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="recurring" element={<Recurring />} />
              <Route path="subscriptions" element={<Subscriptions />} />
              <Route path="debts" element={<Debts />} />
              <Route path="challenges" element={<Challenges />} />
              <Route path="goals" element={<Goals />} />
              <Route path="budgets" element={<Budgets />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="cards" element={<Cards />} />
              <Route path="contacts" element={<Contacts />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="categories" element={<Categories />} />
              <Route path="plans" element={<Plans />} />
              <Route path="profile" element={<Profile />} />
              <Route
                path="admin"
                element={
                  <ProtectedRoute admin>
                    <Admin />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
