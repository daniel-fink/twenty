export const WORKSPACE_SEED_PROFILES = [
  'twenty-standard',
  'whirlwind-default',
  'metadata-only',
] as const;

export type WorkspaceSeedProfile = (typeof WORKSPACE_SEED_PROFILES)[number];

export const DEFAULT_WORKSPACE_SEED_PROFILE =
  'twenty-standard' satisfies WorkspaceSeedProfile;

export const shouldSeedStandardWorkspaceRecords = (
  profile: WorkspaceSeedProfile,
) => profile === 'twenty-standard' || profile === 'whirlwind-default';
