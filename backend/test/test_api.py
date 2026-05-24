import json
import os
import urllib.parse
import urllib.request
import urllib.error

PB = os.environ.get("MUSE_TEST_PB", "http://127.0.0.1:8090")


def request(method, path, token=None, body=None, expect_status=200):
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = token
    if body is not None:
        data = json.dumps(body).encode()

    req = urllib.request.Request(f"{PB}{path}", method=method, headers=headers, data=data)
    try:
        with urllib.request.urlopen(req) as resp:
            payload = json.loads(resp.read() or b"{}")
            if resp.status != expect_status:
                raise AssertionError(f"{method} {path} expected {expect_status}, got {resp.status}: {payload}")
            return payload
    except urllib.error.HTTPError as err:
        payload = json.loads(err.read() or b"{}")
        if err.code != expect_status:
            raise AssertionError(f"{method} {path} expected {expect_status}, got {err.code}: {payload}")
        return payload


def song_pool(total):
    return [
        {
            "previewUrl": f"https://example.com/song-{index}.mp3",
            "trackName": f"Song {index}",
            "artistName": "Test Artist",
            "artworkUrl": f"https://example.com/art-{index}.jpg",
        }
        for index in range(1, total + 1)
    ]

def correct_choice_for_current(current, token):
    round_record = request("GET", f"/api/collections/rounds/records/{current['round_id']}", token=token)
    return next(choice for choice in current["choices"] if choice["trackName"] == round_record["song_name"])


print("=== Testing Muse async room APIs ===")

guest = request("POST", "/api/muse/guest", body={})
token = guest["token"]
user_id = guest["record"]["id"]
print("1. Guest:", user_id)

lobby = request(
    "POST",
    "/api/collections/lobbies/records",
    token=token,
    body={
        "host": user_id,
        "status": "waiting",
        "mode": "dictator",
        "duration": 5,
        "rounds_total": 5,
        "current_round": 0,
        "max_players": 2,
        "artists": [],
        "song_pool": [],
    },
)
print("2. Lobby:", lobby["id"], "code:", lobby["code"])

request(
    "POST",
    f"/api/muse/lobby/{lobby['id']}/start",
    token=token,
    body={"song_pool": [{"trackName": "Broken", "artistName": "Nobody"}]},
    expect_status=400,
)
print("3. Invalid song pool rejected")

request(
    "POST",
    f"/api/muse/lobby/{lobby['id']}/start",
    token=token,
    body={"song_pool": song_pool(15), "max_players": 2},
)
print("4. Room opened")

join = request("POST", f"/api/muse/lobby/{lobby['id']}/join", token=token)
player = join["player"]
print("5. Joined:", player["id"])

current = request("GET", f"/api/muse/player/{player['id']}/current", token=token)
assert current["started"] is False
print("6. Current before start:", current["started"])

current = request("POST", f"/api/muse/player/{player['id']}/start", token=token)
assert current["started"] is False
assert current["round_number"] == 1
assert len(current["choices"]) == 3
current = request("POST", f"/api/muse/player/{player['id']}/playing", token=token)
assert current["started"] is True
print("7. Attempt started:", current["round_number"])

for round_number in range(1, 6):
    correct_choice = correct_choice_for_current(current, token)
    result = request(
        "POST",
        f"/api/muse/player/{player['id']}/guess",
        token=token,
        body={"choice_id": correct_choice["id"], "round_number": round_number},
    )
    assert result["answer"]["correct"] is True
    print(f"8.{round_number}. Guess scored:", result["answer"]["points"])

    if round_number < 5:
        current = request("GET", f"/api/muse/player/{player['id']}/current", token=token)
        assert current["round_number"] == round_number + 1
        assert current["started"] is False
        current = request("POST", f"/api/muse/player/{player['id']}/start", token=token)
        assert current["round_number"] == round_number + 1
        assert current["started"] is False
        current = request("POST", f"/api/muse/player/{player['id']}/playing", token=token)
        assert current["started"] is True
    else:
        assert result["finished"] is True

scoreboard = request("GET", f"/api/muse/lobby/{lobby['id']}/scoreboard", token=token)
assert scoreboard["players"][0]["status"] == "finished"
assert scoreboard["players"][0]["score"] > 0
print("9. Scoreboard:", scoreboard["players"][0]["score"])

lookup_filter = urllib.parse.quote(f'code = "{lobby["code"]}"')
lookup = request("GET", f"/api/collections/lobbies/records?filter={lookup_filter}", token=token)
assert lookup["items"][0]["song_pool"] == []
print("10. Lobby song_pool hidden after start")

print("\nALL ASYNC API TESTS PASSED")
