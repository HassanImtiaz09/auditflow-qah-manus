// AuditFlow QAH — Main App
// Design: NHS Clinical Precision — deep navy sidebar, cool off-white canvas
// Uses local localStorage store for demo; no backend required

import { useState, useCallback } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
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
import { initStore, getCurrentUser, type AppUser } from "./lib/store";

// Initialise store with seed data on first load
initStore();

function AppContent() {
  const [user, setUser] = useState<AppUser>(getCurrentUser);
  const [tick, setTick] = useState(0);

  // Force re-render of all pages when data changes
  const handleRefresh = useCallback(() => setTick((n) => n + 1), []);

  const handleUserSwitch = (newUser: AppUser) => {
    setUser(newUser);
    handleRefresh();
  };

  return (
    <AppLayout user={user} key={user.id} onUserSwitch={handleUserSwitch}>
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

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="bottom-right" />
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
