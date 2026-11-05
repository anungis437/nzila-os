const fs = require('fs')
const f = 'app/api/compliance/validate/route.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const a = s.indexOf("    const totalMembersValue = data.totalMembers;")
const b = s.indexOf("    return NextResponse.json({ checks });")
if (a < 0 || b < 0) throw new Error('anchors')
const replacement = `    // The two checks below used to state a verdict (compliant, warning, violation) from numbers the caller typed, against thresholds
    // written into this file (50% turnout; 35 to 55% of cards by jurisdiction). No jurisdiction-validated rule exists here, so each check
    // reports only the arithmetic of what was supplied and says that the governing rule is not verified.
    const percentage = (part: unknown, whole: unknown): number | null => {
      const numerator = Number(part);
      const denominator = Number(whole);
      if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || numerator < 0 || denominator <= 0) return null;
      return (numerator / denominator) * 100;
    };

    if (shouldRun('strike_vote') && data.totalMembers && data.votesCase) {
      const turnout = percentage(data.votesCase, data.totalMembers);
      if (turnout !== null) {
        checks.push({
          id: 'strike-vote-quorum',
          ruleName: 'Strike Vote Turnout — Verification Required',
          ruleCategory: 'strike_vote',
          status: 'info',
          message: \`Reported turnout is \${turnout.toFixed(1)}% of the members supplied. No validated quorum rule is configured for \${jurisdiction}; the figures were typed by the caller and are not checked against a membership or ballot record.\`,
          recommendation: 'Confirm the quorum and ballot rules in the constitution, the applicable labour statute and the ballot record.',
          severity: 'medium',
        });
      }
    }

    if (shouldRun('certification') && data.signedCards && data.bargainingUnit) {
      const cardPercentage = percentage(data.signedCards, data.bargainingUnit);
      if (cardPercentage !== null) {
        checks.push({
          id: 'certification-cards',
          ruleName: 'Certification Card Share — Verification Required',
          ruleCategory: 'certification',
          status: 'info',
          message: \`Reported card share is \${cardPercentage.toFixed(1)}% of the unit size supplied. No validated certification threshold is configured for \${jurisdiction}; the figures were typed by the caller and are not checked against card records.\`,
          recommendation: 'Confirm the certification thresholds with the labour board and counsel before relying on this figure.',
          severity: 'medium',
        });
      }
    }

`
s = s.slice(0, a) + replacement + s.slice(b)
fs.writeFileSync(f, s)
console.log('ok')
