#!/bin/bash
# Double-click to launch the local model troubleshooter.
# Serves the whole site from the project root (the viewer imports the real
# portfolio render code from ../modelling, so the server must be rooted there)
# with caching disabled, then opens the viewer.

if command -v python3 &>/dev/null; then PY="python3"
elif command -v python &>/dev/null; then PY="python"
else
  osascript -e 'display alert "Python not found" message "Install Python from https://python.org then try again."'
  exit 1
fi

# Project root is the parent of this script's folder (local-model-viewer/).
cd "$(dirname "$0")/.."

echo "Model troubleshooter at http://localhost:8080/local-model-viewer/"
echo "Press Ctrl+C to stop."
echo ""

(sleep 1 && open "http://localhost:8080/local-model-viewer/") &
$PY dev-server.py 8080
