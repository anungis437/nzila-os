export function currentStateContextEnabled(): boolean {
  const flag = process.env.UE_CANONICAL_BOOTSTRAP_V2
  if (flag !== undefined && flag !== '0' && flag !== '1')
    throw new Error('UE_CANONICAL_BOOTSTRAP_V2 must be 0 or 1')
  return flag === '1'
}
