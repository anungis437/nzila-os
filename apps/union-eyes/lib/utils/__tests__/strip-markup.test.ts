import { describe, expect, it } from 'vitest';
import { stripMarkup } from '../strip-markup';

describe('stripMarkup', () => {
  it('keeps text, drops tags, and never emits an angle bracket', () => {
    expect(stripMarkup('<p>Hello <b>member</b></p>')).toBe('Hello member');
    expect(stripMarkup('<div>Grievance <i>12</i></div>')).toBe('Grievance 12');
    expect(stripMarkup('a > b')).toBe('a  b');
  });

  it('drops script and style blocks in any case, with attributes and spaced closing tags', () => {
    expect(stripMarkup('a<script>alert(1)</script>b<style>p{}</style>c')).toBe('abc');
    expect(stripMarkup('a<SCRIPT type="text/javascript">x()</SCRIPT >b')).toBe('ab');
    expect(stripMarkup('a<script\n>x</script\n>b')).toBe('ab');
    expect(stripMarkup('x<script>never closed')).toBe('x');
  });

  it('cannot reassemble a tag from nested or broken fragments', () => {
    for (const input of ['<scr<script>ipt>alert(1)</scr</script>ipt>', '<<b>script>alert(1)<</b>/script>', '<img src=x onerror=alert(1)//', '<!-- <script> -->x', '<<<>>>', '<a href="x">', '<']) {
      expect(stripMarkup(input), input).not.toMatch(/[<>]/);
    }
    expect(stripMarkup('<scr<script>ipt>alert(1)</scr</script>ipt>')).toBe('iptalert(1)ipt');
  });

  it('keeps text around an unterminated bracket and tolerates non-strings', () => {
    expect(stripMarkup('if a<b then')).toBe('if ab then');
    expect(stripMarkup(undefined as unknown as string)).toBe('');
  });

  it('is linear on long hostile input', () => {
    const started = Date.now();
    stripMarkup('<'.repeat(200_000));
    stripMarkup('<a'.repeat(100_000));
    stripMarkup('<script>'.repeat(50_000));
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});
