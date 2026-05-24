import urllib.request
import re

FE = 'http://localhost:3000'

resp = urllib.request.urlopen(f'{FE}/room/TEST123')
html = resp.read().decode()

# Extract body content
body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL)
if body_match:
    body = body_match.group(1)
    print('Body length:', len(body))
    # Find 404 occurrences in body
    for match in re.finditer(r'404', body):
        start = max(0, match.start() - 80)
        end = min(len(body), match.end() + 80)
        print('404 at body pos', match.start(), ':', body[start:end].replace('\n', ' '))
    # Check for the room ID text
    print('\nHas Room ID: TEST123:', 'Room ID: TEST123' in body)
    print('Body preview (first 300 chars):', body[:300])
else:
    print('No body found')
    print('HTML preview:', html[:500])
