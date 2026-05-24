import urllib.request
import urllib.parse
import json

PB = 'http://127.0.0.1:8090'

print('=== Reproducing exact frontend API call ===')

# Step 1: Create guest (exactly like frontend does with fetch)
req = urllib.request.Request(
    f'{PB}/api/muse/guest',
    method='POST',
    headers={'Content-Type': 'application/json'},
    data=b'{}'
)
resp = urllib.request.urlopen(req)
guest = json.loads(resp.read())
token = guest['token']
uid = guest['record']['id']
print(f'1. Guest created: {uid}')
print(f'   Token: {token[:50]}...')

# Step 2: Create lobby EXACTLY like frontend does
# This mimics: pb.collection("lobbies").create({...})
body = {
    'host': uid,
    'status': 'waiting',
    'mode': 'dictator',
    'duration': 10,
    'rounds_total': 10,
    'current_round': 0,
    'artists': [],
    'song_pool': [],
    'expires_at': '2026-05-24T10:00:00.000Z',
}
body_json = json.dumps(body).encode()
print(f'\n2. Creating lobby with body: {json.dumps(body, indent=2)}')

req = urllib.request.Request(
    f'{PB}/api/collections/lobbies/records',
    method='POST',
    headers={
        'Authorization': token,
        'Content-Type': 'application/json'
    },
    data=body_json
)

try:
    resp = urllib.request.urlopen(req)
    lobby = json.loads(resp.read())
    print(f'   SUCCESS: Lobby created!')
    print(f'   ID: {lobby["id"]}')
    print(f'   Code: {lobby["code"]}')
    print(f'   Host: {lobby["host"]}')
except urllib.error.HTTPError as e:
    err_body = json.loads(e.read())
    print(f'   FAILED: {e.code}')
    print(f'   Error: {err_body}')
