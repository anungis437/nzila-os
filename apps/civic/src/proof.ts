import { assertRuntimeAuthorization } from './authorization'
import { runSyntheticProof } from './scenario'

assertRuntimeAuthorization()
for (const institution of ['A', 'B'] as const) {
  const proof = runSyntheticProof(institution)
  console.log(
    JSON.stringify(
      {
        proofKind: 'LOCAL_EXECUTED_SYNTHETIC',
        institution: proof.scenario.seed.institution,
        initialOperatorView: proof.initialOperatorView,
        operatorView: proof.operatorView,
        executiveBrief: proof.executiveBrief,
        humanDecision: proof.decision,
        finalStatus: proof.finalBrief.status,
        audit: proof.audit,
        burden: proof.burden,
        humanProofOwnerAcceptance: 'PENDING',
      },
      null,
      2,
    ),
  )
}
