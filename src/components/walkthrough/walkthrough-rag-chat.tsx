"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function WalkthroughRagChat({
  experienceId,
  propertyId,
}: {
  experienceId: string;
  propertyId: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Share property details in plain language — price, size, amenities, possession, RERA, FAQs. I'll turn them into approved AI knowledge.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; text: string }[]>([]);

  async function send() {
    if (!input.trim() && !attachments.length) return;
    const userMsg = input.trim();
    setMessages((m) => [...m, { role: "user", content: userMsg || "(attached files)" }]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/walkthrough/rag/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experience_id: experienceId,
          property_id: propertyId,
          session_id: sessionId ?? undefined,
          message: userMsg || "Please extract knowledge from the attached content.",
          attachments,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");

      if (data.session_id) setSessionId(data.session_id);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      setAttachments([]);
      if (data.entries_saved > 0) {
        toast.success(`Saved ${data.entries_saved} knowledge ${data.entries_saved === 1 ? "entry" : "entries"}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setSending(false);
    }
  }

  function onFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAttachments((a) => [...a, { name: file.name, text: String(reader.result ?? "") }]);
      toast.success(`Attached ${file.name}`);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="wt-rag-chat">
      <div className="wt-rag-messages">
        {messages.map((m, i) => (
          <div key={i} className="wt-rag-bubble" data-role={m.role}>
            {m.content}
          </div>
        ))}
        {attachments.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Attached: {attachments.map((a) => a.name).join(", ")}
          </div>
        )}
      </div>
      <div className="wt-rag-input">
        <label className="cursor-pointer rounded-md border p-2 hover:bg-muted">
          <Paperclip className="h-4 w-4" />
          <input type="file" accept=".txt,.md,.csv,.json" className="hidden" onChange={onFileAttach} />
        </label>
        <textarea
          placeholder="e.g. 3BHK from ₹1.4 Cr, 1650 sq ft, possession Dec 2027, clubhouse, gym, pool…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button size="icon" onClick={send} disabled={sending}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
