interface AnimatedCounterProps {
  target: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}

export default function AnimatedCounter({
  target,
  prefix = '',
  suffix = '',
  className = '',
}: AnimatedCounterProps) {
  return <span className={className}>{prefix}{target.toLocaleString()}{suffix}</span>;
}
