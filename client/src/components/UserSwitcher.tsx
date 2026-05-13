// UserSwitcher — Demo banner to switch between user roles
// Shown as a small pill in the top-right of the content area

import { useState } from "react";
import { getAllUsers, setCurrentUser, type AppUser } from "@/lib/store";
import { ChevronDown, Users } from "lucide-react";

interface Props {
  currentUser: AppUser;
  onSwitch: (user: AppUser) => void;
}

const ROLE_COLORS: Record<string, string> = {
  admin:      "bg-purple-100 text-purple-800 border-purple-200",
  consultant: "bg-blue-100 text-blue-800 border-blue-200",
  clinician:  "bg-slate-100 text-slate-700 border-slate-200",
};

export default function UserSwitcher({ currentUser, onSwitch }: Props) {
  const [open, setOpen] = useState(false);
  const users = getAllUsers().filter((u) => u.approved);

  const handleSwitch = (user: AppUser) => {
    setCurrentUser(user);
    onSwitch(user);
    setOpen(false);
  };

  return (
    <div className="flex justify-end px-6 pt-4 pb-0 relative z-30">
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-medium transition-all ${ROLE_COLORS[currentUser.role] || ROLE_COLORS.clinician}`}
        >
          <Users className="w-3 h-3" />
          <span>Demo: {currentUser.full_name} ({currentUser.role})</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute right-0 mt-1 w-64 bg-white border border-border rounded-xl shadow-lg overflow-hidden z-50">
            <p className="text-[10px] text-muted-foreground px-3 py-2 border-b border-border font-medium uppercase tracking-wide">
              Switch demo user
            </p>
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => handleSwitch(u)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors ${
                  u.id === currentUser.id ? "bg-muted/30" : ""
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold flex-shrink-0">
                  {u.full_name[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-[12px] font-medium text-foreground">{u.full_name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{u.role}</p>
                </div>
                {u.id === currentUser.id && (
                  <span className="ml-auto text-[10px] text-primary font-medium">Active</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
