#!/bin/bash
# Startup script for Training Script Runner

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Detect Python command (try python3 first, then python)
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "Error: Python not found. Please install Python 3.7 or later."
    exit 1
fi

# Check Python version
PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | awk '{print $2}')
echo "Using $PYTHON_CMD ($PYTHON_VERSION)"

# Check if Flask is installed
if ! $PYTHON_CMD -c "import flask" 2>/dev/null; then
    echo "Flask not found. Installing dependencies..."
    $PYTHON_CMD -m pip install -r requirements.txt
fi

# Check if flask-cors is installed
if ! $PYTHON_CMD -c "import flask_cors" 2>/dev/null; then
    echo "flask-cors not found. Installing..."
    $PYTHON_CMD -m pip install flask-cors
fi

# Start the server
HOST="${HOST:-127.0.0.1}"

# Accept port as first positional argument, or use PORT env var, or default to 5000
if [ -n "$1" ] && [[ "$1" =~ ^[0-9]+$ ]]; then
    PORT="$1"
    shift
else
    PORT="${PORT:-5000}"
fi

echo ""
echo "Starting Training Script Runner..."
echo "Requested: http://${HOST}:${PORT}"
echo "Note: If port is in use, the server will auto-find an available port."
echo ""

$PYTHON_CMD server.py --host "$HOST" --port "$PORT" "$@"
