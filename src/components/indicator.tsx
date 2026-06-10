import { cn } from "@/lib/utils";

export function StatusIndicator({ className }: { className?: string }) {
  return (
    <span className={cn("relative mr-1.5 inline-flex h-2 w-2", className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
    </span>
  );
}
