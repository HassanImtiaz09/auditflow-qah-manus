// AuditFlow QAH — Main App
// Design: NHS Clinical Precision — deep navy sidebar, cool off-white canvas
// Uses local localStorage store; login/register flow with role-based access

import { useState, useCallback, useEffect } from "react";
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
import { initStore, getCurrentUser, type AppUser } from "./lib/store";

// Initialise store with seed data on first load — must run before any auth check
initStore();

/** Returns true only if there is a valid, fully-approved user in localStorage */
function isSessionValid(): boolean {
  try {
    const raw = localStorage.getItem("auditflow_current_user");
    if (!raw) return false;
    const u = JSON.parse(raw) as AppUser;
    if (!u || !u.id || !u.approved) return false;
    if (u.role === "consultant" && !u.role_approved) return false;
    return true;
  } catch {
    return false;
  }
}

interface AuthedAppProps {
  onLogout: () => void;
}

function AuthedApp({ onLogout }: AuthedAppProps) {
  const [user, setUser] = useState<AppUser>(getCurrentUser);
  const [tick, setTick] = useState(0);

  const handleRefresh = useCallback(() => setTick((n) => n + 1), []);

  // Re-read current user from store on tick (in case it was updated externally)
  useEffect(() => {
    setUser(getCurrentUser());
  }, [tick]);

  return (
    <AppLayout user={user} key={user.id} onLogout={onLogout}>
      <div className="p-0" key={tick}>
        <Switch>
          <Route path="/">
            <SubmitAudit user={user} onRefresh={handleRefresh} />
          </Route>
          <Route path="/check-status">
            <CheckStatus user={user} onRefresh={handleRefresh} />
          </Route>
          <Route path="/approval-queue">
            <ApprovalQueue user={user} onRefresh={handleRefresh} />
          </Route>
          <Route path="/registry">
            <AuditRegistry user={user} onRefresh={handleRefresh} />
          </Route>
          <Route path="/statistics">
            <Statistics />
          </Route>
          <Route path="/export">
            <ExportData />
          </Route>
          <Route path="/settings">
            <SettingsPage user={user} />
          </Route>
          <Route path="/calendar">
            <AuditCalendar />
          </Route>
          <Route path="/decision-log">
            <ConsultantDecisionLog user={user} />
          </Route>
          <Route path="/users">
            <UserManagement user={user} onRefresh={handleRefresh} />
          </Route>
          <Route path="/approvals">
            <UserApprovals user={user} onRefresh={handleRefresh} />
          </Route>
        </Switch>
      </div>
    </AppLayout>
  );
}

function AppRouter() {
  const [authed, setAuthed] = useState(() => isSessionValid());
  const [location] = useLocation();

  const handleLogin = () => {
    setAuthed(true);
  };

  const handleLogout = () => {
    // Clear current user from localStorage so the session is truly ended
    localStorage.removeItem("auditflow_current_user");
    setAuthed(false);
  };

  const handleRegistered = () => {
    setAuthed(true);
  };

  // If not authed and not on register, show login/register
  if (!authed) {
    return (
      <Switch>
        <Route path="/register">
          <Register onRegistered={handleRegistered} />
        </Route>
        <Route>
          <Login onLogin={handleLogin} />
        </Route>
      </Switch>
    );
  }

  return <AuthedApp onLogout={handleLogout} />;
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
