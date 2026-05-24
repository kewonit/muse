import urllib.request
import re

FE = 'http://localhost:3000'

# Test room page
resp = urllib.request.urlopen(f'{FE}/room/50365e')
html = resp.read().decode()

# Find all occurrences of "404"
for match in re.finditer(r'404', html):
    start = max(0, match.start() - 100)
    end = min(len(html), match.end() + 100)
    print('Found 404 at position', match.start())
    print('Context:', html[start:end])
    print('---')
