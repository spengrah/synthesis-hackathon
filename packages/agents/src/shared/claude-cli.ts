import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir, homedir } from "node:os";
import { randomUUID } from "node:crypto";

/**
 * Directory where LLM session transcripts are saved.
 * Defaults to packages/agents/llm-sessions/ in the project repo.
 */
const DEFAULT_SESSIONS_DIR = resolve(import.meta.dirname, "../../llm-sessions");

/**
 * Low-level: run a prompt through `claude -p` and return the raw text response.
 * Saves session transcripts for auditability.
 */
export function runClaudeCli(
  prompt: string,
  opts?: { sessionsDir?: string; sessionPrefix?: string },
): string {
  const sessionsDir = opts?.sessionsDir ?? DEFAULT_SESSIONS_DIR;
  const prefix = opts?.sessionPrefix ?? "llm";
  const promptFile = join(tmpdir(), `tz-${prefix}-${Date.now()}.txt`);
  const sessionId = randomUUID();

  try {
    writeFileSync(promptFile, prompt, "utf-8");

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

    copySessionTranscript(sessionId, sessionsDir, prefix);

    return cleaned;
  } finally {
    try { unlinkSync(promptFile); } catch { /* ignore */ }
  }
}

// ---- Adjudicator-specific generate ----

import type { Verdict, GenerateObjectFn } from "../adjudicator/evaluate.js";

/**
 * Create a GenerateObjectFn for the adjudicator that uses `claude -p` (Haiku).
 */
export function createClaudeCliGenerate(opts?: {
  sessionsDir?: string;
}): GenerateObjectFn {
  return async (generateOpts) => {
    const fullPrompt = [
      "Classify whether a Trust Zone agreement directive was violated based on the evidence below.",
      "",
      generateOpts.prompt,
      "",
      "Based on the directives and evidence above, output a JSON verdict:",
      '{"violated": true/false, "violatedDirectives": [directive index numbers], "reasoning": "one sentence", "actions": ["CLOSE"] if violated, [] if not}',
    ].join("\n");

    try {
      const cleaned = runClaudeCli(fullPrompt, {
        sessionsDir: opts?.sessionsDir,
        sessionPrefix: "adjudication",
      });

      const parsed = JSON.parse(cleaned) as Verdict;
      if (typeof parsed.violated !== "boolean") throw new Error("Invalid: missing violated");
      if (!Array.isArray(parsed.actions)) throw new Error("Invalid: missing actions");

      return { object: parsed };
    } catch (err) {
      console.error("[claude-cli] Adjudicator LLM call failed:", (err as Error).message?.slice(0, 200));
      return {
        object: {
          violated: false,
          violatedDirectives: [],
          reasoning: `LLM evaluation failed: ${(err as Error).message?.slice(0, 100)}`,
          actions: [],
        },
      };
    }
  };
}

// ---- Session transcript handling ----

function copySessionTranscript(sessionId: string, sessionsDir: string, prefix: string): void {
  const tmpDir = tmpdir();
  const encodedCwd = tmpDir.replace(/\//g, "-");
  const claudeSessionsDir = join(homedir(), ".claude", "projects", encodedCwd);
  const sessionFile = join(claudeSessionsDir, `${sessionId}.jsonl`);

  if (!existsSync(sessionFile)) {
    const altPath = join(homedir(), ".claude", "projects", `-private${encodedCwd}`, `${sessionId}.jsonl`);
    if (!existsSync(altPath)) {
      console.log(`[claude-cli] Session file not found: ${sessionFile} or ${altPath}`);
      return;
    }
    doCopy(altPath, sessionsDir, sessionId, prefix);
    return;
  }

  doCopy(sessionFile, sessionsDir, sessionId, prefix);
}

function doCopy(src: string, destDir: string, sessionId: string, prefix: string): void {
  mkdirSync(destDir, { recursive: true });
  const dest = join(destDir, `${prefix}-${sessionId}.jsonl`);
  copyFileSync(src, dest);
  console.log(`[claude-cli] Session transcript saved to ${dest}`);
}
