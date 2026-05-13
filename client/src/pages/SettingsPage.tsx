// SettingsPage — tRPC backend
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, Settings } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function SettingsPage() {
  const { data: currentUser } = trpc.auth.currentUser.useQuery();
  const isAdmin = currentUser?.auditRole === "admin";

  const [dept, setDept] = useState("ENT Department");
  const [hospital, setHospital] = useState("Queen Alexandra Hospital");
  const [trust, setTrust] = useState("Portsmouth Hospitals University NHS Trust");
  const [prefix, setPrefix] = useState("QAH-ENT");

  const handleSave = () => {
    toast.success("Settings saved.");
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Department and system configuration.</p>
      </div>
      {!isAdmin ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <Settings className="w-6 h-6 text-amber-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-amber-800">Admin access required to change settings.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium">Department Name</Label>
              <Input value={dept} onChange={e => setDept(e.target.value)} className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-medium">Hospital</Label>
              <Input value={hospital} onChange={e => setHospital(e.target.value)} className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-medium">NHS Trust</Label>
              <Input value={trust} onChange={e => setTrust(e.target.value)} className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-medium">Reference Prefix</Label>
              <Input value={prefix} onChange={e => setPrefix(e.target.value)} className="mt-1 text-sm" />
            </div>
          </div>
          <Button onClick={handleSave} className="mt-2">
            <Save className="w-4 h-4 mr-2" />Save Settings
          </Button>
        </div>
      )}
    </div>
  );
}
