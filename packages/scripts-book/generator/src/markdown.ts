/**
 * markdown.ts — Lightweight markdown checks (MD032: blank lines around lists).
 */

import pc from "picocolors";

export interface MarkdownWarning {
  file: string;
  line: number;
  message: string;
}

/**
 * Check a markdown string for common MD032 violations:
 * a list item (starting with `- ` or `* ` or a numbered list) that is not
 * preceded or followed by a blank line.
 */
export function checkMD032(content: string, filePath: string): MarkdownWarning[] {
  const warnings: MarkdownWarning[] = [];
  const lines = content.split("\n");

  const isListLine = (line: string): boolean =>
    /^\s*[-*+]\s/.test(line) || /^\s*\d+\.\s/.test(line);

  const isBlank = (line: string): boolean => line.trim() === "";

  for (let i = 0; i < lines.length; i++) {
    if (!isListLine(lines[i])) continue;

    // Check for blank line before the first list item in a block
    if (i > 0 && !isBlank(lines[i - 1]) && !isListLine(lines[i - 1])) {
      warnings.push({
        file: filePath,
        line: i + 1,
        message: "MD032: No blank line before list item",
      });
    }

    // Find end of list block
    let end = i;
    while (end < lines.length && (isListLine(lines[end]) || isBlank(lines[end]))) {
      end++;
    }

    // Check for blank line after the last list item
    const lastListIdx = end - 1;
    if (
      lastListIdx < lines.length - 1 &&
      !isBlank(lines[lastListIdx]) &&
      isListLine(lines[lastListIdx]) &&
      !isBlank(lines[end]) &&
      end < lines.length
    ) {
      warnings.push({
        file: filePath,
        line: end + 1,
        message: "MD032: No blank line after list block",
      });
    }

    // Skip to end of block to avoid duplicate warnings
    i = end - 1;
  }

  return warnings;
}

/** Print markdown warnings. */
export function printMarkdownWarnings(warnings: MarkdownWarning[]): void {
  for (const w of warnings) {
    console.warn(pc.yellow(`  ${w.file}:${w.line} — ${w.message}`));
  }
}
