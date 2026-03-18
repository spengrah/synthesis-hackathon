import { execSync } from "node:child_process";
import { writeFileSync, readFileSync, unlinkSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir, homedir } from "node:os";
import { randomUUID } from "node:crypto";
import type { Verdict } from "../adjudicator/evaluate.js";
import type { GenerateObjectFn } from "../adjudicator/evaluate.js";

/**
 * Directory where adjudicator LLM session transcripts are saved.
 * Defaults to packages/agents/llm-sessions/ in the project repo.
 */
const DEFAULT_SESSIONS_DIR = resolve(import.meta.dirname, "../../llm-sessions");

/**
 * Create a GenerateObjectFn that uses `claude -p` (Claude Code CLI) with Haiku.
 * Uses the existing Claude Code auth — no separate API key needed.
 * Saves session transcripts to the project repo for auditability.
 */
export function createClaudeCliGenerate(opts?: {
  sessionsDir?: string;
}): GenerateObjectFn {
  const sessionsDir = opts?.sessionsDir ?? DEFAULT_SESSIONS_DIR;

  return async (generateOpts) => {
    const fullPrompt = [
      "Classify whether a Trust Zone agreement directive was violated based on the evidence below.",
      "",
      generateOpts.prompt,
      "",
      "Based on the directives and evidence above, output a JSON verdict:",
      '{"violated": true/false, "violatedDirectives": [directive index numbers], "reasoning": "one sentence", "actions": ["CLOSE"] if violated, [] if not}',
    ].join("\n");

    const promptFile = join(tmpdir(), `tz-adjudicator-${Date.now()}.txt`);
    const sessionId = randomUUID();

    try {
      writeFileSync(promptFile, fullPrompt, "utf-8");

      // Use --session-id so we know exactly which file to find,
      // and --output-format json to get session metadata
      const rawResult = execSync(
        `cat "${promptFile}" | claude -p --model haiku --output-format json --allowedTools "" --session-id ${sessionId}`,
        {
          encoding: "utf-8",
          timeout: 60_000,
          cwd: tmpdir(),
          shell: "/bin/bash",
        },
      );

      // Parse the JSON envelope to get the text result
      let textResult: string;
      try {
        const envelope = JSON.parse(rawResult);
        textResult = envelope.result ?? "";
      } catch {
        // If JSON parsing fails, treat as raw text
        textResult = rawResult;
      }

      // Strip markdown fences if present
      let cleaned = textResult.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      // Extract JSON from response if there's surrounding text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }

      const parsed = JSON.parse(cleaned) as Verdict;

      if (typeof parsed.violated !== "boolean") throw new Error("Invalid: missing violated");
      if (!Array.isArray(parsed.actions)) throw new Error("Invalid: missing actions");

      // Save session transcript to project repo
      copySessionTranscript(sessionId, sessionsDir);

      return { object: parsed };
    } catch (err) {
      console.error("[claude-cli] LLM call failed:", (err as Error).message?.slice(0, 200));

      // Still try to save the session (may contain useful debug info)
      try { copySessionTranscript(sessionId, sessionsDir); } catch { /* ignore */ }

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

/**
 * Copy a claude session JSONL file from ~/.claude/ to the project sessions dir.
 */
function copySessionTranscript(sessionId: string, sessionsDir: string): void {
  // claude stores sessions under ~/.claude/projects/<encoded-cwd>/<session-id>.jsonl
  // Since we run from tmpdir(), the path encodes the temp dir
  const tmpDir = tmpdir();
  const encodedCwd = tmpDir.replace(/\//g, "-");
  const claudeSessionsDir = join(homedir(), ".claude", "projects", encodedCwd);
  const sessionFile = join(claudeSessionsDir, `${sessionId}.jsonl`);

  if (!existsSync(sessionFile)) {
    // Try alternate path encoding (macOS /private prefix)
    const altPath = join(homedir(), ".claude", "projects", `-private${encodedCwd}`, `${sessionId}.jsonl`);
    if (!existsSync(altPath)) {
      console.log(`[claude-cli] Session file not found: ${sessionFile} or ${altPath}`);
      return;
    }
    doCopy(altPath, sessionsDir, sessionId);
    return;
  }

  doCopy(sessionFile, sessionsDir, sessionId);
}

function doCopy(src: string, destDir: string, sessionId: string): void {
  mkdirSync(destDir, { recursive: true });
  const dest = join(destDir, `adjudication-${sessionId}.jsonl`);
  copyFileSync(src, dest);
  console.log(`[claude-cli] Session transcript saved to ${dest}`);
}
