# routers/outcome.py — Adaptive intervention selection from measured outcomes.
#
# This is the "adaptive learning" stage of the continuity loop. The backend
# measures what each intervention did to the patient's mood; this router turns
# that history into the next choice.
#
# BOUNDED EXPLORATION UNDER HARD SAFETY FLOORS — not reinforcement learning.
#   Be precise about this, because the code does explore and says so
#   (`selectionMode: "explore"`). What it is not is RL: there is no policy, no
#   value function, no reward propagation over episodes, and no unbounded search.
#   Exploration here is one Gaussian perturbation of a shrunk point estimate,
#   scaled by 1/sqrt(n+1), so it decays as evidence accumulates.
#   Three constraints keep it clinically safe:
#     (a) shrinkage toward the population mean, so sparse data cannot crown a winner;
#     (b) a crisis floor that returns `grounding` regardless of anything learned;
#     (c) an engagement floor that de-escalates when the patient is withdrawing.
#   So exploration NEVER happens on a patient in crisis or disengaging, and
#   every recommendation is auditable and explains itself.

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import math
import random

from utils.interventions import selectable_interventions, normalize_intervention

router = APIRouter()

SHRINKAGE = 3.0  # pseudo-observations pulling a sparse estimate to the mean


class TypeOutcome(BaseModel):
    interventionType: str
    n:                int = 0
    engagementRate:   Optional[float] = None
    rawMoodDelta:     Optional[float] = None
    estimatedEffect:  Optional[float] = None


class SelectRequest(BaseModel):
    uid:              str
    perType:          List[TypeOutcome] = []
    populationMean:   float = 0.0
    # Current clinical context — a selector that ignores this is a toy.
    riskLevel:        Optional[str]   = "low"
    crisisProbability: Optional[float] = 0.0
    moodScore:        Optional[float] = 3.0
    engagementRate:   Optional[float] = None
    # Cycle-aware support is only a candidate for users who opted into cycle
    # tracking. Never inferred from gender — see mobile utils/profile.js.
    tracksCycle:      bool = False


def choose_intervention(
    per_type: List[TypeOutcome],
    population_mean: float = 0.0,
    crisis_probability: float = 0.0,
    risk_level: str = "low",
    engagement_rate: Optional[float] = None,
    tracks_cycle: bool = False,
) -> dict:
    """
    The single intervention-selection implementation.

    Called by POST /select and directly by the JITAI receptivity router, so the
    scheduler and the API can never diverge — and, critically, so the safety
    floor below cannot be bypassed by whichever caller forgets it.
    """

    # ── Safety floor: clinical need overrides anything the data suggests.
    # Never let an optimiser decide not to ground someone in crisis.
    if (crisis_probability or 0) > 0.75 or risk_level == "crisis":
        return {
            "recommended": "grounding",
            "rationale": "Crisis probability above threshold — grounding is clinically indicated and overrides outcome-based selection.",
            "selectionMode": "safety_floor",
            "explored": False,
            "candidates": [],
        }

    # ── Second floor: a disengaging patient cannot be helped by a harder ask.
    # If outreach is being ignored, the next action is the lowest-effort one,
    # regardless of which intervention has the best measured mood effect. This
    # is the attrition clause of the problem statement, encoded as a constraint.
    if engagement_rate is not None and engagement_rate < 25:
        return {
            "recommended": "checkin_nudge",
            "rationale": f"Engagement at {engagement_rate:.0f}% — de-escalating to the lowest-effort action to re-establish contact before asking for more.",
            "selectionMode": "engagement_floor",
            "explored": False,
            "candidates": [],
        }

    stats = {normalize_intervention(t.interventionType): t for t in per_type}
    candidates = []

    for name in selectable_interventions(tracks_cycle):
        s = stats.get(name)
        n = s.n if s else 0
        raw = s.rawMoodDelta if (s and s.rawMoodDelta is not None) else population_mean

        # Shrunk point estimate — sparse evidence stays near the population mean.
        effect = (n * raw + SHRINKAGE * population_mean) / (n + SHRINKAGE)

        # Uncertainty shrinks as evidence accumulates. Sampling from it is what
        # lets a promising-but-untried option still get a turn, without the
        # unbounded exploration of true RL.
        uncertainty = 1.0 / math.sqrt(n + 1)
        sampled = effect + random.gauss(0, uncertainty * 0.5)

        candidates.append({
            "interventionType": name,
            "n": n,
            "estimatedEffect": round(effect, 3),
            "uncertainty": round(uncertainty, 3),
            "score": round(sampled, 3),
            "engagementRate": s.engagementRate if s else None,
        })

    candidates.sort(key=lambda c: c["score"], reverse=True)
    best = candidates[0]

    # Was this an exploit (best known) or an explore (uncertainty won)?
    best_by_effect = max(candidates, key=lambda c: c["estimatedEffect"])
    explored = best["interventionType"] != best_by_effect["interventionType"]

    evidence = "no measured outcomes yet — using population prior" if best["n"] == 0 else \
               f"{best['n']} measured outcome(s), mean mood change {best['estimatedEffect']:+.2f}"

    return {
        "recommended": best["interventionType"],
        "rationale": (
            f"Selected {best['interventionType']}: {evidence}."
            + (" Chosen to gather evidence on an under-tried option."
               if explored else " Best measured effect for this patient.")
        ),
        "selectionMode": "explore" if explored else "exploit",
        "explored": explored,
        "candidates": candidates,
    }


@router.post("/select")
async def select_intervention(req: SelectRequest):
    """Choose the next intervention for this user, and say why."""
    return choose_intervention(
        per_type=req.perType,
        population_mean=req.populationMean,
        crisis_probability=req.crisisProbability or 0.0,
        risk_level=req.riskLevel or "low",
        engagement_rate=req.engagementRate,
        tracks_cycle=req.tracksCycle,
    )


class TrajectoryPoint(BaseModel):
    date:  str
    phq9:  Optional[float] = None
    mood:  Optional[float] = None


class TrajectoryRequest(BaseModel):
    uid:    str
    points: List[TrajectoryPoint] = []


@router.post("/trajectory")
async def recovery_trajectory(req: TrajectoryRequest):
    """
    Recovery trajectory from the PHQ-9 series.

    Uses ordinary least squares on score-vs-days — with n this small, a linear
    slope is the only defensible summary; anything fancier would overfit and
    imply precision the data does not carry.
    """
    pts = sorted([p for p in req.points if p.phq9 is not None], key=lambda p: p.date)
    if len(pts) < 2:
        return {
            "trajectory": "insufficient_data",
            "message": "At least two PHQ-9 scores are needed to describe a trajectory.",
            "slopePerWeek": None, "projectedRemissionWeeks": None,
        }

    from datetime import datetime
    t0 = datetime.fromisoformat(pts[0].date.replace("Z", ""))
    xs = [(datetime.fromisoformat(p.date.replace("Z", "")) - t0).days for p in pts]
    ys = [float(p.phq9) for p in pts]
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    denom = sum((x - mx) ** 2 for x in xs)
    slope_per_day = (sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / denom) if denom else 0.0
    slope_week = slope_per_day * 7

    baseline, latest = ys[0], ys[-1]
    pct = ((baseline - latest) / baseline) if baseline > 0 else 0.0

    # Standard clinical definitions, not invented thresholds.
    if latest < 5:                       traj = "remission"
    elif pct >= 0.5:                     traj = "treatment_response"
    elif slope_week <= -0.5:             traj = "improving"
    elif slope_week >= 0.5:              traj = "deteriorating"
    else:                                traj = "plateau"

    weeks_to_remission = None
    if slope_week < -0.1 and latest >= 5:
        weeks_to_remission = round((latest - 4.9) / abs(slope_week), 1)

    return {
        "trajectory": traj,
        "baselinePhq9": baseline,
        "latestPhq9": latest,
        "percentReduction": round(pct * 100, 1),
        "slopePerWeek": round(slope_week, 2),
        "projectedRemissionWeeks": weeks_to_remission,
        "assessmentCount": n,
        # Plateau is the clinically important state: the patient is engaged and
        # adherent but NOT getting better — i.e. incomplete symptom alleviation,
        # which is exactly what the problem statement names and what a
        # risk-only system never surfaces.
        "clinicalFlag": (
            "Incomplete symptom alleviation — engaged but not improving; consider treatment review."
            if traj == "plateau" else
            "Deterioration despite intervention — escalate." if traj == "deteriorating" else None
        ),
    }
