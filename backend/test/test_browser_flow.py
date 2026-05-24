import urllib.request, json

PB = 'http://127.0.0.1:8090'
FE = 'http://localhost:3000'

# Step 1: Visit landing page
req = urllib.request.Request(f'{FE}/')
resp = urllib.request.urlopen(req)
print('1. Landing page status:', resp.status)

# Step 2: Create guest
req = urllib.request.Request(f'{PB}/api/muse/guest', method='POST', headers={'Content-Type': 'application/json'}, data=b'{}')
guest = json.loads(urllib.request.urlopen(req).read())
print('2. Guest created:', guest['record']['id'])

# Step 3: Create lobby
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
lobby = json.loads(urllib.request.urlopen(req).read())
print('3. Lobby created:', lobby['code'])

# Step 4: Visit room URL
code = lobby['code']
req = urllib.request.Request(f'{FE}/room/{code}')
resp = urllib.request.urlopen(req)
html = resp.read().decode()
print('4. Room page status:', resp.status)
print('   Has 404 text:', 'This page could not be found' in html)
print('   Has Loading:', 'Loading' in html)
print('   Has lobby code:', code in html)

print('\n=== FLOW WORKS ===')
