"""Backend tests for Interview Prep platform"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://interview-ai-coach-15.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@interprep.com"
ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return s


# --- Domains ---
class TestDomains:
    def test_get_domains_returns_six(self, api):
        r = api.get(f"{BASE_URL}/api/domains")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 6
        slugs = {d["slug"] for d in data}
        assert {"javascript", "react", "nodejs", "python", "system-design"}.issubset(slugs)

    def test_get_domain_by_slug(self, api):
        r = api.get(f"{BASE_URL}/api/domains/javascript")
        assert r.status_code == 200
        assert r.json()["slug"] == "javascript"

    def test_get_domain_not_found(self, api):
        r = api.get(f"{BASE_URL}/api/domains/does-not-exist-xyz")
        assert r.status_code == 404


# --- Questions ---
class TestQuestions:
    def test_questions_by_domain(self, api):
        r = api.get(f"{BASE_URL}/api/questions", params={"domain_id": "d-javascript"})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert all(q["domain_id"] == "d-javascript" for q in data)

    def test_questions_difficulty_filter(self, api):
        r = api.get(f"{BASE_URL}/api/questions", params={"domain_id": "d-javascript", "difficulty": "easy"})
        assert r.status_code == 200
        for q in r.json():
            assert q["difficulty"] == "easy"

    def test_questions_most_asked(self, api):
        r = api.get(f"{BASE_URL}/api/questions", params={"most_asked": "true"})
        assert r.status_code == 200
        for q in r.json():
            assert q["is_most_asked"] is True


# --- Auth ---
class TestAuth:
    def test_login_success(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert "token" in data
        # httpOnly cookie set
        assert "access_token" in r.cookies

    def test_login_invalid_password(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_login_unknown_email(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"email": "nope@example.com", "password": "x"})
        assert r.status_code == 401

    def test_auth_me_with_cookie(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_auth_me_unauthenticated(self, api):
        bare = requests.Session()
        r = bare.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401


# --- Admin Analytics ---
class TestAnalytics:
    def test_analytics_requires_auth(self, api):
        r = requests.get(f"{BASE_URL}/api/admin/analytics")
        assert r.status_code == 401

    def test_analytics_authenticated(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/admin/analytics")
        assert r.status_code == 200
        data = r.json()
        assert "total_domains" in data and data["total_domains"] >= 6
        assert "total_questions" in data and data["total_questions"] >= 12
        assert "total_chat_sessions" in data
        assert "difficulty_breakdown" in data


# --- Admin Domain CRUD ---
class TestDomainCRUD:
    def test_create_update_delete_domain(self, auth_session):
        suffix = uuid.uuid4().hex[:6]
        name = f"TEST_Domain_{suffix}"
        # Create
        r = auth_session.post(f"{BASE_URL}/api/admin/domains", json={"name": name, "description": "tmp"})
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["name"] == name
        assert "id" in created
        domain_id = created["id"]
        slug = created["slug"]

        # Verify via GET by slug
        g = auth_session.get(f"{BASE_URL}/api/domains/{slug}")
        assert g.status_code == 200

        # Update
        new_name = f"TEST_Updated_{suffix}"
        u = auth_session.put(f"{BASE_URL}/api/admin/domains/{domain_id}", json={"name": new_name})
        assert u.status_code == 200
        assert u.json()["name"] == new_name

        # Delete
        d = auth_session.delete(f"{BASE_URL}/api/admin/domains/{domain_id}")
        assert d.status_code == 200

        # Verify gone
        slug2 = u.json()["slug"]
        g2 = auth_session.get(f"{BASE_URL}/api/domains/{slug2}")
        assert g2.status_code == 404

    def test_create_domain_unauthenticated(self, api):
        r = requests.post(f"{BASE_URL}/api/admin/domains", json={"name": "TEST_NoAuth"})
        assert r.status_code == 401


# --- Admin Question CRUD ---
class TestQuestionCRUD:
    def test_create_update_delete_question(self, auth_session):
        payload = {
            "domain_id": "d-javascript",
            "question": "TEST_Question_What is hoisting?",
            "answer": "Hoisting is...",
            "difficulty": "medium",
            "is_most_asked": False,
            "tags": ["TEST_"]
        }
        r = auth_session.post(f"{BASE_URL}/api/admin/questions", json=payload)
        assert r.status_code == 200, r.text
        created = r.json()
        qid = created["id"]
        assert created["question"] == payload["question"]

        # Verify via list
        g = auth_session.get(f"{BASE_URL}/api/questions/{qid}")
        assert g.status_code == 200

        # Update
        u = auth_session.put(f"{BASE_URL}/api/admin/questions/{qid}", json={"difficulty": "hard", "is_most_asked": True})
        assert u.status_code == 200
        assert u.json()["difficulty"] == "hard"
        assert u.json()["is_most_asked"] is True

        # Delete
        d = auth_session.delete(f"{BASE_URL}/api/admin/questions/{qid}")
        assert d.status_code == 200

        # Verify gone
        g2 = auth_session.get(f"{BASE_URL}/api/questions/{qid}")
        assert g2.status_code == 404


# --- Search ---
class TestSearch:
    def test_search_closure(self, api):
        r = api.get(f"{BASE_URL}/api/search", params={"q": "closure"})
        assert r.status_code == 200
        data = r.json()
        assert "domains" in data and "questions" in data
        # Should match q-js-1 by tag/question text
        assert len(data["questions"]) > 0

    def test_search_short_query(self, api):
        r = api.get(f"{BASE_URL}/api/search", params={"q": "a"})
        assert r.status_code == 200
        assert r.json() == {"domains": [], "questions": []}


# --- AI Chat (mark slow, allow skip on failure) ---
class TestChat:
    def test_chat_basic(self, api):
        payload = {
            "question_context": "What is a closure?",
            "answer_context": "A closure is a function that has access to outer scope.",
            "user_message": "Give me a 1-line summary."
        }
        try:
            r = api.post(f"{BASE_URL}/api/chat", json=payload, timeout=60)
        except requests.Timeout:
            pytest.skip("AI chat timed out")
        if r.status_code == 500:
            pytest.skip(f"AI chat 500 (LLM): {r.text}")
        assert r.status_code == 200
        data = r.json()
        assert "response" in data and isinstance(data["response"], str)
        assert "session_id" in data
