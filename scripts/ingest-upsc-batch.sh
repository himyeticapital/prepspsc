#!/bin/bash
# Batch ingest all UPSC PDFs from papers/upsc/
# Usage: bash scripts/ingest-upsc-batch.sh [--dry-run]
# Skips files that have already been ingested (tracks in papers/upsc/.ingested)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
UPSC_DIR="$ROOT_DIR/papers/upsc"
INGESTED_LOG="$UPSC_DIR/.ingested"
DRY_RUN=""

if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
  echo "DRY RUN mode"
fi

touch "$INGESTED_LOG"

pdfs=("$UPSC_DIR"/*.pdf)
if [ ${#pdfs[@]} -eq 0 ] || [ ! -f "${pdfs[0]}" ]; then
  echo "No PDFs found in $UPSC_DIR"
  echo "Run download-upsc-pdfs.sh first"
  exit 1
fi

echo "Found ${#pdfs[@]} PDFs in $UPSC_DIR"
echo ""

success=0
skipped=0
failed=0

for pdf in "${pdfs[@]}"; do
  filename=$(basename "$pdf")

  # Check if already ingested
  if grep -qF "$filename" "$INGESTED_LOG" 2>/dev/null; then
    echo "SKIP (already ingested): $filename"
    ((skipped++)) || true
    continue
  fi

  echo "Ingesting: $filename"

  if npx tsx "$SCRIPT_DIR/ingest-pyqs.ts" --pdf "$pdf" --verify $DRY_RUN; then
    echo "  OK: $filename"
    echo "$filename" >> "$INGESTED_LOG"
    ((success++)) || true
  else
    echo "  FAILED: $filename"
    ((failed++)) || true
  fi

  # Brief pause between files to avoid rate limiting Gemini
  sleep 3
done

echo ""
echo "==============================="
echo "Batch ingestion complete"
echo "Success: $success"
echo "Skipped: $skipped"
echo "Failed:  $failed"
echo "==============================="
