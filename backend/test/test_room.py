import urllib.request
import urllib.parse
import json

PB = 'http://127.0.0.1:8090'

# Create guest
req = urllib.request.Request(f'{PB}/api/muse/guest', method='POST', headers={'Content-Type': 'application/json'}, data=b'{}')
guest = json.loads(urllib.request.urlopen(req).read())
token = guest['token']
uid = guest['record']['id']
print('Guest:', uid)

# Create lobby
body = json.dumps({'host': uid, 'status': 'waiting', 'mode': 'dictator', 'duration': 10, 'rounds_total': 10, 'current_round': 0}).encode()
req = urllib.request.Request(f'{PB}/api/collections/lobbies/records', method='POST', headers={'Authorization': token, 'Content-Type': 'application/json'}, data=body)
lobby = json.loads(urllib.request.urlopen(req).read())
print('Lobby:', lobby['id'], 'Code:', lobby['code'])

# Create player
body = json.dumps({'lobby': lobby['id'], 'user': uid, 'name': 'TestPlayer', 'score': 0, 'streak': 0, 'status': 'waiting'}).encode()
req = urllib.request.Request(f'{PB}/api/collections/players/records', method='POST', headers={'Authorization': token, 'Content-Type': 'application/json'}, data=body)
player = json.loads(urllib.request.urlopen(req).read())
print('Player:', player['id'])

# Try fetching lobby by code using PocketBase filter syntax
filter_str = f'code = "{lobby["code"]}"'
encoded_filter = urllib.parse.quote(filter_str)
url = f'{PB}/api/collections/lobbies/records?filter={encoded_filter}&perPage=1'
req = urllib.request.Request(url)
req.add_header('Authorization', token)
resp = urllib.request.urlopen(req)
data = json.loads(resp.read())
print('Fetch lobby by code:', data['items'][0]['id'] if data['items'] else 'NOT FOUND')
print('URL used:', url)
print('Filter:', filter_str)
