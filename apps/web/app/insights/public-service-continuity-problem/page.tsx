import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'The Public Service Continuity Problem',
  description:
    'A public-service continuity perspective from CIVIC by Nzila: why continuity pressure is structural, and what leaders need to see earlier as institutional memory, evidence, and accountability weaken during change.',
  alternates: { canonical: '/insights/public-service-continuity-problem' },
};

export default function PublicServiceContinuityProblemPage() {
  return (
    <main className="bg-white min-h-screen">
      {/* ═══════════════════════ HEADER ═══════════════════════ */}
      <section className="bg-navy text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <Link
            href="/insights"
            className="text-sm text-gray-300 hover:text-white transition"
          >
            ← Back to Insights
          </Link>
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mt-8 mb-4">
            Public-service continuity
          </p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
            The Public Service Continuity Problem
          </h1>
          <p className="text-xl text-gray-300">
            A public-service continuity perspective from CIVIC by Nzila.
          </p>
        </div>
      </section>

      {/* ═══════════════════════ ARTICLE BODY ═══════════════════════ */}
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="prose-none space-y-10 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-navy mb-3">The pressure is structural, not temporary</h2>
            <p className="mb-4">
              Public institutions are being asked to do several hard things at once. They are
              modernizing services, adopting technology responsibly, preserving public trust, managing
              significant workforce transition, and maintaining accountability — all in the same period,
              and often under the same leaders.
            </p>
            <p className="mb-4">
              It is tempting to treat each of these as a separate initiative with its own plan, its own
              governance table, and its own reporting cycle. But they are not separate. They are arriving
              together, and they interact. The result is a continuity problem that is structural rather
              than temporary: it will not resolve when a single reorganization ends or a single system
              goes live. It is a standing condition of the modern public service.
            </p>
            <p>Naming it clearly is the first step. We call it the public service continuity problem.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-navy mb-3">Continuity is no longer just operational resilience</h2>
            <p className="mb-4">
              For years, &ldquo;continuity&rdquo; in government meant operational resilience — the ability
              to keep services running through disruption, from weather events to pandemics to system
              outages. That meaning still matters. But it is no longer sufficient.
            </p>
            <p>
              The continuity that is now at risk is quieter and harder to see. It is the continuity of
              institutional knowing: why a decision was made, who owns a process, what evidence supports a
              commitment, and how a service is actually delivered versus how it is described. When that
              continuity weakens, services can keep running while the institution slowly loses the ability
              to explain, defend, and improve them. That is a different kind of fragility, and it does not
              show up on an uptime dashboard.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-navy mb-3">Workforce transition changes what institutions can remember</h2>
            <p className="mb-4">
              Much of what a public institution knows is not written down. It lives in the judgment of
              experienced staff — the people who know which exceptions matter, which precedents apply, and
              which informal steps keep a program compliant and fair.
            </p>
            <p>
              As those staff retire or move on, that tacit knowledge leaves with them. Onboarding often
              depends on mentorship rather than durable records, so when the mentors go, the memory goes
              too. Workforce transition, in other words, does not just change who does the work. It changes
              what the institution is able to remember about its own operations. The risk is not simply
              vacancy; it is the erosion of institutional memory at the exact moment services are being
              redesigned.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-navy mb-3">Modernization can hard-code fragile assumptions</h2>
            <p className="mb-4">
              Modernization is supposed to reduce risk. It often does. But modernization also has a quieter
              effect: it takes the current way of working — including its undocumented assumptions — and
              encodes it into new systems and automated workflows.
            </p>
            <p>
              If an assumption was fragile, unclear, or inequitable before modernization, automation can
              make it faster, more consistent, and much harder to see or question afterward. A workaround
              that a human used to catch becomes a default that no one reviews. The lesson is not that
              modernization is dangerous. It is that modernization without traceability can quietly convert
              today&rsquo;s fragile assumptions into tomorrow&rsquo;s operating defaults.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-navy mb-3">Accountability depends on evidence that survives change</h2>
            <p className="mb-4">
              Public institutions are accountable for what they do, and that accountability increasingly
              depends on evidence: records of decisions, rationale, approvals, controls, and outcomes.
            </p>
            <p>
              The problem is that this evidence is usually fragmented — spread across HR systems, service
              operations, audit findings, complaints and recourse data, modernization programs, and
              individual inboxes. As long as nothing changes, the fragmentation is tolerable. But change is
              exactly when accountability is tested, and it is exactly when fragmented evidence tends to
              fall apart. Accountability that cannot survive workforce transition and system change is
              accountability in name only. Evidence has to be able to travel through change, not just exist
              before it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-navy mb-3">Equity implementation needs traceability, not slogans</h2>
            <p className="mb-4">
              Most public institutions have made real equity and anti-racism commitments. The gap is rarely
              in the strength of the commitment. It is in whether the commitment stays visible in the actual
              operating layer — in workflows, ownership, controls, evidence, and recourse — as people and
              systems change.
            </p>
            <p>
              Equity implementation needs traceability: the ability to follow a commitment from strategy
              through to how work is actually done and how outcomes are reviewed. This is a matter of
              visibility and traceability, not of automated judgment. The goal is to help human
              decision-makers see where commitments may be losing their grip on day-to-day operations — not
              to render verdicts, score people, or claim to detect wrongdoing. Slogans do not survive
              transitions. Traceable implementation can.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-navy mb-3">What leaders need to see earlier</h2>
            <p className="mb-4">
              Across all of these pressures, the common failure is timing. The fragility is usually visible
              only after it matters — after the knowledge has walked out the door, after the assumption is
              embedded in a system, after the evidence is needed and cannot be found.
            </p>
            <p>
              What public-service leaders need is to see this earlier: where institutional memory is
              concentrated in too few people, where evidence for a commitment is thin or scattered, where a
              modernization decision is about to become a default before it has been reviewed, and where
              accountability could weaken under change pressure. Seeing these signals earlier — while they
              are still correctable — is the difference between managing continuity and being surprised by
              its loss.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-navy mb-3">CIVIC by Nzila: a framing for the operating layer</h2>
            <p className="mb-4">
              CIVIC by Nzila is a public-service continuity initiative built around this problem. CIVIC —
              Continuity, Implementation, Visibility, Integrity, and Capacity — is a way of focusing on the
              operating layer between policy commitment and institutional action.
            </p>
            <p>
              Behind CIVIC is an evidence discipline called CLEAR (Continuity, Legitimacy, Evidence,
              Accountability, and Readiness): a way to organize fragmented signals into decision-grade
              material for human review, with explicit confidence and uncertainty. The boundaries are
              deliberate and non-negotiable. Human review remains authoritative. There are no autonomous
              legal, HR, equity, or employment decisions, and no automated findings of discrimination or
              wrongdoing. Uncertainty is reported rather than hidden, evidence confidence is stated plainly,
              and privacy and minimization are in scope from the start. CIVIC is a framing for seeing
              continuity risk earlier — not a system that replaces the judgment of public servants.
            </p>
          </section>
        </div>

        {/* ═══════════════════════ CTA ═══════════════════════ */}
        <div className="mt-14 rounded-2xl border border-navy/20 bg-gray-50 p-8">
          <h2 className="text-2xl font-bold text-navy mb-3">The invitation: request a briefing</h2>
          <p className="text-gray-700 leading-relaxed mb-6">
            CIVIC is being introduced first as a conversation, not a product. If the public service
            continuity problem resonates with what you are seeing in your own institution, the invitation
            is simply to request a briefing — a short, tailored discussion of where continuity, institutional
            memory, evidence, and modernization readiness may be under pressure in your context.
          </p>
          <Link
            href="/public-service"
            className="inline-flex items-center justify-center px-8 py-3 bg-electric text-white font-semibold rounded-xl hover:bg-blue-700 transition"
          >
            Request a briefing
          </Link>
        </div>
      </article>
    </main>
  );
}
