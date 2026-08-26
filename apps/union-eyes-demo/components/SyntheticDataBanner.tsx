/**
 * Synthetic-data banner — Union Eyes Demo.
 *
 * Wave 0 §3: every rendered page in the demo artifact must show a
 * visible, non-dismissable marker that this is synthetic data.
 * Mounted at the root layout so it renders under every route.
 */
import { getTranslations } from 'next-intl/server';

export async function SyntheticDataBanner() {
  const t = await getTranslations('banner');
  return (
    <div
      role="alert"
      aria-label={t('synthetic')}
      data-testid="ue-demo-synthetic-banner"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        background:
          'repeating-linear-gradient(45deg, #d97706, #d97706 12px, #b45309 12px, #b45309 24px)',
        color: '#fff8ec',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        fontSize: '12px',
        lineHeight: 1.4,
        letterSpacing: '0.02em',
        padding: '6px 14px',
        borderBottom: '2px solid #78350f',
        boxShadow: '0 1px 0 rgba(0,0,0,0.15)',
        textAlign: 'center' as const,
      }}
    >
      <strong style={{ textTransform: 'uppercase', marginRight: 8 }}>
        {t('target')}
      </strong>
      <span>{t('synthetic')}</span>
    </div>
  );
}
