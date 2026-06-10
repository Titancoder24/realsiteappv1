"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type CursorMode = "default" | "pointer" | "crosshair" | "text";

const INTERACTIVE_SELECTOR =
  "[data-cursor='crosshair'], button, a, [role='button'], label, input, textarea, select, [contenteditable='true'], .studio-clickable, .picker-card, .picker-next";

function resolveMode(target: EventTarget | null): CursorMode {
  if (!(target instanceof Element)) return "default";
  const el = target.closest(INTERACTIVE_SELECTOR);
  if (!el) return "default";
  if (el.matches("[data-cursor='crosshair']")) return "crosshair";
  if (el.matches("input, textarea, select, [contenteditable='true']")) return "text";
  return "pointer";
}

/**
 * Performance notes:
 * - Position updates write `style.transform` directly on the DOM node from the
 *   `pointermove` handler — no React state, no re-renders, no rAF latency.
 * - Mode detection runs on `pointerover` only (fires when the hovered element
 *   changes), instead of an `elementFromPoint` hit-test on every move.
 * - All cursor variants are rendered once; CSS `data-mode` toggles visibility,
 *   so changing mode never re-renders React either.
 */
export function FigmaCursor() {
  const [mounted, setMounted] = useState(false);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const layer = layerRef.current;
    if (!layer) return;

    document.body.classList.add("figma-cursor-active");

    const onMove = (e: PointerEvent) => {
      layer.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      if (layer.style.opacity !== "1") layer.style.opacity = "1";
    };

    const onOver = (e: PointerEvent) => {
      const mode = resolveMode(e.target);
      if (layer.dataset.mode !== mode) layer.dataset.mode = mode;
    };

    const onLeave = () => {
      layer.style.opacity = "0";
    };

    const onDown = () => layer.classList.add("figma-cursor-down");
    const onUp = () => layer.classList.remove("figma-cursor-down");

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerover", onOver, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      document.body.classList.remove("figma-cursor-active");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div ref={layerRef} className="figma-cursor-layer" data-mode="default" style={{ opacity: 0 }}>
      {/* Default — bold Figma arrow, leaning left */}
      <svg className="figma-cursor-svg" data-cursor-mode="default" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M5 3L5 26L11.5 20L15.5 30.5L19.5 28.5L15.5 18.5L24.5 18.5Z"
          fill="#0a0a0a"
          stroke="#ffffff"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>

      {/* Pointer — hand */}
      <svg className="figma-cursor-svg" data-cursor-mode="pointer" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M9.5 4.5C9.5 4.5 7.5 10 5.5 13.5C8 13 11.5 12 13 14.5L13.5 21.5C13.5 21.5 14.2 22.5 15.8 21C16.5 18.5 18 15 20 13C17.5 11 14.5 8.5 12 6.5Z"
          fill="#18181b"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>

      {/* Crosshair — pin placement */}
      <svg className="figma-cursor-svg" data-cursor-mode="crosshair" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="3" fill="#0d99ff" stroke="#fff" strokeWidth="2" />
        <line x1="16" y1="4" x2="16" y2="11" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
        <line x1="16" y1="21" x2="16" y2="28" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
        <line x1="4" y1="16" x2="11" y2="16" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
        <line x1="21" y1="16" x2="28" y2="16" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
      </svg>

      {/* Text — I-beam */}
      <svg className="figma-cursor-svg" data-cursor-mode="text" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3v18M8 3h8M8 21h8" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 3v18M8 3h8M8 21h8" stroke="#fff" strokeWidth="0.75" strokeLinecap="round" />
      </svg>
    </div>,
    document.body,
  );
}
