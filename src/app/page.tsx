import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Building2, Box, Mic, Users } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">SS</div>
            <span className="font-semibold">Spatial Sales Platform</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" asChild><Link href="/dashboard">Dashboard</Link></Button>
            <Button asChild><Link href="/dashboard/projects/new">Get Started</Link></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            AI Spatial Sales Infrastructure for Real Estate
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Create premium 360° tours or World Labs-powered 3D walkthroughs. Add RAG-grounded AI voice agents,
            buyer intent CRM, and family collaboration — all from one platform.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Button size="lg" asChild><Link href="/dashboard">Open Dashboard</Link></Button>
            <Button size="lg" variant="outline" asChild><Link href="/view/demo">Demo Buyer View</Link></Button>
          </div>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Building2, title: "360° Tours", desc: "Fast, reliable panoramic experiences" },
            { icon: Box, title: "3D Walkthroughs", desc: "World Labs splat generation from day one" },
            { icon: Mic, title: "AI Voice Agent", desc: "OpenRouter + ElevenLabs, zero hallucination" },
            { icon: Users, title: "Intent CRM", desc: "Every buyer action becomes sales intelligence" },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="rounded-xl border border-gray-200 bg-white p-6">
                <Icon className="mb-4 h-8 w-8 text-primary" />
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
