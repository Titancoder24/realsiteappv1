import { AdminShellGate } from "@/components/admin/admin-shell-gate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShellGate>{children}</AdminShellGate>;
}
