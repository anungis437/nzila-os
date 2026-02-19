interface SectionDividerProps {
  variant?: 'gradient' | 'glow' | 'wave' | 'dots';
  className?: string;
}

export default function SectionDivider({ variant = 'gradient', className = '' }: SectionDividerProps) {
  if (variant === 'wave') {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <svg
          viewBox="0 0 1440 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-14 text-gray-50"
          preserveAspectRatio="none"
        >
          <path
            d="M0 28C240 56 480 0 720 28C960 56 1200 0 1440 28V56H0V28Z"
            fill="currentColor"
          />
        </svg>
      </div>
    );
  }

  if (variant === 'dots') {
    return (
      <div className={`flex items-center justify-center gap-2 py-8 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-electric/40" />
        <span className="w-2 h-2 rounded-full bg-electric/60" />
        <span className="w-8 h-1 rounded-full bg-linear-to-r from-electric to-violet" />
        <span className="w-2 h-2 rounded-full bg-violet/60" />
        <span className="w-1.5 h-1.5 rounded-full bg-violet/40" />
      </div>
    );
  }

  if (variant === 'glow') {
    return (
      <div className={`relative h-px ${className}`}>
        <div className="absolute inset-0 bg-linear-to-r from-transparent via-electric/40 to-transparent" />
        <div className="absolute inset-0 bg-linear-to-r from-transparent via-electric/20 to-transparent blur-sm" />
      </div>
    );
  }

  // Default: gradient line
  return (
    <div className={`relative py-1 ${className}`}>
      <div className="max-w-xs mx-auto h-px bg-linear-to-r from-transparent via-electric to-transparent" />
    </div>
  );
}
