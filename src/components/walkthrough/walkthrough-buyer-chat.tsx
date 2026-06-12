"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WalkthroughAICommand } from "@/lib/walkthrough-player-controller";
import { Loader2, Send, X } from "lucide-react";

export function WalkthroughBuyerChat({
  organizationId,
  propertyId,
  experienceId,
  sessionId,
  activeSceneId,
  onCommand,
  onClose,
}: {
  organizationId: string;
  propertyId: string;
  experienceId: string;
  sessionId?: string;
  activeSceneId?: string;
  onCommand: (cmd: WalkthroughAICommand) => void;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([
    "Show me the kitchen",
    "Point to the balcony view",
    "Book a site visit",
  ]);

  async function send(query: string) {
    if (!query.trim() || loading) return;
    setMessages((m) => [...m, { role: "user", content: query }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/walkthrough/buyer-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          propertyId,
          experienceId,
          sessionId,
          activeSceneId,
          query,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMessages((m) => [...m, { role: "assistant", content: data.answer }]);
      if (data.command) onCommand(data.command);
      if (data.suggestedFollowups?.length) setSuggestions(data.suggestedFollowups);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="font-medium">Property AI</p>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close chat">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Ask about rooms, features, amenities, or say &quot;show me the kitchen&quot; to navigate.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "ml-8 bg-primary text-primary-foreground" : "mr-8 bg-muted"}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Thinking…</div>}
      </div>
      <div className="flex flex-wrap gap-2 border-t px-4 py-2">
        {suggestions.slice(0, 3).map((s) => (
          <button key={s} type="button" className="rounded-full bg-muted px-3 py-1 text-xs" onClick={() => send(s)}>{s}</button>
        ))}
      </div>
      <form
        className="flex gap-2 border-t p-4"
        onSubmit={(e) => { e.preventDefault(); send(input); }}
      >
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about this property…" className="min-h-[44px]" />
        <Button type="submit" size="icon" className="min-h-[44px] min-w-[44px]" disabled={loading}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
