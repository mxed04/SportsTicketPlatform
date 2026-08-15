def test_unauthorized_reservation_attempt(client):
    # Attempt to reserve a ticket without providing a JWT token
    payload = {"ticket_id": 1}
    response = client.post("/api/reservations/", json=payload)

    # Assert that the system blocks the request (HTTP 401 Unauthorized)
    assert response.status_code == 401

    # Assert the specific error message provided by FastAPI OAuth2
    assert response.json()["detail"] == "Not authenticated"
