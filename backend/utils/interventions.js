// backend/utils/interventions.js
//
// ONE canonical intervention vocabulary, shared by every service.
//
// Before this file there were three: jitai.py emitted crisis_check / cycle_aware /
// gentle_nudge, outcome.py scored journal_prompt / checkin_nudge / grounding, and
// the mobile app reported somatic_breathing. Effectiveness therefore accrued under
// names the selector never scored, and the selector ranked options the app could
// not deliver. A learning loop whose two halves disagree on what an action is
// called cannot learn.
//
// Mirrored in ai-service/utils/interventions.py — change both together.

// Only interventions the app can ACTUALLY deliver belong here. If there is no
// screen, it is not an intervention; it is a plan.
const INTERVENTIONS = [
  { id: 'breathing',      label: 'Breathing exercise',   screen: 'SomaticBreathing', cycleOnly: false },
  { id: 'cbt_reframe',    label: 'Thought reframing',    screen: 'CBTReframe',       cycleOnly: false },
  { id: 'journal_prompt', label: 'Guided journalling',   screen: 'Journal',          cycleOnly: false },
  { id: 'checkin_nudge',  label: 'Gentle check-in',      screen: 'Journal',          cycleOnly: false },
  { id: 'grounding',      label: 'Grounding exercise',   screen: 'CrisisSupport',    cycleOnly: false },
  { id: 'cycle_aware',    label: 'Cycle-aware support',  screen: 'Cycle',            cycleOnly: true  },
]

const INTERVENTION_IDS = INTERVENTIONS.map(i => i.id)

// Historic / service-local names seen in Firestore and in code, mapped forward.
// Existing jitaiLogs docs keep their old strings, so normalisation has to happen
// on read as well as write — otherwise a patient's history splits in two.
const ALIASES = {
  somatic_breathing: 'breathing',
  breathing_exercise: 'breathing',
  crisis_check: 'grounding',
  crisis_support: 'grounding',
  gentle_nudge: 'checkin_nudge',
  nudge: 'checkin_nudge',
  simplified_checkin: 'checkin_nudge',
  cbt: 'cbt_reframe',
  reframe: 'cbt_reframe',
  journal: 'journal_prompt',
  cycle: 'cycle_aware',
}

const normalizeIntervention = (name) => {
  if (!name) return 'unknown'
  const k = String(name).trim().toLowerCase()
  if (INTERVENTION_IDS.includes(k)) return k
  return ALIASES[k] || 'unknown'
}

const interventionLabel = (id) =>
  INTERVENTIONS.find(i => i.id === normalizeIntervention(id))?.label || 'Intervention'

const interventionScreen = (id) =>
  INTERVENTIONS.find(i => i.id === normalizeIntervention(id))?.screen || null

module.exports = {
  INTERVENTIONS,
  INTERVENTION_IDS,
  normalizeIntervention,
  interventionLabel,
  interventionScreen,
}
