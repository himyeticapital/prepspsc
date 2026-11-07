#!/bin/bash
# Download UPSC PYQ PDFs from url-list.json
# Usage: bash scripts/download-upsc-pdfs.sh
# Reads: papers/upsc/url-list.json
# Outputs: papers/upsc/*.pdf

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
URL_LIST="$ROOT_DIR/papers/upsc/url-list.json"
OUTPUT_DIR="$ROOT_DIR/papers/upsc"

if [ ! -f "$URL_LIST" ]; then
  echo "ERROR: $URL_LIST not found. Run url-researcher agent first."
  exit 1
fi

echo "Reading PDF list from $URL_LIST..."

# Parse JSON and download each PDF
python3 - <<'PYEOF'
import json, subprocess, os, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if False else os.getcwd()
url_list_path = os.path.join(root, "papers", "upsc", "url-list.json")
output_dir = os.path.join(root, "papers", "upsc")

with open(url_list_path) as f:
    data = json.load(f)

papers = data.get("papers", [])
print(f"Found {len(papers)} PDFs to download")

success = 0
failed = []

for p in papers:
    url = p["url"]
    filename = p["filename"]
    dest = os.path.join(output_dir, filename)

    if os.path.exists(dest):
        print(f"  SKIP (exists): {filename}")
        success += 1
        continue

    print(f"  Downloading: {filename}")
    result = subprocess.run(
        ["curl", "-L", "-o", dest, "--max-time", "60", "-A",
         "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
         url],
        capture_output=True, text=True
    )

    if result.returncode == 0 and os.path.getsize(dest) > 10000:
        print(f"    OK ({os.path.getsize(dest)//1024}KB)")
        success += 1
    else:
        print(f"    FAILED: {result.stderr.strip()}")
        if os.path.exists(dest):
            os.remove(dest)
        failed.append(filename)

print(f"\nDownloaded: {success}/{len(papers)}")
if failed:
    print(f"Failed: {failed}")
PYEOF
