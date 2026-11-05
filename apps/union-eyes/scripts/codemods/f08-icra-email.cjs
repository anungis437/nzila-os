const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}

edit('components/icra/EmailResultsCard.tsx', [
  [
    "    invalid: 'Please enter a valid email address.',\n    error: 'Could not send the email. Please try again or copy the URL above.',",
    "    invalid: 'Please enter a valid email address.',\n    acknowledge: 'I understand that this link gives access to my results to anyone who has it, and that I chose this address.',\n    acknowledgeRequired: 'Please confirm the statement above before the link is sent.',\n    error: 'Could not send the email. Please try again or copy the URL above.',",
  ],
  [
    "    invalid: 'Veuillez entrer une adresse courriel valide.',\n    error: \"Impossible d'envoyer le courriel. Veuillez réessayer ou copier l'URL ci-dessus.\",",
    "    invalid: 'Veuillez entrer une adresse courriel valide.',\n    acknowledge: \"Je comprends que ce lien donne accès à mes résultats à quiconque le possède, et que j'ai choisi cette adresse.\",\n    acknowledgeRequired: \"Veuillez confirmer l'énoncé ci-dessus avant l'envoi du lien.\",\n    error: \"Impossible d'envoyer le courriel. Veuillez réessayer ou copier l'URL ci-dessus.\",",
  ],
  ["  const [email, setEmail] = useState('');\n", "  const [email, setEmail] = useState('');\n  const [acknowledged, setAcknowledged] = useState(false);\n"],
  [
    "    setStatus('sending');\n    setErrorMsg(null);",
    "    if (!acknowledged) {\n      setStatus('error');\n      setErrorMsg(copy.acknowledgeRequired);\n      return;\n    }\n    setStatus('sending');\n    setErrorMsg(null);",
  ],
  ["body: JSON.stringify({ assessmentId, email, locale }),", "body: JSON.stringify({ assessmentId, email, locale, acknowledgeLinkAccess: true }),"],
  [
    "          {status === 'error' && errorMsg && (",
    "          <label className=\"flex items-start gap-2 text-xs text-stone-700\">\n            <input\n              type=\"checkbox\"\n              checked={acknowledged}\n              onChange={(e) => {\n                setAcknowledged(e.target.checked);\n                if (status === 'error') {\n                  setStatus('idle');\n                  setErrorMsg(null);\n                }\n              }}\n              className=\"mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300\"\n            />\n            <span>{copy.acknowledge}</span>\n          </label>\n          {status === 'error' && errorMsg && (",
  ],
])

edit('app/api/icra/email-results/route.ts', [
  ["import { rateLimit } from '@/lib/rate-limit'\n", "import { checkRateLimit } from '@/lib/rate-limiter'\n"],
  [
    "  const rl = rateLimit(req, { maxRequests: 5, windowSeconds: 60 * 60 })\n  if (!rl.success) {\n    return NextResponse.json(\n      { error: 'Too many email requests. Please try again later.' },\n      { status: 429 },\n    )\n  }",
    "  // The shared, durable limiter: a per-process counter let every instance and restart start again from zero.\n  const rl = await checkRateLimit(`icra-email-results:${ip}`, {\n    limit: 5,\n    window: 60 * 60,\n    identifier: 'icra-email-results',\n    failOpen: process.env.NODE_ENV !== 'production',\n  })\n  if (!rl.allowed) {\n    return NextResponse.json(\n      { error: rl.error ? 'Email sending is temporarily unavailable.' : 'Too many email requests. Please try again later.' },\n      { status: rl.error ? 503 : 429 },\n    )\n  }",
  ],
  ["  assessmentId?: any\n  email?: any\n  locale?: any\n}", "  assessmentId?: any\n  email?: any\n  locale?: any\n  acknowledgeLinkAccess?: any\n}"],
  [
    "  if (!isValidEmail(email)) {\n    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })\n  }",
    "  if (!isValidEmail(email)) {\n    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })\n  }\n  // The link carries the access capability, so mailing it to a typed address is a disclosure the respondent must decide on.\n  if (body.acknowledgeLinkAccess !== true) {\n    return NextResponse.json(\n      { error: 'Confirm that anyone with the link can open the results before it is sent.', code: 'LINK_ACCESS_ACKNOWLEDGEMENT_REQUIRED' },\n      { status: 400 },\n    )\n  }",
  ],
])
console.log('ok')
