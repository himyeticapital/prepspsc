/**
 * Feature access control.
 *
 * PrepSPSC is currently FREE FOR EVERYONE: every feature that used to need
 * Pro is unlocked for all users. `profiles.is_pro_member` still records who
 * actually paid (badges, admin stats, payment history), but feature gates must
 * call hasProAccess() instead of reading is_pro_member directly.
 *
 * To bring paid plans back:
 *   1. Vercel env:            NEXT_PUBLIC_ALL_FEATURES_FREE=false  (then redeploy)
 *   2. Supabase edge secrets: ALL_FEATURES_FREE=false              (then redeploy functions)
 */

/** True unless NEXT_PUBLIC_ALL_FEATURES_FREE is explicitly set to "false". */
export function isAllFeaturesFree(): boolean {
  // Must be referenced literally so Next.js inlines it into client bundles.
  return process.env.NEXT_PUBLIC_ALL_FEATURES_FREE !== "false";
}

/** Whether this user can use Pro features. */
export function hasProAccess(
  profile?: { is_pro_member?: boolean | null } | null
): boolean {
  if (isAllFeaturesFree()) return true;
  return profile?.is_pro_member === true;
}
