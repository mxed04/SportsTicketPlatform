def test_search_tickets_status_code(client):
    # Send a GET request to the search endpoint without filters
    response = client.get("/api/tickets/search")

    # Assert that the request was successful (HTTP 200 OK)
    assert response.status_code == 200

    # Assert that the response contains the expected keys
    data = response.json()
    assert "tickets" in data
    assert "count" in data
    assert "source" in data


def test_search_tickets_with_filters(client):
    # Send a GET request with specific filters
    params = "sport_type=football&min_price=1000"
    response = client.get(f"/api/tickets/search?{params}")

    # Assert that the request was successful
    assert response.status_code == 200

    data = response.json()
    # Check if the returned data is a list
    assert isinstance(data["tickets"], list)
