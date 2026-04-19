export type AbrDataMode = 'demo' | 'pilot' | 'production';

export interface AbrDataModeContext {
  mode: AbrDataMode;
  label: string;
  isolatedFromDemo: boolean;
}

function normalizeMode(input?: string | null): AbrDataMode | null {
  if (!input) return null;
  const value = input.trim().toLowerCase();
  if (value === 'demo' || value === 'pilot' || value === 'production') {
    return value;
  }
  return null;
}

export function resolveDataMode(searchParams?: {
  demo?: string;
  mode?: string;
}): AbrDataModeContext {
  const explicitMode = normalizeMode(searchParams?.mode);
  const envMode = normalizeMode(process.env.ABR_DATA_MODE);
  const demoRequested = searchParams?.demo === 'true' || process.env.ABR_DEMO_MODE === 'true';
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  const mode = explicitMode ?? (demoRequested ? 'demo' : envMode ?? (hasDatabase ? 'pilot' : 'demo'));

  return {
    mode,
    label: mode === 'demo' ? 'Demo' : mode === 'pilot' ? 'Pilot' : 'Production',
    isolatedFromDemo: mode !== 'demo',
  };
}