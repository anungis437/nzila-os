const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}
edit('app/api/employer-execution/replay/[runId]/route.ts', [
  [`    // A replay chains from the run's own seal, never from an earlier replay's manifest.`,
`    // The stored mode column cannot tell an engine change from a faithful re-run, so the requested mode and rule
    // version travel with the diff, and the same request against the same run is answered with the replay it made.
    const replayContext = { requestedMode: body.mode, replayRuleVersionId: ruleVersion.id };
    const diffHash = sha256(JSON.stringify(diff));
    const priorReplays = await db
      .select()
      .from(employerExecutionReplays)
      .where(
        and(
          eq(employerExecutionReplays.organizationId, organizationId),
          eq(employerExecutionReplays.sourcePayrollRunId, sourceRun.id),
          eq(employerExecutionReplays.diffHash, diffHash),
        ),
      );
    const priorReplay = priorReplays.find((candidate) => {
      const context = (candidate.diffJson as { replayContext?: typeof replayContext } | null)?.replayContext;
      return (
        context?.requestedMode === replayContext.requestedMode &&
        context?.replayRuleVersionId === replayContext.replayRuleVersionId &&
        candidate.replayEngineVersion === replayEngineVersion
      );
    });
    if (priorReplay) {
      return { data: { replay: priorReplay, diff, replayTotals: replayedTotals, repeated: true } };
    }

    // A replay chains from the run's own seal, never from an earlier replay's manifest.`],
  [`          diffJson: diff,
          diffSummary: diff.summary,
          diffHash: sha256(JSON.stringify(diff)),`, `          diffJson: { ...diff, replayContext },
          diffSummary: diff.summary,
          diffHash,`],
])
edit('app/api/__tests__/employer-replay-run-id.route.test.ts', [
  [`      [{ id: 'rv1', ruleVersionCode: 'r1', sourceHash: 'h1', rulesJson: {} }],
      [],
    );`, `      [{ id: 'rv1', ruleVersionCode: 'r1', sourceHash: 'h1', rulesJson: {} }],
      [],
      [],
    );`],
  [`  it('only adds records beside the source run`, `  it('answers a repeated identical replay with the replay it already made and adds nothing', async () => {
    const { POST } = await loadRoute();
    queueReplayInputs();
    m.selectQueue.pop();
    m.selectQueue.push([
      { id: 'replay_0', diffHash: 'hash_1', replayEngineVersion: '1', diffJson: { replayContext: { requestedMode: 'exact', replayRuleVersionId: 'rv1' } } },
    ]);

    const result = await POST({ organizationId: 'org_1', userId: 'user_1', params: { runId: 'run_1' }, body: { mode: 'exact' } } as any);

    expect(result.data.replay.id).toBe('replay_0');
    expect(result.data.repeated).toBe(true);
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('does not treat a different requested mode as the same replay', async () => {
    const { POST } = await loadRoute();
    queueReplayInputs();
    m.selectQueue.pop();
    m.selectQueue.push([
      { id: 'replay_0', diffHash: 'hash_1', replayEngineVersion: '1', diffJson: { replayContext: { requestedMode: 'new_engine', replayRuleVersionId: 'rv1' } } },
    ]);

    const result = await POST({ organizationId: 'org_1', userId: 'user_1', params: { runId: 'run_1' }, body: { mode: 'exact' } } as any);

    expect(result.data.replay.id).toBe('replay_1');
    expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
  });

  it('only adds records beside the source run`],
])
console.log('ok')
