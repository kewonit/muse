import json
import os
import urllib.error
import urllib.request

PB = os.environ.get("MUSE_TEST_PB", "http://127.0.0.1:8090")


def request(method, path, token=None, body=None, expect_status=200):
    payload = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = token
    if body is not None:
        payload = json.dumps(body).encode()

    req = urllib.request.Request(f"{PB}{path}", method=method, headers=headers, data=payload)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read() or b"{}")
            if resp.status != expect_status:
                raise AssertionError(f"{method} {path} expected {expect_status}, got {resp.status}: {data}")
            return data
    except urllib.error.HTTPError as err:
        data = json.loads(err.read() or b"{}")
        if err.code != expect_status:
            raise AssertionError(f"{method} {path} expected {expect_status}, got {err.code}: {data}")
        return data


def song_pool(total):
    return [
        {
            "previewUrl": f"https://example.com/full-{index}.mp3",
            "trackName": f"Full Flow Song {index}",
            "artistName": "Flow Artist",
            "artworkUrl": f"https://example.com/full-{index}.jpg",
        }
        for index in range(1, total + 1)
    ]

def correct_choice_for_current(current, token):
    round_record = request("GET", f"/api/collections/rounds/records/{current['round_id']}", token=token)
    return next(choice for choice in current["choices"] if choice["trackName"] == round_record["song_name"])


print("=== Testing full async flow ===")

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
        "max_players": 4,
        "artists": [],
        "song_pool": [],
    },
)
print("2. Lobby:", lobby["code"])

request(
    "POST",
    f"/api/muse/lobby/{lobby['id']}/start",
    token=token,
    body={"song_pool": song_pool(15), "max_players": 4},
)
print("3. Room opened")

player = request("POST", f"/api/muse/lobby/{lobby['id']}/join", token=token)["player"]
print("4. Joined:", player["id"])

current = request("GET", f"/api/muse/player/{player['id']}/current", token=token)
assert current["started"] is False
assert current["total_rounds"] == 5
print("5. Current before start:", current["started"])

current = request("POST", f"/api/muse/player/{player['id']}/start", token=token)
assert current["started"] is False
assert current["round_number"] == 1
assert len(current["choices"]) == 3
current = request("POST", f"/api/muse/player/{player['id']}/playing", token=token)
assert current["started"] is True
print("6. Started round:", current["round_number"])

correct_choice = correct_choice_for_current(current, token)
duplicate = request(
    "POST",
    f"/api/muse/player/{player['id']}/guess",
    token=token,
    body={"choice_id": correct_choice["id"], "round_number": 1},
)
assert duplicate["answer"]["correct"] is True
print("7. First guess:", duplicate["answer"]["points"])

repeat = request(
    "POST",
    f"/api/muse/player/{player['id']}/guess",
    token=token,
    body={"choice_id": correct_choice["id"], "round_number": 1},
)
assert repeat["answer"]["round_number"] == 1
print("8. Duplicate guess is idempotent")

current = request("GET", f"/api/muse/player/{player['id']}/current", token=token)
assert current["started"] is False
assert current["round_number"] == 2
print("9. Next round waits for player")

print("\nALL FULL FLOW TESTS PASSED")
