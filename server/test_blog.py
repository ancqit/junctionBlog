from fastapi.testclient import TestClient

from server.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_create_and_search_entry(tmp_path, monkeypatch):
    monkeypatch.setattr("server.main.DATA_PATH", tmp_path / "blog.json")
    created = client.post(
        "/blog/entries",
        json={
            "junction": "market-east",
            "body": "shop closed early",
            "creatorName": "ankit",
            "creatorNumber": "1042",
            "nameTag": "ankit#1042",
            "tags": ["ankit#1042", "delay"],
        },
    )
    assert created.status_code == 201
    number = created.json()["blogNumber"]
    found = client.get("/blog/entries", params={"q": str(number)})
    assert found.status_code == 200
    assert found.json()[0]["junction"] == "market-east"
    tagged = client.get("/blog/entries", params={"tag": "ankit#1042"})
    assert tagged.json()[0]["blogNumber"] == number
