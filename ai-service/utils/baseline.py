# utils/baseline.py — UserBaseline deviation scoring per Build Guide §6

import numpy as np
from typing import List, Optional


class UserBaseline:
    """
    Computes personal 30-day baseline and deviation scores.
    NEVER uses population thresholds — always personal deviation.
    """
    calibration_days = 14

    def __init__(self, history_30d: Optional[List[dict]] = None):
        self.baseline = {}
        self.is_calibrated = False
        if history_30d and len(history_30d) >= 7:
            self.baseline = self.compute(history_30d)
            self.is_calibrated = True

    def compute(self, history_30d: List[dict]) -> dict:
        steps   = [d.get("stepsToday", 0)      for d in history_30d if d.get("stepsToday", 0) > 0]
        sleep   = [d.get("sleepProxyHours", 0) for d in history_30d if d.get("sleepProxyHours", 0) > 0]
        entropy = [d.get("gpsEntropy", 0)      for d in history_30d]

        def safe_mean(arr): return float(np.mean(arr)) if arr else 0.0
        def safe_std(arr):  return float(np.std(arr))  if len(arr) > 1 else 1.0

        return {
            "avg_steps":       safe_mean(steps),
            "avg_sleep":       safe_mean(sleep),
            "avg_gps_entropy": safe_mean(entropy),
            "std_steps":       safe_std(steps),
            "std_sleep":       safe_std(sleep),
        }

    def deviation_score(self, today_value: float, metric: str) -> float:
        """
        Returns 0.0–1.0 deviation from personal baseline.
        0.0 = at or above baseline; 1.0 = 3+ std devs below baseline.
        Returns 0.3 (neutral) if not calibrated.
        """
        if not self.is_calibrated:
            return 0.3

        avg_key = f"avg_{metric}"
        std_key = f"std_{metric}"
        if avg_key not in self.baseline:
            return 0.3

        avg = self.baseline[avg_key]
        std = max(self.baseline[std_key], 0.01)
        z = (avg - today_value) / std
        return float(min(max(z / 3, 0.0), 1.0))
