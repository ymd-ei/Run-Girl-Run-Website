#!/bin/bash

echo "Starting portfolio server..."
echo ""

# Check for Python
if command -v python3 &>/dev/null; then
    PY="python3"
elif command -v python &>/dev/null; then
    PY="python"
else
    osascript -e 'display alert "Python not found" message "Please install Python from https://python.org then try again."'
    exit 1
fi

# Move to the folder this script lives in
cd "$(dirname "$0")"

# Open the browser after a short delay (runs in background)
(sleep 1 && open http://localhost:8080) &

echo "Server running at http://localhost:8080"
echo "Editor at   http://localhost:8080/editor.html"
echo ""
echo "Press Ctrl+C to stop."
echo ""

# Start the server — this keeps the terminal open
$PY -m http.server 8080
