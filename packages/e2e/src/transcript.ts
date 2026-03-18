import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface TranscriptEntry {
  timestamp: number;
  beat: string;
  type: "action" | "result" | "assertion" | "info";
  message: string;
  details?: Record<string, unknown>;
}

export class Transcript {
  private entries: TranscriptEntry[] = [];
  private startTime = Date.now();
  private currentBeat = "";

  beat(name: string): void {
    this.currentBeat = name;
    this.entries.push({
      timestamp: Date.now() - this.startTime,
      beat: name,
      type: "info",
      message: `--- ${name} ---`,
    });
  }

  action(message: string, details?: Record<string, unknown>): void {
    this.entries.push({
      timestamp: Date.now() - this.startTime,
      beat: this.currentBeat,
      type: "action",
      message,
      details,
    });
  }

  result(message: string, details?: Record<string, unknown>): void {
    this.entries.push({
      timestamp: Date.now() - this.startTime,
      beat: this.currentBeat,
      type: "result",
      message,
      details,
    });
  }

  assert(message: string): void {
    this.entries.push({
      timestamp: Date.now() - this.startTime,
      beat: this.currentBeat,
      type: "assertion",
      message,
    });
  }

  /** Render the transcript as markdown. */
  toMarkdown(): string {
    const lines: string[] = [];
    lines.push("# Trust Zones E2E Demo Transcript");
    lines.push("");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Duration: ${((Date.now() - this.startTime) / 1000).toFixed(1)}s`);
    lines.push("");

    let lastBeat = "";
    for (const entry of this.entries) {
      if (entry.beat !== lastBeat) {
        lastBeat = entry.beat;
        lines.push(`## ${entry.beat}`);
        lines.push("");
      }

      const ts = `\`${(entry.timestamp / 1000).toFixed(1)}s\``;

      switch (entry.type) {
        case "action":
          lines.push(`${ts} **${entry.message}**`);
          break;
        case "result":
          lines.push(`${ts} ${entry.message}`);
          break;
        case "assertion":
          lines.push(`${ts} - [x] ${entry.message}`);
          break;
        case "info":
          // beat header already rendered
          break;
      }

      if (entry.details) {
        lines.push("");
        lines.push("```json");
        lines.push(JSON.stringify(entry.details, (_k, v) =>
          typeof v === "bigint" ? v.toString() : v,
        2));
        lines.push("```");
      }

      lines.push("");
    }

    return lines.join("\n");
  }

  /** Write transcript to a file. */
  save(filename = "transcript.md"): string {
    const outPath = resolve(import.meta.dirname, "../", filename);
    writeFileSync(outPath, this.toMarkdown());
    console.log(`Transcript saved to ${outPath}`);
    return outPath;
  }
}
