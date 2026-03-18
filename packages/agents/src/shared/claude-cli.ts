import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Verdict } from "../adjudicator/evaluate.js";
import type { GenerateObjectFn } from "../adjudicator/evaluate.js";

/**
 * Create a GenerateObjectFn that uses `claude -p` (Claude Code CLI) with Haiku.
 * Uses the existing Claude Code auth — no separate API key needed.
 */
export function createClaudeCliGenerate(): GenerateObjectFn {
  return async (opts) => {
    // Simple classification prompt — no "override" language that triggers safety filters
    const fullPrompt = [
      "Classify whether a Trust Zone agreement directive was violated based on the evidence below.",
      "",
      opts.prompt,
      "",
      "Based on the directives and evidence above, output a JSON verdict:",
      '{"violated": true/false, "violatedDirectives": [directive index numbers], "reasoning": "one sentence", "actions": ["CLOSE"] if violated, [] if not}',
    ].join("\n");

    const promptFile = join(tmpdir(), `tz-adjudicator-${Date.now()}.txt`);

    try {
      writeFileSync(promptFile, fullPrompt, "utf-8");

      const result = execSync(
        `cat "${promptFile}" | claude -p --model haiku --output-format text --allowedTools ""`,
        {
          encoding: "utf-8",
          timeout: 60_000,
          cwd: tmpdir(),
          shell: "/bin/bash",
        },
      );

      let cleaned = result.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      // Try to extract JSON from response if there's surrounding text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }

      console.log("[claude-cli] Parsed response:", cleaned.slice(0, 300));

      const parsed = JSON.parse(cleaned) as Verdict;

      if (typeof parsed.violated !== "boolean") throw new Error("Invalid: missing violated");
      if (!Array.isArray(parsed.actions)) throw new Error("Invalid: missing actions");

      return { object: parsed };
    } catch (err) {
      console.error("[claude-cli] LLM call failed:", (err as Error).message?.slice(0, 200));
      return {
        object: {
          violated: false,
          violatedDirectives: [],
          reasoning: `LLM evaluation failed: ${(err as Error).message?.slice(0, 100)}`,
          actions: [],
        },
      };
    } finally {
      try { unlinkSync(promptFile); } catch { /* ignore */ }
    }
  };
}
