"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type CursorMode = "default" | "pointer" | "crosshair" | "text";

function resolveMode(target: Element | null): CursorMode {
  if (!target) return "default";
  const el = target.closest(
    "[data-cursor='crosshair'], button, a, [role='button'], label, input, textarea, select, .studio-clickable, .picker-card, .picker-next",
  );
  if (!el) return "default";
  if (el.matches("[data-cursor='crosshair']")) return "crosshair";
  if (el.matches("input, textarea, select") || el.closest("[contenteditable='true']")) return "text";
  if (el.matches("button, a, [role='button'], label, .studio-clickable, .picker-card, .picker-next")) return "pointer";
  return "default";
}

function CursorSvg({ mode }: { mode: CursorMode }) {
  if (mode === "crosshair") {
    return (
      <svg className="figma-cursor-svg" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="3" fill="#0d99ff" stroke="#fff" strokeWidth="2" />
        <line x1="16" y1="4" x2="16" y2="11" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
        <line x1="16" y1="21" x2="16" y2="28" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
        <line x1="4" y1="16" x2="11" y2="16" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
        <line x1="21" y1="16" x2="28" y2="16" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (mode === "pointer") {
    return (
      <svg className="figma-cursor-svg" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M9.5 4.5C9.5 4.5 7.5 10 5.5 13.5C8 13 11.5 12 13 14.5L13.5 21.5C13.5 21.5 14.2 22.5 15.8 21C16.5 18.5 18 15 20 13C17.5 11 14.5 8.5 12 6.5Z"
          fill="#18181b"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (mode === "text") {
    return (
      <svg className="figma-cursor-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3v18M8 3h8M8 21h8" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 3v18M8 3h8M8 21h8" stroke="#fff" strokeWidth="0.75" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className="figma-cursor-svg" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 3L4 18.5L8.5 14.5L11.5 22.5L13.5 21.5L10.5 13.5L17.5 13.5Z"
        fill="#18181b"
        stroke="#ffffff"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FigmaCursor() {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [mode, setMode] = useState<CursorMode>("default");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (coarse) return;

    document.body.classList.add("figma-cursor-active");

    function onMove(e: MouseEvent) {
      setPos({ x: e.clientX, y: e.clientY });
      setVisible(true);
      const target = document.elementFromPoint(e.clientX, e.clientY);
      setMode(resolveMode(target));
    }

    function onLeave() {
      setVisible(false);
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);

    return () => {
      document.body.classList.remove("figma-cursor-active");
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="figma-cursor-layer"
      data-mode={mode}
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        opacity: visible ? 1 : 0,
      }}
    >
      <CursorSvg mode={mode} />
    </div>,
    document.body,
  );
}
