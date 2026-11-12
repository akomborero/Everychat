import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Spinner, ToastProvider } from "./components/ui";
import { Shell } from "./components/Shell";
import AuthPage from "./pages/AuthPage";
import OverviewPage from "./pages/OverviewPage";
import InboxPage from "./pages/InboxPage";
import LeadsPage from "./pages/LeadsPage";
import KnowledgePage from "./pages/KnowledgePage";
import AiPage from "./pages/AiPage";
import SettingsPage from "./pages/SettingsPage";
import BookingsPage from "./pages/BookingsPage";
import CustomersPage from "./pages/CustomersPage";
import AdminPage from "./pages/AdminPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import LandingPage from "./pages/LandingPage";
import { ContactPage, PricingPage, ProductPage, SecurityPage } from "./pages/SitePages";
import { DataDeletionPage, PrivacyPage, TermsPage } from "./pages/Legal";
import { ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage } from "./pages/AccountRecovery";

function RequireAuth() {
  const { me, loading } = useAuth();
  if (loading) return <div className="grid min-h-dvh place-items-center"><Spinner className="size-6 text-violet" /></div>;
  return me ? <Outlet /> : <Navigate to="/welcome" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/welcome" element={<LandingPage />} />
            <Route path="/product/:slug" element={<ProductPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/data-deletion" element={<DataDeletionPage />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<Shell />}>
                <Route index element={<OverviewPage />} />
                <Route path="inbox/:id?" element={<InboxPage />} />
                <Route path="customers/:id?" element={<CustomersPage />} />
                <Route path="leads" element={<LeadsPage />} />
                <Route path="bookings" element={<BookingsPage />} />
                <Route path="knowledge" element={<KnowledgePage />} />
                <Route path="ai" element={<AiPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="admin" element={<AdminPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
