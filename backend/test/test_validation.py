import json
import os
import urllib.error
import urllib.request

PB = os.environ.get('MUSE_TEST_PB', 'http://127.0.0.1:8090')

print('=== Testing Song Pool Validation ===')

# Create guest
req = urllib.request.Request(f'{PB}/api/muse/guest', method='POST', headers={'Content-Type': 'application/json'}, data=b'{}')
resp = urllib.request.urlopen(req)
guest = json.loads(resp.read())

# Create lobby
body = {
    'host': guest['record']['id'],
    'status': 'waiting',
    'mode': 'dictator',
    'duration': 10,
    'rounds_total': 5,
    'current_round': 0,
    'artists': [],
    'song_pool': [],
    'expires_at': '2026-05-24T10:00:00.000Z',
}
req = urllib.request.Request(
    f'{PB}/api/collections/lobbies/records',
    method='POST',
    headers={'Authorization': guest['token'], 'Content-Type': 'application/json'},
    data=json.dumps(body).encode()
)
resp = urllib.request.urlopen(req)
lobby = json.loads(resp.read())

# Test 1: Missing previewUrl
print('Test 1: Missing previewUrl')
req = urllib.request.Request(
    f'{PB}/api/muse/lobby/{lobby["id"]}/start',
    method='POST',
    headers={'Authorization': guest['token'], 'Content-Type': 'application/json'},
    data=json.dumps({'song_pool': [{'trackName': 'Test', 'artistName': 'Test', 'artworkUrl': ''}]}).encode()
)
try:
    urllib.request.urlopen(req)
    print('  FAIL: should have errored')
except urllib.error.HTTPError as e:
    err = json.loads(e.read())
    print(f'  PASS: {e.code} - {err.get("message")}')

# Test 2: Missing trackName
print('Test 2: Missing trackName')
req = urllib.request.Request(
    f'{PB}/api/muse/lobby/{lobby["id"]}/start',
    method='POST',
    headers={'Authorization': guest['token'], 'Content-Type': 'application/json'},
    data=json.dumps({'song_pool': [{'previewUrl': 'http://test.mp3', 'artistName': 'Test', 'artworkUrl': ''}]}).encode()
)
try:
    urllib.request.urlopen(req)
    print('  FAIL: should have errored')
except urllib.error.HTTPError as e:
    err = json.loads(e.read())
    print(f'  PASS: {e.code} - {err.get("message")}')

# Test 3: Missing artistName
print('Test 3: Missing artistName')
req = urllib.request.Request(
    f'{PB}/api/muse/lobby/{lobby["id"]}/start',
    method='POST',
    headers={'Authorization': guest['token'], 'Content-Type': 'application/json'},
    data=json.dumps({'song_pool': [{'previewUrl': 'http://test.mp3', 'trackName': 'Test', 'artworkUrl': ''}]}).encode()
)
try:
    urllib.request.urlopen(req)
    print('  FAIL: should have errored')
except urllib.error.HTTPError as e:
    err = json.loads(e.read())
    print(f'  PASS: {e.code} - {err.get("message")}')

# Test 4: Valid pool
print('Test 4: Valid pool')
req = urllib.request.Request(
    f'{PB}/api/muse/lobby/{lobby["id"]}/start',
    method='POST',
    headers={'Authorization': guest['token'], 'Content-Type': 'application/json'},
    data=json.dumps({'song_pool': [
        {
            'previewUrl': f'http://test{index}.mp3',
            'trackName': f'Song {index}',
            'artistName': f'Artist {index}',
            'artworkUrl': '',
        }
        for index in range(1, 16)
    ]}).encode()
)
resp = urllib.request.urlopen(req)
print(f'  PASS: {json.loads(resp.read())}')

print('\n=== ALL VALIDATION TESTS PASSED ===')
