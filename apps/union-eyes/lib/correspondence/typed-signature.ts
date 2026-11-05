/**
 * A signature made from a typed name, for POST /api/correspondence/signatures.
 *
 * The name is drawn on a transparent canvas and kept as a PNG data address; the route also takes the SHA-256 of the image, which is what a later
 * check of the signature on a signed letter compares against. "typed" is one of the signature sources the schema defines (drawn, uploaded, typed).
 */
export interface TypedSignature {
  imageUrl: string;
  imageHash: string;
}

const WIDTH = 640;
const HEIGHT = 160;
const PNG_PREFIX = 'data:image/png;base64,';

interface CanvasLike {
  width: number;
  height: number;
  getContext(kind: '2d'): CanvasRenderingContext2D | null;
  toDataURL(type: 'image/png'): string;
}

export async function renderTypedSignature(
  displayName: string,
  makeCanvas: () => CanvasLike = () => document.createElement('canvas'),
  digest: (bytes: Uint8Array<ArrayBuffer>) => Promise<ArrayBuffer> = (bytes) => crypto.subtle.digest('SHA-256', bytes),
): Promise<TypedSignature> {
  const name = displayName.trim();
  if (!name) throw new Error('A signature needs a name.');

  const canvas = makeCanvas();
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot draw a signature.');
  context.clearRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = '#111827';
  context.font = 'italic 64px "Segoe Script", "Brush Script MT", "Snell Roundhand", cursive';
  context.textBaseline = 'middle';
  context.fillText(name, 24, HEIGHT / 2, WIDTH - 48);

  const imageUrl = canvas.toDataURL('image/png');
  if (!imageUrl.startsWith(PNG_PREFIX) || imageUrl.length === PNG_PREFIX.length) throw new Error('The signature could not be drawn.');
  const bytes = Uint8Array.from(atob(imageUrl.slice(PNG_PREFIX.length)), (character) => character.charCodeAt(0));
  const imageHash = Array.from(new Uint8Array(await digest(bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return { imageUrl, imageHash };
}
