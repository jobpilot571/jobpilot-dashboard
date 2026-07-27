/**
 * Feature flags for modules deferred from v1.
 * Keep imports behind these flags so future modules plug in without dashboard rewrites.
 */
export const featureFlags = {
  /** AI resume enhancer / DOCX pipeline — separate product later */
  resumeModule: false,
  /** Student application-details vault + public token form */
  appDetailsModule: false,
  /** Free-trial messaging / TrialChat */
  trialChatModule: false,
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag];
}
