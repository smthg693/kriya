import pytest
from fastapi.testclient import TestClient
import sys, os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from main import app

client = TestClient(app)

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["model_loaded"] is True

def test_parse_status_intent():
    res = client.post("/parse", json={"text": "mera status batao CIT-001"})
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] in ["STATUS", "PMKISAN", "GREETING"]
    assert data["confidence"] > 0.0
    assert any(e["type"] == "CITIZEN_ID" and e["value"] == "CIT-001" for e in data["entities"])

def test_parse_pmkisan_intent():
    res = client.post("/parse", json={"text": "pm kisan paisa kab aayega"})
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "PMKISAN"
    assert data["confidence"] > 0.5
