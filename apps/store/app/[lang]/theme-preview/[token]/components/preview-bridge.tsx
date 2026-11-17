"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  PREVIEW_REFRESH_MESSAGE,
  PREVIEW_SECTION_ATTRIBUTE,
  readEditorMessage,
  type PreviewToEditorMessage,
} from "@repo/core/themes/preview";

type Box = { top: number; left: number; width: number; height: number };

function sectionOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(`[${PREVIEW_SECTION_ATTRIBUTE}]`) : null;
}

function findSection(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${PREVIEW_SECTION_ATTRIBUTE}="${CSS.escape(id)}"]`);
}

// Scrolls only this page: scrollIntoView would also scroll the editor around the iframe. A sticky
// header would cover the section's top, so it's left room.
function scrollToSection(element: HTMLElement) {
  const header = document.querySelector<HTMLElement>("header.sticky");
  const offset = header && !header.contains(element) ? header.offsetHeight : 0;
  window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });
}

function boxOf(element: HTMLElement | null): Box | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { top: rect.top + window.scrollY, left: rect.left + window.scrollX, width: rect.width, height: rect.height };
}

// Inside the editor's iframe:
// - the editor posts "refresh" after each autosave, and the page re-renders from the new draft
//   without reloading (the scroll position stays);
// - hovering a section outlines it with its name, clicking selects it in the editor, and the
//   editor's selection scrolls here and stays outlined;
// - links and forms do nothing, so the preview stays on the draft and never signs anyone up.
export function PreviewBridge({ admin_origin }: { admin_origin: string }) {
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [labels, setLabels] = useState<Record<string, string>>({});
  // Re-measured after scrolls, resizes and re-renders.
  const [, setTick] = useState(0);
  const selected_ref = useRef("");
  // A section the editor selected before it was on the page (just added): scrolled to as soon as
  // the refreshed page shows it.
  const pending_scroll = useRef("");

  useEffect(() => {
    const post = (message: PreviewToEditorMessage) => window.parent.postMessage(message, admin_origin);

    function onMessage(event: MessageEvent) {
      if (event.origin !== admin_origin) return;
      if (event.data === PREVIEW_REFRESH_MESSAGE) {
        router.refresh();
        return;
      }
      const message = readEditorMessage(event.data);
      if (message?.type === "theme-preview:labels") setLabels(message.labels);
      if (message?.type === "theme-preview:focus") {
        const is_new = message.id !== selected_ref.current;
        selected_ref.current = message.id;
        setSelected(message.id);
        if (is_new && message.id) {
          const section = findSection(message.id);
          if (section) scrollToSection(section);
          else pending_scroll.current = message.id;
        }
      }
    }
    function onClick(event: MouseEvent) {
      if (event.target instanceof Element && event.target.closest("a")) event.preventDefault();
      const section = sectionOf(event.target);
      const id = section?.getAttribute(PREVIEW_SECTION_ATTRIBUTE);
      if (id) {
        selected_ref.current = id;
        setSelected(id);
        post({ type: "theme-preview:select", id });
      }
    }
    function onMove(event: MouseEvent) {
      setHovered(sectionOf(event.target)?.getAttribute(PREVIEW_SECTION_ATTRIBUTE) ?? null);
    }
    function onLeave() {
      setHovered(null);
    }
    function onSubmit(event: SubmitEvent) {
      event.preventDefault();
    }
    const remeasure = () => setTick((value) => value + 1);
    const observer = new ResizeObserver(remeasure);
    observer.observe(document.body);
    const mutations = new MutationObserver(() => {
      if (!pending_scroll.current) return;
      const section = findSection(pending_scroll.current);
      if (!section) return;
      pending_scroll.current = "";
      scrollToSection(section);
      remeasure();
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("message", onMessage);
    window.addEventListener("scroll", remeasure, { passive: true });
    document.addEventListener("click", onClick, true);
    document.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.addEventListener("submit", onSubmit, true);
    post({ type: "theme-preview:ready" });
    return () => {
      observer.disconnect();
      mutations.disconnect();
      window.removeEventListener("message", onMessage);
      window.removeEventListener("scroll", remeasure);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [admin_origin, router]);

  const selected_box = selected ? boxOf(findSection(selected)) : null;
  const hovered_box = hovered && hovered !== selected ? boxOf(findSection(hovered)) : null;

  return (
    <>
      {selected_box && <Outline box={selected_box} label={labels[selected]} is_selected />}
      {hovered_box && hovered && <Outline box={hovered_box} label={labels[hovered]} />}
    </>
  );
}

function Outline({ box, label, is_selected = false }: { box: Box; label?: string; is_selected?: boolean }) {
  // Drawn on top of the page (absolute, page coordinates) so sections keep their own layout.
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-[60]"
      style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
    >
      <div
        className={
          is_selected
            ? "outline-ring absolute inset-0 outline-2 -outline-offset-2"
            : "outline-ring/60 absolute inset-0 outline-1 -outline-offset-1 outline-dashed"
        }
      />
      {label && (
        <span className="bg-foreground text-background absolute top-0 left-0 rounded-br px-2 py-0.5 text-xs font-medium">
          {label}
        </span>
      )}
    </div>
  );
}
