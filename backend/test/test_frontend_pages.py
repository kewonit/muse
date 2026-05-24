import urllib.request, json

PB = 'http://127.0.0.1:8090'
FE = 'http://localhost:3000'

# Test 1: Landing page
resp = urllib.request.urlopen(f'{FE}/')
html = resp.read().decode()
print('=== LANDING PAGE ===')
print('Has Listen. Guess. Win.:', 'Listen. Guess. Win.' in html)
print('Has Play Solo button:', 'Play Solo' in html)
print('Has Group Lobby button:', 'Group Lobby' in html)

# Test 2: Room page (non-existent)
resp = urllib.request.urlopen(f'{FE}/room/NONEXIST')
html = resp.read().decode()
print('\n=== ROOM PAGE (non-existent) ===')
print('Has Create New Lobby:', 'Create New Lobby' in html)
print('Has 404 in title:', '404' in html)

# Test 3: Create a real lobby and visit it
req = urllib.request.Request(f'{PB}/api/muse/guest', method='POST', headers={'Content-Type': 'application/json'}, data=b'{}')
resp = urllib.request.urlopen(req)
guest = json.loads(resp.read())
print('\n=== FRESH GUEST ===')
print('Guest ID:', guest['record']['id'])

body = {'host': guest['record']['id'], 'status': 'waiting', 'mode': 'dictator', 'duration': 10, 'rounds_total': 10, 'current_round': 0, 'artists': [], 'song_pool': [], 'expires_at': '2026-05-24T10:00:00.000Z'}
req = urllib.request.Request(f'{PB}/api/collections/lobbies/records', method='POST', headers={'Authorization': guest['token'], 'Content-Type': 'application/json'}, data=json.dumps(body).encode())
resp = urllib.request.urlopen(req)
lobby = json.loads(resp.read())
print('Lobby code:', lobby['code'])

resp = urllib.request.urlopen(f'{FE}/room/{lobby["code"]}')
html = resp.read().decode()
print('\n=== ROOM PAGE (real lobby) ===')
print('Has Loading...:', 'Loading...' in html)
print('Has Create New Lobby:', 'Create New Lobby' in html)
print('Has 404 in title:', '404' in html)
print('Has Join & Enable Audio:', 'Join & Enable Audio' in html)
