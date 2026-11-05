const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
edit('app/api/pilot/apply/[id]/reference-profile/route.ts', [
  [`  const casesManaged = metric?.casesManaged ?? 0;
  const daysActive = metric?.daysActive ?? 0;
`, `  const casesManaged = metric?.casesManaged ?? 0;
  const daysActive = metric?.daysActive ?? 0;
  // Without a stored metric row every figure below comes from the application's self-assessed signals, and is labelled so.
  const measured = Boolean(metric);
  const quoteText = typeof responses.referenceTestimonialQuote === 'string' ? responses.referenceTestimonialQuote.trim() : '';
  const textOrNull = (value: unknown) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : null);
`],
  [`    deploymentMetrics: {
      daysActive,`, `    dataSource: measured ? 'pilot_metrics' : 'application_signals_not_measured',
    deploymentMetrics: {
      daysActive,`],
  [`    testimonial: {
      quote:
        typeof responses.referenceTestimonialQuote === 'string' && responses.referenceTestimonialQuote.trim().length > 0
          ? responses.referenceTestimonialQuote
          : \`\${application.organizationName} established a repeatable pilot operating cadence with measurable adoption growth.\`,
      author:
        typeof responses.referenceTestimonialAuthor === 'string' && responses.referenceTestimonialAuthor.trim().length > 0
          ? responses.referenceTestimonialAuthor
          : application.contactName,
      role:
        typeof responses.referenceTestimonialRole === 'string' && responses.referenceTestimonialRole.trim().length > 0
          ? responses.referenceTestimonialRole
          : 'Pilot Sponsor',
    },
    timeSaved: {
      estimatedHoursPerWeek: Math.max(6, Math.round(adoptionRate * 0.18)),
      methodology: 'Estimated from adoption and activity progression during pilot period.',
    },`, `    // A quote is shown only when one was supplied, and always as unattested: nothing here records that its author said it or consented.
    testimonial: quoteText
      ? { quote: quoteText, author: textOrNull(responses.referenceTestimonialAuthor), role: textOrNull(responses.referenceTestimonialRole), attested: false }
      : null,
    // No source measures time saved, so none is stated.
    timeSaved: null,`],
  [`  const caseStudy = {
    title: \`\${application.organizationName}: 90-day pilot outcomes\`,
    summary: \`\${application.organizationName} reached opportunity tier \${proposal.qualificationScores.opportunityTier} with overall score \${proposal.qualificationScores.overallOpportunityScore}.\`,
    outcomes: [
      \`Adoption rate: \${adoptionRate}\`,
      \`Engagement rate: \${engagementRate}\`,
      \`Health score: \${healthScore}\`,
      \`Renewal likelihood: \${proposal.signals.renewalLikelihood}\`,
    ],
    quote: referenceProfile.testimonial.quote,
  };`, `  const caseStudy = {
    title: measured ? \`\${application.organizationName}: pilot outcomes\` : \`\${application.organizationName}: pilot profile (no measured outcomes)\`,
    summary: \`\${application.organizationName} reached opportunity tier \${proposal.qualificationScores.opportunityTier} with overall score \${proposal.qualificationScores.overallOpportunityScore}.\`,
    outcomes: measured
      ? [
          \`Adoption rate: \${adoptionRate}\`,
          \`Engagement rate: \${engagementRate}\`,
          \`Health score: \${healthScore}\`,
          \`Renewal likelihood: \${proposal.signals.renewalLikelihood}\`,
        ]
      : [],
    quote: referenceProfile.testimonial?.quote ?? null,
    attested: false,
  };`],
])
edit('app/api/__tests__/pilot-reference-profile.route.test.ts', [
  [`    expect(payload.data.referenceProfile.pilotId).toBe('p1');
  });
`, `    expect(payload.data.referenceProfile.pilotId).toBe('p1');
    expect(payload.data.referenceProfile.dataSource).toBe('pilot_metrics');
  });

  // DEF-0B10-PIL-REFERENCE-PROFILE-PRESENTS-A-DEFAULT-TESTIMONIAL-A-SIX-HOUR-FLOOR-AND-SCORE-DERIVED-FIGURES-AS-PILOT-OUTCOMES
  it('GET invents no testimonial, time saved or measured outcome for a pilot with no stored metrics', async () => {
    const { GET } = await loadRoute();
    m.queueSelect(
      [{ id: 'p1', organizationName: 'Org One', organizationType: 'local', contactName: 'Casey', contactEmail: 'c@example.com', memberCount: 100, jurisdictions: [], sectors: [], currentSystem: 'legacy', challenges: [], goals: [], readinessScore: 70, responses: {} }],
      [],
    );

    const response = await GET(new NextRequest('http://localhost/api/pilot/apply/p1/reference-profile'), { params: Promise.resolve({ id: 'p1' }) });
    const { data } = await response.json();

    expect(data.referenceProfile.testimonial).toBeNull();
    expect(data.referenceProfile.timeSaved).toBeNull();
    expect(data.referenceProfile.dataSource).toBe('application_signals_not_measured');
    expect(data.caseStudy.outcomes).toEqual([]);
    expect(data.caseStudy.title).not.toContain('90-day');
    expect(data.caseStudy.quote).toBeNull();
  });

  it('GET shows a supplied quote only as unattested', async () => {
    const { GET } = await loadRoute();
    m.queueSelect(
      [{ id: 'p1', organizationName: 'Org One', organizationType: 'local', contactName: 'Casey', contactEmail: 'c@example.com', memberCount: 100, jurisdictions: [], sectors: [], currentSystem: 'legacy', challenges: [], goals: [], readinessScore: 70, responses: { referenceTestimonialQuote: 'It helped.' } }],
      [],
    );

    const response = await GET(new NextRequest('http://localhost/api/pilot/apply/p1/reference-profile'), { params: Promise.resolve({ id: 'p1' }) });
    const { data } = await response.json();

    expect(data.referenceProfile.testimonial).toEqual({ quote: 'It helped.', author: null, role: null, attested: false });
  });
`],
])
console.log('ok')
