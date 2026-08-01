// src/utils/profile.js
// Single source of truth for "which parts of Niranthara apply to this user".
//
// The problem statement covers everyone, not only women. Cycle tracking is one
// input signal among many — it must be an opt-in capability on the profile, not
// an assumption baked into every screen. Anything that renders or computes a
// cycle feature asks these helpers rather than testing gender inline.

export const GENDERS = {
  FEMALE:   'female',
  MALE:     'male',
  NONBINARY:'non_binary',
  UNSPOKEN: 'prefer_not_to_say',
};

// Only these can meaningfully opt into cycle tracking.
const CYCLE_ELIGIBLE = new Set([GENDERS.FEMALE, GENDERS.NONBINARY, GENDERS.UNSPOKEN]);

export function isCycleEligible(dbUser) {
  return CYCLE_ELIGIBLE.has(dbUser?.gender);
}

/**
 * Does this user get cycle rings, the Cycle tab and hormonal risk features?
 *
 * Explicit `tracksCycle` always wins. Accounts created before gender existed
 * carry personaType/persona 'women' — treat those as opted in so existing demo
 * users do not lose the feature on upgrade.
 */
export function tracksCycle(dbUser) {
  if (!dbUser) return false;
  if (typeof dbUser.tracksCycle === 'boolean') return dbUser.tracksCycle;
  if (dbUser.gender) return dbUser.gender === GENDERS.FEMALE;
  return dbUser.personaType === 'women' || dbUser.persona === 'women';
}

export const GENDER_LABELS = {
  [GENDERS.FEMALE]:    'Woman',
  [GENDERS.MALE]:      'Man',
  [GENDERS.NONBINARY]: 'Non-binary',
  [GENDERS.UNSPOKEN]:  'Prefer not to say',
};
