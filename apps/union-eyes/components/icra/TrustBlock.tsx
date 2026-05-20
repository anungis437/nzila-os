import { ShieldCheck } from 'lucide-react';
import { COPY } from '@/lib/icra/copy';

export function TrustBlock() {
  return (
    <section
      aria-labelledby="trust-block-title"
      className="rounded-lg border border-slate-200 bg-slate-50 p-8"
    >
      <div className="flex items-start gap-4">
        <div className="rounded-md bg-white p-2 ring-1 ring-slate-200">
          <ShieldCheck className="h-5 w-5 text-slate-700" aria-hidden />
        </div>
        <div>
          <h2 id="trust-block-title" className="text-xl font-semibold text-slate-900">
            {COPY.positionStatement.title}
          </h2>
          <div className="mt-4 space-y-3 text-slate-700">
            {COPY.positionStatement.body.map((line) => (
              <p key={line} className="leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
