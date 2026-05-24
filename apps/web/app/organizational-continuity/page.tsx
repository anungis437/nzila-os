import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
	title: 'Organizational Continuity Infrastructure',
	description:
		'Nzila builds organizational continuity infrastructure for teams that need governance, operational memory, and trust to survive transitions.',
	alternates: { canonical: '/organizational-continuity' },
};

const symptoms = [
	'Key decisions can only be explained by one or two long-tenured people.',
	'Onboarding depends on mentorship rather than durable organizational records.',
	'Audit readiness requires preparation because evidence is reconstructed after the fact.',
	'Leadership transitions expose fragmented workflows, missing rationale, and informal approvals.',
];

const capabilities = [
	{
		title: 'Operational memory',
		body: 'Procedures, precedents, workflows, decisions, historical rationale, and organizational context become preserved continuity assets.',
	},
	{
		title: 'Governance evidence',
		body: 'Decisions are captured with rationale, approval lineage, traceable records, and reviewable history.',
	},
	{
		title: 'Continuity posture',
		body: 'Organizations can identify dependency concentration, transition risk, onboarding fragility, and trust debt before a crisis exposes them.',
	},
	{
		title: 'Sovereign operations',
		body: 'Institutions retain ownership, exportability, visibility, and operational independence from any single vendor relationship.',
	},
];

const entryPaths = [
	{
		title: 'OCRA-first',
		subtitle: 'Understand organizational continuity fragility',
		audience: 'Strategic and executive buyers',
		body: 'Best for federations, executive leadership, governance-heavy institutions, modernization sponsors, and continuity-aware operators.',
		flow: [
			'Continuity pain recognition',
			'OCI assessment',
			'Executive continuity brief',
			'OCRA structural intelligence',
			'Continuity roadmap',
			'Operational continuity activation',
			'Longitudinal continuity',
		],
		ctaHref: '/continuity-assessment',
		ctaLabel: 'Enter via OCRA-first',
	},
	{
		title: 'Operations-first',
		subtitle: 'Stabilize operational workflows first',
		audience: 'Practical and operational buyers',
		body: 'Best for unions, staff teams, grievance handlers, governance administrators, and continuity-fragmented operations.',
		flow: [
			'Operational pain',
			'Operations Core deployment',
			'Continuity-safe workflows',
			'Continuity pain visibility',
			'OCI activation',
			'OCRA intelligence',
			'Governance continuity',
		],
		ctaHref: '/union-eyes',
		ctaLabel: 'Enter via Operations-first',
	},
];

const buyerSignals = [
	{ signal: 'Workflow pain', motion: 'Operations-first' },
	{ signal: 'Modernization concern', motion: 'OCRA-first' },
	{ signal: 'Governance fragmentation', motion: 'OCRA-first' },
	{ signal: 'Grievance overload', motion: 'Operations-first' },
	{ signal: 'Onboarding strain', motion: 'Either path' },
	{ signal: 'Executive continuity concern', motion: 'OCRA-first' },
	{ signal: 'Operational inconsistency', motion: 'Operations-first' },
];

export default function OrganizationalContinuityPage() {
	return (
		<main className="bg-white min-h-screen">
			<section className="bg-navy text-white py-24">
				<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
					<p className="text-electric text-sm font-semibold tracking-widest uppercase mb-4">
						Organizational Continuity
					</p>
					<h1 className="text-4xl md:text-6xl font-bold mb-6">
						Two valid entry paths. One continuity architecture.
					</h1>
					<p className="text-xl text-gray-300 max-w-3xl">
						Institutions can enter through strategic continuity intelligence or operational workflow
						stabilization. Both paths converge into the same governed continuity infrastructure.
					</p>
					<div className="mt-10 flex flex-col sm:flex-row gap-4">
						<Link href="/continuity-assessment" className="px-6 py-3 bg-gold text-navy font-bold rounded-xl hover:bg-gold-light transition">
							Enter via OCRA-first
						</Link>
						<Link href="/union-eyes" className="px-6 py-3 border border-white/25 text-white font-bold rounded-xl hover:bg-white/10 transition">
							Enter via Operations-first
						</Link>
					</div>
				</div>
			</section>

			<section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
				<p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">Dual-entry model</p>
				<h2 className="text-3xl font-bold text-navy mb-6">Choose the motion that matches your continuity awareness.</h2>
				<div className="grid lg:grid-cols-2 gap-6">
					{entryPaths.map((path) => (
						<article key={path.title} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
							<h3 className="text-2xl font-bold text-navy mb-2">{path.title}</h3>
							<p className="text-sm uppercase tracking-wide text-electric font-semibold mb-3">{path.subtitle}</p>
							<p className="text-sm text-gray-700 mb-2 font-medium">{path.audience}</p>
							<p className="text-gray-600 leading-relaxed mb-5">{path.body}</p>
							<ol className="space-y-2 mb-6">
								{path.flow.map((step, index) => (
									<li key={step} className="text-sm text-gray-700 flex gap-3">
										<span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 font-semibold">
											{index + 1}
										</span>
										<span>{step}</span>
									</li>
								))}
							</ol>
							<Link href={path.ctaHref} className="inline-flex px-5 py-2.5 rounded-lg bg-navy text-white font-semibold hover:bg-navy-light transition">
								{path.ctaLabel}
							</Link>
						</article>
					))}
				</div>
			</section>

			<section className="bg-gray-50 py-20">
				<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
					<p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">Architecture rule</p>
					<h2 className="text-3xl font-bold text-navy mb-6">The paths diverge at entry and reconnect in architecture.</h2>
					<div className="grid md:grid-cols-2 gap-5 mb-6">
						<div className="rounded-xl bg-white border border-gray-200 p-5">
							<h3 className="font-bold text-navy mb-2">OCRA-first motion</h3>
							<p className="text-gray-700 text-sm">Diagnose then operationalize. Strategy-first, executive-driven, top-down activation.</p>
						</div>
						<div className="rounded-xl bg-white border border-gray-200 p-5">
							<h3 className="font-bold text-navy mb-2">Operations-first motion</h3>
							<p className="text-gray-700 text-sm">Operationalize then diagnose. Workflow-first, operator-driven, bottom-up activation.</p>
						</div>
					</div>
					<div className="rounded-xl border border-navy/20 bg-white p-6">
						<p className="text-navy font-semibold mb-2">Convergence requirement</p>
						<p className="text-gray-700 leading-relaxed">
							Do not split continuity into separate products. Maintain one continuity infrastructure platform with
							multiple activation paths so continuity survivability, organizational memory, governance consistency,
							and operational execution remain fully connected.
						</p>
					</div>
				</div>
			</section>

			<section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
				<div className="grid lg:grid-cols-2 gap-12">
					<div>
						<p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">
							Symptoms
						</p>
						<h2 className="text-3xl font-bold text-navy mb-6">
							The problem is usually visible before it is named.
						</h2>
						<ul className="space-y-4">
							{symptoms.map((symptom) => (
								<li key={symptom} className="rounded-xl border border-gray-200 p-5 text-gray-700">
									{symptom}
								</li>
							))}
						</ul>
					</div>

					<div>
						<p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">
							Nzila OS
						</p>
						<h2 className="text-3xl font-bold text-navy mb-6">
							Governed operational infrastructure for trust-sensitive institutions.
						</h2>
						<div className="space-y-4">
							{capabilities.map((capability) => (
								<article key={capability.title} className="rounded-xl bg-gray-50 border border-gray-100 p-5">
									<h3 className="font-bold text-navy mb-2">{capability.title}</h3>
									<p className="text-gray-600 text-sm leading-relaxed">{capability.body}</p>
								</article>
							))}
						</div>
					</div>
				</div>
			</section>

			<section className="py-20 bg-white">
				<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
					<h2 className="text-3xl font-bold text-navy mb-6">Buyer signal routing</h2>
					<div className="overflow-hidden rounded-xl border border-gray-200">
						<div className="grid grid-cols-2 bg-gray-50 border-b border-gray-200">
							<p className="p-4 text-sm font-semibold text-gray-700">Buyer signal</p>
							<p className="p-4 text-sm font-semibold text-gray-700">Recommended motion</p>
						</div>
						{buyerSignals.map((row) => (
							<div key={row.signal} className="grid grid-cols-2 border-b border-gray-100 last:border-b-0">
								<p className="p-4 text-sm text-gray-700">{row.signal}</p>
								<p className="p-4 text-sm text-navy font-semibold">{row.motion}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			<section className="bg-gray-50 py-20">
				<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
					<h2 className="text-3xl font-bold text-navy mb-6">Who this is for</h2>
					<div className="grid md:grid-cols-3 gap-5">
						{['Labor organizations and unions', 'Healthcare institutions', 'Public-sector bodies', 'Federated associations', 'Governance-heavy enterprises', 'Regulated operators'].map((label) => (
							<div key={label} className="rounded-xl bg-white border border-gray-200 p-5 text-gray-700 font-medium">
								{label}
							</div>
						))}
					</div>
				</div>
			</section>
		</main>
	);
}
