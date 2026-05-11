/**
 * Marketing Hero Section Component
 *
 * Reusable hero banner with background imagery, overlay, and text overlay.
 * Responsive and optimized for mobile/tablet/desktop.
 */
import ScrollReveal from '@/components/public/scroll-reveal';

interface HeroSectionProps {
  /**
   * Background image URL
   */
  imageUrl: string;

  /**
   * Hero heading (supports React nodes)
   */
  heading: React.ReactNode;

  /**
   * Hero description/subheading
   */
  description: React.ReactNode;

  /**
   * Optional badge (React node displayed above heading)
   */
  badge?: React.ReactNode;

  /**
   * Optional CTA button or additional content below description
   */
  cta?: React.ReactNode;

  /**
   * Optional overlay opacity (0-1, default 0.65)
   */
  overlayOpacity?: number;

  /**
   * Optional additional className for the wrapper
   */
  className?: string;

  /**
   * Controls whether the hero card uses light text over a dark card or dark text over a light card.
   */
  tone?: 'light' | 'dark';

  /**
   * Controls pacing for hero reveal choreography.
   */
  revealTempo?: 'default' | 'conference';

  /**
   * Optional context kicker rendered above contextual framing note.
   */
  contextKicker?: React.ReactNode;

  /**
   * Optional context framing note for presentation-only adaptive guidance.
   */
  contextNote?: React.ReactNode;
}

export function MarketingHeroSection({
  imageUrl,
  heading,
  description,
  badge,
  cta,
  overlayOpacity = 0.65,
  className = '',
  tone = 'dark',
  revealTempo = 'default',
  contextKicker,
  contextNote,
}: HeroSectionProps) {
  const isDarkTone = tone === 'dark';

  return (
    <header
      className={`relative overflow-hidden pt-24 pb-20 sm:pt-28 sm:pb-24 ${className}`}
      style={{
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
      }}
    >
      {/* Primary atmospheric overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(14,31,47,0.78) 0%, rgba(14,31,47,0.72) 46%, rgba(14,31,47,0.84) 100%)',
        }}
      />

      {/* Warm institutional wash */}
      <div
        className="absolute inset-0"
        style={{ opacity: overlayOpacity }}
      />

      {/* Content */}
      <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 lg:px-8 pb-6 pointer-events-none" aria-hidden>
        <div className="max-w-6xl mx-auto">
          <div className="continuity-flow-track continuity-stabilize-track opacity-75" />
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`institution-panel continuity-guidance-shell mx-auto max-w-4xl p-6 sm:p-9 lg:p-10 ${
            isDarkTone
              ? 'bg-[#f4f7fb]/82 border-slate-200/75 backdrop-blur-md shadow-[0_18px_60px_rgba(9,18,29,0.16)]'
              : 'bg-white/10 border-white/25'
          }`}
        >
          <div className="text-center">
            {/* Badge */}
            {badge && (
              <ScrollReveal delay={0.02} duration={0.75} distance={14} tempo={revealTempo}>
                <div
                  className={`mb-5 ${
                    isDarkTone
                      ? '[&_span]:bg-[#12324a] [&_span]:text-white [&_span]:border-[#12324a]'
                      : ''
                  }`}
                >
                  {badge}
                </div>
              </ScrollReveal>
            )}

            {/* Heading */}
            <ScrollReveal delay={0.1} duration={0.95} distance={18} tempo={revealTempo}>
              <h1
                className={`text-3xl sm:text-4xl lg:text-5xl font-semibold mb-5 leading-tight tracking-tight ${
                  isDarkTone ? 'text-navy' : 'text-white'
                }`}
              >
                {heading}
              </h1>
            </ScrollReveal>

            {/* Description */}
            <ScrollReveal delay={0.2} duration={0.95} distance={16} tempo={revealTempo}>
              <p
                className={`text-base sm:text-lg leading-relaxed max-w-3xl mx-auto mb-7 ${
                  isDarkTone ? 'text-slate-700' : 'text-white/90'
                }`}
              >
                {description}
              </p>
            </ScrollReveal>

            {contextNote ? (
              <ScrollReveal delay={0.24} duration={0.9} distance={14} tempo={revealTempo}>
                <div
                  className={`mx-auto mb-7 max-w-3xl rounded-xl border px-4 py-3 text-left ${
                    isDarkTone
                      ? 'border-[#12324a]/20 bg-[#12324a]/5 text-[#12324a]'
                      : 'border-white/30 bg-white/10 text-white'
                  }`}
                >
                  {contextKicker ? (
                    <p className={`mb-1 text-[11px] font-semibold tracking-[0.16em] uppercase ${isDarkTone ? 'text-[#12324a]/65' : 'text-white/75'}`}>
                      {contextKicker}
                    </p>
                  ) : null}
                  <p className="text-sm leading-relaxed">{contextNote}</p>
                </div>
              </ScrollReveal>
            ) : null}

            {/* CTA / Additional Content */}
            {cta && (
              <ScrollReveal delay={0.28} duration={0.95} distance={14} tempo={revealTempo}>
                <div className="mt-8">{cta}</div>
              </ScrollReveal>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
