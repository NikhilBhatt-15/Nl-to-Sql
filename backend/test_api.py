import urllib.request
import json

data = json.dumps({"question": "Show me all customers"}).encode('utf-8')
req = urllib.request.Request(
    "http://127.0.0.1:8000/query",
    data=data,
    headers={'Content-Type': 'application/json'}
)

try:
    with urllib.request.urlopen(req) as response:
        print("Status code:", response.status)
        print("Response:", response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print("Response:", e.read().decode('utf-8'))
except Exception as e:
    print("Error:", e)