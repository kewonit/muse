import urllib.request

FE = 'http://localhost:3000'

# Test room page
resp = urllib.request.urlopen(f'{FE}/room/50365e')
html = resp.read().decode()

# Extract title
import re
title_match = re.search(r'<title>(.*?)</title>', html, re.DOTALL)
if title_match:
    print('Title:', repr(title_match.group(1)))
else:
    print('No title found')

# Check if Loading... is in body (not just anywhere)
body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL)
if body_match:
    body = body_match.group(1)
    print('Has Loading... in body:', 'Loading...' in body)
    print('Has Create New Lobby in body:', 'Create New Lobby' in body)
    print('Has 404 in body:', '404' in body)
    print('Body preview (first 500 chars):', body[:500])
else:
    print('No body found')
