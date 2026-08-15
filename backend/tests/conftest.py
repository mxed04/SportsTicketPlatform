import pytest
from fastapi.testclient import TestClient
from app.main import app


# Create a test client fixture to be used in all tests
@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c
