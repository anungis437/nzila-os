const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 60)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}

edit('app/api/exit-interviews/route.ts', [
  ["  projectInterview,\n  resolveInterviewReader,\n} from '@/lib/knowledge-transfer/governance/interview-access';", "  projectInterview,\n  resolveInterviewReader,\n  UNRECORDED_LEVEL,\n} from '@/lib/knowledge-transfer/governance/interview-access';"],
  [
    "          ...body,\n          organizationId: organizationId!,\n          createdBy: userId!,",
    "          ...body,\n          // A new interview is unclassified until an administrator sets its level through the governance step, so it starts at\n          // the most protective readable level instead of the column default (public_internal).\n          sensitivityLevel: UNRECORDED_LEVEL,\n          organizationId: organizationId!,\n          createdBy: userId!,",
  ],
])
console.log('ok')
