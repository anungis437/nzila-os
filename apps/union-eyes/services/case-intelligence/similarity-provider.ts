function tokenize(value: string | null | undefined) {
  return new Set(
    (value ?? '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2),
  );
}

export function computeTokenOverlapSimilarity(left: string | null | undefined, right: string | null | undefined) {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

export function computeTagOverlapScore(left: string[] | null | undefined, right: string[] | null | undefined) {
  const leftTags = new Set((left ?? []).map((tag) => tag.toLowerCase()));
  const rightTags = new Set((right ?? []).map((tag) => tag.toLowerCase()));

  if (leftTags.size === 0 || rightTags.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const tag of leftTags) {
    if (rightTags.has(tag)) overlap += 1;
  }

  return overlap / Math.max(leftTags.size, rightTags.size);
}

export function clampScore(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}
