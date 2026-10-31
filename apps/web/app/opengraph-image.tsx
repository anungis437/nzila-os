import { ImageResponse } from 'next/og';

export const alt = 'Nzila Ventures — Software for institutional continuity';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(120deg, #080e1c 0%, #142541 68%, #102136 100%)',
          color: '#ffffff',
          padding: 74,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              background: '#2563eb',
              borderRadius: 14,
              fontWeight: 700,
              fontSize: 21,
            }}
          >
            NV
          </div>
          <div style={{ display: 'flex', fontSize: 31, fontWeight: 700, letterSpacing: -1 }}>
            Nzila Ventures
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
          <div style={{ display: 'flex', color: '#dfbe70', letterSpacing: 3, textTransform: 'uppercase', fontSize: 20 }}>
            Institutional software · Nzila OS
          </div>
          <div style={{ display: 'flex', maxWidth: 980, fontSize: 67, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2 }}>
            Build continuity. Preserve accountability.
          </div>
          <div style={{ display: 'flex', fontSize: 23, color: '#cbd5e1' }}>
            Union Eyes · CIVIC · Nzila Ventures
          </div>
        </div>
        <div style={{ display: 'flex', width: '100%', height: 3, background: '#dfbe70' }} />
      </div>
    ),
    size,
  );
}
