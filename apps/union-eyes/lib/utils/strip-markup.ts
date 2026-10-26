/**
 * Reduce markup to plain text without regex substitution.
 *
 * Tags, comments and the content of `<script>` and `<style>` blocks are dropped, and no `<` or `>` is ever emitted, so
 * the result can never contain or reassemble into markup (`<scr<script>ipt>` yields `ipt`, not a tag). An unterminated
 * `<` is dropped on its own and the text after it is kept. The scan is linear in the input.
 */
export function stripMarkup(input: string): string {
  const text = String(input ?? '');
  const lower = text.toLowerCase();
  let out = '';
  let i = 0;
  // Once a search for `>` fails, no later `<` can find one either, so the scan stays linear.
  let noMoreClose = false;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '>') {
      i++;
      continue;
    }
    if (ch !== '<') {
      out += ch;
      i++;
      continue;
    }
    const close = noMoreClose ? -1 : text.indexOf('>', i + 1);
    if (close === -1) {
      noMoreClose = true;
      i++;
      continue;
    }
    const inner = lower.slice(i + 1, close);
    const opening = /^\s*(script|style)(?![a-z0-9])/.exec(inner);
    i = close + 1;
    if (!opening) continue;
    const end = lower.indexOf(`</${opening[1]}`, i);
    if (end === -1) {
      i = text.length;
      continue;
    }
    const endClose = text.indexOf('>', end);
    i = endClose === -1 ? text.length : endClose + 1;
  }
  return out;
}
