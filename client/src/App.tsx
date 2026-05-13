// AuditFlow QAH - Main App
// Full-stack version: tRPC backend, MySQL database, bcrypt password auth

import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import AppLayout from "./components/layout/AppLayout";
import SubmitAudit from "./pages/SubmitAudit";
import CheckStatus from "./pages/CheckStatus";
import ApprovalQueue from "./pages/ApprovalQueue";
import AuditRegistry from "./pages/AuditRegistry";
import Statistics from "./pages/Statistics";
import ExportData from "./pages/ExportData";
import SettingsPage from "./pages/SettingsPage";
import AuditCalendar from "./pages/AuditCalendar";
import ConsultantDecisionLog from "./pages/ConsultantDecisionLog";
import UserManagement from "./pages/UserManagement";
import UserApprovals from "./pages/UserApprovals";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Notifications from "./pages/Notifications";
import { trpc } from "./lib/trpc";

function AppRouter() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: currentUser, isLoading } = trpc.auth.currentUser.useQuery(
    undefined,
    { retry: false, staleTime: 0 }
  );

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      // Hard reload to clear all React state and tRPC cache
      window.location.href = "/login";
    },
    onError: () => {
      // Even if the server call fails, redirect to login
      window.location.href = "/login";
    },
  });

  // After logout, currentUser becomes null - navigate to login
  useEffect(() => {
    if (!isLoading && !currentUser) {
      // Only redirect if we're not already on an auth page
      const path = window.location.pathname;
      if (path !== "/login" && path !== "/register" && path !== "/forgot-password" && path !== "/reset-password") {
        window.location.href = "/login";
      }
    }
  }, [currentUser, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500 text-sm">Loading...</div>
      </div>
    );
  }

  // Not authenticated - show login/register
  if (!currentUser) {
    return (
      <Switch>
        <Route path="/register" component={Register} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route component={Login} />
      </Switch>
    );
  }

  // Authenticated - show the app
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <AppLayout user={currentUser} onLogout={handleLogout}>
      <Switch>
        <Route path="/" component={SubmitAudit} />
        <Route path="/login" component={SubmitAudit} />
        <Route path="/check-status" component={CheckStatus} />
        <Route path="/approval-queue" component={ApprovalQueue} />
        <Route path="/registry" component={AuditRegistry} />
        <Route path="/statistics" component={Statistics} />
        <Route path="/export" component={ExportData} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/calendar" component={AuditCalendar} />
        <Route path="/decision-log" component={ConsultantDecisionLog} />
        <Route path="/users" component={UserManagement} />
        <Route path="/approvals" component={UserApprovals} />
        <Route path="/notifications" component={Notifications} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="bottom-right" />
          <AppRouter />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
