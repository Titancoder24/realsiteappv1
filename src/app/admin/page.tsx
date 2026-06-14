import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform Overview</h1>
        <p className="mt-1 text-muted-foreground">Engine control, Property Walkthrough AI, World Labs, and platform settings</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "Property Walkthrough AI", href: "/admin/walkthrough-ai", status: "OpenRouter / Vertex" },
            { title: "World Labs Operations", href: "/admin/worldlabs", status: "Online" },
            { title: "Engine Control", href: "/admin/engines", status: "360 + World Labs" },
            { title: "Model & Voice", href: "/admin/models", status: "Configured" },
            { title: "Audit Logs", href: "/admin/audit", status: "Active" },
            { title: "Super Admin Login", href: "/admin/login", status: "Secure" },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="transition-colors hover:border-primary/50">
                <CardHeader>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <CardDescription>Internal platform admin</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="success">{item.status}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
    </div>
  );
}
