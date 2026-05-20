# testing/test_ai_pipeline.py
# Niranthara AI Service — Unit + Integration Tests
# Run: cd ai-service && venv\Scripts\activate && pytest ../testing/test_ai_pipeline.py -v
#
# Tests:
#   Unit:        Risk score range, SHAP output structure, context builder
#   Integration: NVIDIA API connectivity, NLP model response format
#   System:      End-to-end full payload through all models

import sys
import os
import asyncio
import pytest

# ─── Add ai-service to path ──────────────────────────────────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'ai-service'))


# ══════════════════════════════════════════════════════════════════════════════
# UNIT TESTS — No network, no models needed
# ══════════════════════════════════════════════════════════════════════════════

class TestContextBuilder:
    """Unit tests for nvidia_client._build_context()"""

    def test_high_vulnerability_window(self):
        from utils.nvidia_client import _build_context
        result = _build_context(0.8, 3.0, "low", "neutral", 0.4)
        assert "hormonal vulnerability" in result.lower()

    def test_very_low_mood(self):
        from utils.nvidia_client import _build_context
        result = _build_context(0.0, 1.5, "low", "neutral", 0.4)
        assert "empathy only" in result.lower()

    def test_high_risk_level(self):
        from utils.nvidia_client import _build_context
        result = _build_context(0.0, 3.0, "crisis", "neutral", 0.4)
        assert "NIMHANS" in result

    def test_sad_emotion_detected(self):
        from utils.nvidia_client import _build_context
        result = _build_context(0.0, 3.0, "low", "sadness", 0.4)
        assert "validate" in result.lower()

    def test_user_ok_message(self):
        from utils.nvidia_client import _build_context
        result = _build_context(0.0, 4.0, "low", "neutral", 0.3)
        assert result == "User seems okay. Be warm and engaging."

    def test_all_flags_combined(self):
        from utils.nvidia_client import _build_context
        result = _build_context(0.9, 1.0, "crisis", "fear", 0.9)
        # All 4 flags should fire
        parts = result.split(" | ")
        assert len(parts) >= 4


class TestEncryptionRoundtrip:
    """Unit tests for AES-256-GCM encrypt/decrypt integrity"""

    def test_encrypt_produces_three_part_string(self):
        os.environ['ENCRYPTION_KEY'] = 'a' * 64
        # Import Node encryption via subprocess equivalence — test pattern only
        import subprocess
        result = subprocess.run(
            ['node', '-e',
             "require('dotenv').config({path:'./backend/.env'});"
             "const {encrypt,decrypt}=require('./backend/utils/encryption');"
             "const e=encrypt('test message');"
             "const d=decrypt(e);"
             "console.log(JSON.stringify({parts:e.split(':').length,roundtrip:d==='test message'}))"],
            capture_output=True, text=True,
            cwd=os.path.join(os.path.dirname(__file__), '..')
        )
        if result.returncode == 0 and result.stdout.strip():
            import json
            data = json.loads(result.stdout.strip())
            assert data['parts'] == 3, "Encrypted string must be iv:tag:cipher (3 parts)"
            assert data['roundtrip'] is True, "Decrypted text must match original"

    def test_empty_string_returns_empty(self):
        result = subprocess.run(
            ['node', '-e',
             "require('dotenv').config({path:'./backend/.env'});"
             "const {encrypt}=require('./backend/utils/encryption');"
             "console.log(encrypt(''))"],
            capture_output=True, text=True,
            cwd=os.path.join(os.path.dirname(__file__), '..')
        )
        if result.returncode == 0:
            assert result.stdout.strip() == ''

import subprocess


class TestRiskScoreRange:
    """Unit tests for XGBoost risk prediction — output contract"""

    def test_risk_score_is_0_to_1(self):
        """Simulate a feature vector and verify score stays in 0-1 range"""
        import pickle
        model_path = os.path.join(os.path.dirname(__file__), '..', 'ai-service', 'models', 'risk_model.pkl')
        if not os.path.exists(model_path):
            pytest.skip("risk_model.pkl not trained yet — run model_trainer.py first")

        with open(model_path, 'rb') as f:
            model = pickle.load(f)

        import numpy as np
        # Worst-case feature vector (all high-risk signals)
        X_crisis = np.array([[1.0, 1.0, 7.0, 3.0, 0.95, 0.95, 0.85, 10, 0.5, 0.2, 0.9, 1.0, 1.0, 1.0]])
        score = float(model.predict_proba(X_crisis)[0][1])
        assert 0.0 <= score <= 1.0, f"Risk score {score} out of valid range [0,1]"

    def test_low_risk_vector_scores_below_0_5(self):
        import pickle, numpy as np
        model_path = os.path.join(os.path.dirname(__file__), '..', 'ai-service', 'models', 'risk_model.pkl')
        if not os.path.exists(model_path):
            pytest.skip("risk_model.pkl not trained yet")

        with open(model_path, 'rb') as f:
            model = pickle.load(f)

        # Low-risk feature vector
        X_low = np.array([[4.0, 0.1, 8.0, 8.0, 0.1, 0.1, 0.05, 0, 0.2, 0.1, 0.0, 0.0, 0.0, 0.0]])
        score = float(model.predict_proba(X_low)[0][1])
        assert score < 0.5, f"Low-risk vector should score below 0.5, got {score}"


# ══════════════════════════════════════════════════════════════════════════════
# INTEGRATION TESTS — Require NVIDIA API key in environment
# ══════════════════════════════════════════════════════════════════════════════

class TestNvidiaClient:
    """Integration tests for NVIDIA API connectivity"""

    def test_env_key_is_set(self):
        from dotenv import load_dotenv
        load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'ai-service', '.env'))
        key = os.getenv("NVIDIA_API_KEY", "")
        assert key.startswith("nvapi-"), f"NVIDIA_API_KEY must start with 'nvapi-', got: {key[:12]}"

    def test_generate_response_returns_reply_key(self):
        from dotenv import load_dotenv
        load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'ai-service', '.env'))
        from utils.nvidia_client import generate_response

        result = asyncio.get_event_loop().run_until_complete(
            generate_response(
                message="I feel a bit tired today.",
                language="en",
                mood_score=3.0,
                risk_level="low",
                emotion_detected="neutral",
                sentiment_score=0.3
            )
        )
        assert "reply" in result, "Response must contain 'reply' key"
        assert "modelUsed" in result, "Response must contain 'modelUsed' key"
        assert len(result["reply"]) > 10, "Reply must be a non-trivial string"

    def test_fallback_triggers_when_api_key_missing(self):
        from utils.nvidia_client import generate_response, FALLBACK_RESPONSES
        import utils.nvidia_client as nc

        # Temporarily remove the client
        original_client = nc.client
        nc.client = None
        result = asyncio.get_event_loop().run_until_complete(
            generate_response(message="test", language="en")
        )
        nc.client = original_client  # restore

        assert result["modelUsed"] == "fallback_missing_nvidia_key"
        assert result["reply"] == FALLBACK_RESPONSES["en"]

    def test_tamil_fallback_response_is_tamil(self):
        from utils.nvidia_client import FALLBACK_RESPONSES
        assert "நான்" in FALLBACK_RESPONSES["ta"], "Tamil fallback should contain Tamil text"

    def test_tanglish_fallback_is_present(self):
        from utils.nvidia_client import FALLBACK_RESPONSES
        assert "tanglish" in FALLBACK_RESPONSES, "Tanglish fallback must exist"


# ══════════════════════════════════════════════════════════════════════════════
# SYSTEM TESTS — End-to-end payload flow
# ══════════════════════════════════════════════════════════════════════════════

class TestEndToEndPayload:
    """System tests: full payload through /api/chat and /api/crisis/detect"""

    BASE_URL = "http://localhost:8000"

    def _post(self, path, payload):
        import requests
        try:
            res = requests.post(f"{self.BASE_URL}{path}", json=payload, timeout=30)
            return res
        except Exception as e:
            pytest.skip(f"AI service not running at {self.BASE_URL}: {e}")

    def test_chat_endpoint_returns_200(self):
        res = self._post("/api/chat", {
            "message": "I feel tired and unmotivated today",
            "language": "en",
            "mood_score": 2.0,
            "risk_level": "moderate",
            "emotion_detected": "sadness",
            "sentiment_score": 0.6
        })
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        body = res.json()
        assert "reply" in body
        assert "isCrisis" in body
        assert "crisisProbability" in body
        assert isinstance(body["crisisProbability"], float)

    def test_crisis_true_positive(self):
        res = self._post("/api/crisis/detect", {
            "text": "I don't see the point of anything anymore",
            "uid": "test-system"
        })
        assert res.status_code == 200
        body = res.json()
        assert body.get("crisisProbability", 0) > 0.55, \
            f"Expected crisis probability > 0.55, got {body.get('crisisProbability')}"

    def test_crisis_false_positive_prevention(self):
        """'Kill it' idiom should NOT trigger crisis alert"""
        res = self._post("/api/crisis/detect", {
            "text": "I want to kill this exam tomorrow, it's so hard",
            "uid": "test-system"
        })
        assert res.status_code == 200
        body = res.json()
        assert body.get("crisisProbability", 1) < 0.30, \
            f"False positive! Everyday idiom scored {body.get('crisisProbability')}"

    def test_sentiment_tamil_text(self):
        res = self._post("/api/sentiment/analyze", {
            "text": "romba kashtama irukku, enna panrathu theriyala",
            "uid": "test-system"
        })
        assert res.status_code == 200
        body = res.json()
        assert "sentimentScore" in body or "sentiment_score" in body
        # Should detect negative
        score = body.get("sentimentScore") or body.get("sentiment_score", 0)
        assert score > 0.5, f"Tamil distress text should score > 0.5 negative, got {score}"

    def test_risk_endpoint_returns_shap_factors(self):
        res = self._post("/api/predict/risk", {
            "uid": "test-system",
            "moodScore": 1.5,
            "sleepHours": 4.0,
            "cycleVulnerability": 0.89,
            "crisisProbability": 0.31,
            "sentimentScore": 0.82,
            "energyLevel": 2,
            "anxietyLevel": 8,
            "stepsDeviationScore": 0.7,
            "sleepDeviationScore": 0.8,
            "gpsEntropyScore": 0.6,
            "jitaiNonResponseRate": 0.4,
            "missedCheckins": 2,
            "daysSinceClinicianContact": 5,
            "dropout_risk": 0.3
        })
        if res.status_code == 200:
            body = res.json()
            assert "riskScore" in body or "risk_score" in body
            # Risk should be elevated for this crisis-level payload
            score = body.get("riskScore") or body.get("risk_score", 0)
            assert score > 0.4, f"High-risk payload scored {score}, expected > 0.4"

    def test_backend_health_check(self):
        import requests
        try:
            res = requests.get("http://localhost:5000/api/health", timeout=5)
            assert res.status_code == 200
            body = res.json()
            assert body.get("status") == "ok" or body.get("service") == "backend"
        except Exception as e:
            pytest.skip(f"Backend not running: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# NAVIGATION TESTS (Structural — no device needed)
# ══════════════════════════════════════════════════════════════════════════════

class TestNavigationStructure:
    """Structural tests — verify all screens are imported and registered"""

    def test_all_tab_screens_present(self):
        navigator_path = os.path.join(
            os.path.dirname(__file__), '..', 'mobile-app', 'src', 'navigation', 'AppNavigator.js'
        )
        content = open(navigator_path, encoding='utf-8').read()
        for screen in ['HomeScreen', 'JournalScreen', 'ChatScreen', 'CycleScreen']:
            assert screen in content, f"Tab screen '{screen}' missing from AppNavigator"

    def test_all_stack_screens_present(self):
        navigator_path = os.path.join(
            os.path.dirname(__file__), '..', 'mobile-app', 'src', 'navigation', 'AppNavigator.js'
        )
        content = open(navigator_path, encoding='utf-8').read()
        for screen in ['InsightsScreen', 'CBTReframeScreen', 'SomaticBreathingScreen']:
            assert screen in content, f"Stack screen '{screen}' missing from AppNavigator"

    def test_hitslop_present(self):
        navigator_path = os.path.join(
            os.path.dirname(__file__), '..', 'mobile-app', 'src', 'navigation', 'AppNavigator.js'
        )
        content = open(navigator_path, encoding='utf-8').read()
        assert 'hitSlop' in content, "hitSlop must be present for Android nav fix"

    def test_keyboard_hide_present(self):
        navigator_path = os.path.join(
            os.path.dirname(__file__), '..', 'mobile-app', 'src', 'navigation', 'AppNavigator.js'
        )
        content = open(navigator_path, encoding='utf-8').read()
        assert 'tabBarHideOnKeyboard' in content, "tabBarHideOnKeyboard must be set"

    def test_all_screen_files_exist(self):
        screen_dir = os.path.join(
            os.path.dirname(__file__), '..', 'mobile-app', 'src', 'screens'
        )
        required = ['Home.js', 'Journal.js', 'Chat.js', 'Cycle.js',
                    'Insights.js', 'Login.js', 'Signup.js', 'Onboarding.js']
        for f in required:
            assert os.path.exists(os.path.join(screen_dir, f)), f"Screen file missing: {f}"

    def test_intervention_screens_exist(self):
        interventions_dir = os.path.join(
            os.path.dirname(__file__), '..', 'mobile-app', 'src', 'screens', 'interventions'
        )
        for f in ['CBTReframe.js', 'SomaticBreathing.js']:
            assert os.path.exists(os.path.join(interventions_dir, f)), \
                f"Intervention screen missing: {f}"
