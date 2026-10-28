import { cn } from "@/lib/utils";

type Block =
  { type: "heading"; text: string } | { type: "list"; items: string[] } | { type: "paragraph"; text: string };

// Admin-written page text → blocks. A tiny, safe subset of Markdown, so admins can structure
// legal pages without writing HTML:
//   "# Title" or "## Title" → heading; lines starting with "- " → list; blank line → new paragraph.
// Everything is rendered as text (React escapes it), never as HTML.
export function parseRichText(text: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of text.replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
    const lines = chunk.split("\n").filter((line) => line.trim());
    if (lines.length === 0) continue;
    if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0])) {
      blocks.push({ type: "heading", text: lines[0].replace(/^#{1,3}\s+/, "") });
    } else if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
      blocks.push({ type: "list", items: lines.map((line) => line.replace(/^\s*[-*]\s+/, "")) });
    } else {
      blocks.push({ type: "paragraph", text: lines.join("\n") });
    }
  }
  return blocks;
}

export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("text-muted-foreground flex flex-col gap-5 leading-relaxed", className)}>
      {parseRichText(text).map((block, index) => {
        if (block.type === "heading") {
          return (
            <h2 key={index} className="font-display text-foreground mt-4 text-2xl font-medium tracking-tight">
              {block.text}
            </h2>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={index} className="flex list-disc flex-col gap-1.5 pl-5">
              {block.items.map((item, item_index) => (
                <li key={item_index}>{item}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="whitespace-pre-line">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
