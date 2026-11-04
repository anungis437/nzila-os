import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { renderTypedSignature } from '../typed-signature';

function fakeCanvas(dataUrl: string, context: Partial<CanvasRenderingContext2D> | null = {}) {
  const drawn = { fillText: vi.fn(), clearRect: vi.fn() };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => (context === null ? null : ({ ...drawn, ...context } as unknown as CanvasRenderingContext2D)),
    toDataURL: () => dataUrl,
  };
  return { canvas, drawn };
}

const nodeDigest = (bytes: Uint8Array) => Promise.resolve(createHash('sha256').update(bytes).digest().buffer.slice(0) as ArrayBuffer);

describe('renderTypedSignature', () => {
  it('draws the typed name and returns the image with the SHA-256 of its bytes (64 hex characters)', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const { canvas, drawn } = fakeCanvas(png);
    const signature = await renderTypedSignature('  Ada Lovelace ', () => canvas, nodeDigest);

    expect(drawn.fillText).toHaveBeenCalledWith('Ada Lovelace', expect.any(Number), expect.any(Number), expect.any(Number));
    expect(signature.imageUrl).toBe(png);
    expect(signature.imageHash).toBe(createHash('sha256').update(Buffer.from('iVBORw0KGgo=', 'base64')).digest('hex'));
    expect(signature.imageHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses an empty name, a browser that cannot draw, and a canvas that produced no image', async () => {
    await expect(renderTypedSignature('   ', () => fakeCanvas('data:image/png;base64,AAAA').canvas, nodeDigest)).rejects.toThrow(/needs a name/);
    await expect(renderTypedSignature('Ada', () => fakeCanvas('data:image/png;base64,AAAA', null).canvas, nodeDigest)).rejects.toThrow(/cannot draw/);
    await expect(renderTypedSignature('Ada', () => fakeCanvas('data:,').canvas, nodeDigest)).rejects.toThrow(/could not be drawn/);
    await expect(renderTypedSignature('Ada', () => fakeCanvas('data:image/png;base64,').canvas, nodeDigest)).rejects.toThrow(/could not be drawn/);
  });
});
