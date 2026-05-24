import urllib.request, json

PB = 'http://127.0.0.1:8090'

print('=== Testing EXACT browser flow ===')

# Step 1: Clear auth (simulate pb.authStore.clear())
print('1. Auth cleared')

# Step 2: Create fresh guest
req = urllib.request.Request(
    f'{PB}/api/muse/guest',
    method='POST',
    headers={'Content-Type': 'application/json'},
    data=b'{}'
)
resp = urllib.request.urlopen(req)
guest = json.loads(resp.read())
print(f'2. Fresh guest: {guest["record"]["id"]}')

# Step 3: Create lobby with fresh token
body = {
    'host': guest['record']['id'],
    'status': 'waiting',
    'mode': 'dictator',
    'duration': 10,
    'rounds_total': 10,
    'current_round': 0,
    'artists': [],
    'song_pool': [],
    'expires_at': '2026-05-24T10:00:00.000Z',
}
req = urllib.request.Request(
    f'{PB}/api/collections/lobbies/records',
    method='POST',
    headers={
        'Authorization': guest['token'],
        'Content-Type': 'application/json',
    },
    data=json.dumps(body).encode()
)
resp = urllib.request.urlopen(req)
lobby = json.loads(resp.read())
print(f'3. Lobby created: {lobby["code"]}')

print('\n=== ALL STEPS WORK ===')
