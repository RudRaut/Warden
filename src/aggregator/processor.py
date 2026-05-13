import redis
import json
import hashlib
import time
import requests
from requests.auth import HTTPBasicAuth

# --- Configuration ---
COUCHDB_URL = "http://127.0.0.1:5984" # Use 127.0.0.1 to avoid local DNS issues
DB_NAME = "warden_logs"
AUTH = HTTPBasicAuth('admin', 'admin@123')

def init_couchdb():
    try:
        # We use a session for better performance with multiple requests
        resp = requests.put(f"{COUCHDB_URL}/{DB_NAME}", auth=AUTH)
        if resp.status_code == 201:
            print(f"[WARDEN] Database '{DB_NAME}' created successfully.")
        else:
            print(f"[WARDEN] Database '{DB_NAME}' verified.")
    except Exception as e:
        print(f"[WARDEN] Connection Error: {e}")

def push_to_couchdb(events, epoch_id):
    docs = []
    for e in events:
        # Schema aligned with the new C++ Agent Redis payload
        doc = {
            "timestamp": e.get('time'), 
            "file_path": e.get('path'),
            "file_name": e.get('file_name'),
            "action": e.get('action'),
            "file_hash": e.get('hash'),
            "file_size": e.get('file_size'),
            "epoch_id": epoch_id
        }
        docs.append(doc)

    payload = {"docs": docs}
    url = f"{COUCHDB_URL}/{DB_NAME}/_bulk_docs"
    
    try:
        response = requests.post(url, json=payload, auth=AUTH)
        # 201 means the request was accepted
        if response.status_code == 201:
            return True
        else:
            print(f"[WARDEN] CouchDB Error ({response.status_code}): {response.text}")
            return False
    except Exception as e:
        print(f"[WARDEN] Request failed: {e}")
        return False

def build_merkle_root(hashes):
    """Recursive Merkle Tree builder."""
    if not hashes:
        return None
    if len(hashes) == 1:
        return hashes[0]
    
    new_level = []
    # Process in pairs
    for i in range(0, len(hashes), 2):
        left = hashes[i]
        # If odd number of hashes, pair the last one with itself
        right = hashes[i+1] if i+1 < len(hashes) else hashes[i]
        
        combined = hashlib.sha256((left + right).encode()).hexdigest()
        new_level.append(combined)
    
    return build_merkle_root(new_level)

def run_aggregator():
    # decode_responses=True is the 'secret sauce' for Redis strings
    r = redis.Redis(host='127.0.0.1', port=6379, db=0, decode_responses=True)
    init_couchdb()

    print("[WARDEN] Aggregator is live. Watching Redis...")

    while True:
        start_time = time.time()
        events = []

        # Collect for 60 seconds
        while (time.time() - start_time) < 60:
            data = r.rpop('warden_events')
            if data:
                events.append(json.loads(data))
            else:
                time.sleep(0.5)

        if events:
            # Generate epoch metadata
            epoch_ts = int(time.time())
            epoch_id = f"E-{epoch_ts}"
            
            hashes = [e.get('hash') for e in events]
            root = build_merkle_root(hashes)
            
            if push_to_couchdb(events, epoch_id):
                print(f"[WARDEN] Epoch {epoch_id} complete. Merkle Root: {root[:16]} pushed to CouchDB.")
            else:
                print(f"[WARDEN] Epoch {epoch_id} failed to push to CouchDB.")
        else:
            print("[WARDEN] Window closed. No activity.")

if __name__ == "__main__":
    run_aggregator()