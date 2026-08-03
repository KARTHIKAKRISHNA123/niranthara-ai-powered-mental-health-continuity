# ai-service/utils/interventions.py
#
# ONE canonical intervention vocabulary, shared by every service.
# Mirrored in backend/utils/interventions.js — change both together.
#
# See the Node file for why this exists: three services previously used three
# different name sets, so measured effectiveness and intervention selection were
# keyed on strings that never matched.

INTERVENTIONS = [
    {"id": "breathing",      "label": "Breathing exercise",  "screen": "SomaticBreathing", "cycle_only": False},
    {"id": "cbt_reframe",    "label": "Thought reframing",   "screen": "CBTReframe",       "cycle_only": False},
    {"id": "journal_prompt", "label": "Guided journalling",  "screen": "Journal",          "cycle_only": False},
    {"id": "checkin_nudge",  "label": "Gentle check-in",     "screen": "Journal",          "cycle_only": False},
    {"id": "grounding",      "label": "Grounding exercise",  "screen": "CrisisSupport",    "cycle_only": False},
    {"id": "cycle_aware",    "label": "Cycle-aware support", "screen": "Cycle",            "cycle_only": True},
]

INTERVENTION_IDS = [i["id"] for i in INTERVENTIONS]

ALIASES = {
    "somatic_breathing": "breathing",
    "breathing_exercise": "breathing",
    "crisis_check": "grounding",
    "crisis_support": "grounding",
    "gentle_nudge": "checkin_nudge",
    "nudge": "checkin_nudge",
    "simplified_checkin": "checkin_nudge",
    "cbt": "cbt_reframe",
    "reframe": "cbt_reframe",
    "journal": "journal_prompt",
    "cycle": "cycle_aware",
}


def normalize_intervention(name: str) -> str:
    if not name:
        return "unknown"
    k = str(name).strip().lower()
    if k in INTERVENTION_IDS:
        return k
    return ALIASES.get(k, "unknown")


def selectable_interventions(tracks_cycle: bool = False):
    """Candidates the selector may choose from for this specific user.

    Cycle-aware support is gated on the user's own opt-in, matching the
    tracksCycle() rule the rest of the product follows — never inferred.
    """
    return [i["id"] for i in INTERVENTIONS if tracks_cycle or not i["cycle_only"]]
