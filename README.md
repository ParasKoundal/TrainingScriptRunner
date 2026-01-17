# Training Script Runner - Visual Tool


> The Training Script Runner was born out of the pure frustration of manually typing endless hyperparameters and the "fat-fingering" errors that come with it. It was built specifically to solve my own workflow headaches (like hunting through bash history or repeatedly activating environments), so the current setup is optimized for my personal research habits. However, it is designed to be a flexible foundation; feel free to fork it and modify the logic or UI to better suit your own specific use case and system requirements.

A self-contained localhost-based tool to run training scripts via a clickable interface with byobu terminal support.

![UI Screenshot](UI_Example.png)

## Features

- 🎯 **Auto-parses argparse arguments** from any Python training script
- 🖱️ **Clickable form interface** - no more typing long commands
- 🖥️ **Byobu integration** - runs commands in byobu terminal sessions
- ⚙️ **Environment activation** - automatically activates conda/venv environments
- 💬 **Comments** - add notes to your runs
- 👁️ **Command preview** - see the exact command before running
- 📝 **Command logging** - all executed commands are logged with timestamps and metadata
- 🔄 **Adaptable** - works with any Python script using argparse

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Make the server executable:
```bash
chmod +x server.py
```

## Usage

### Quick Start (Recommended)

Use the bundled startup script which auto-detects Python and installs dependencies:

```bash
./start.sh
```

The script will:
- Auto-detect `python3` or `python` command
- Check and install missing dependencies
- Auto-find an available port if 5000 is in use
- Display the server URL

### Custom Configuration

**With environment variables:**
```bash
HOST=0.0.0.0 PORT=8080 ./start.sh
```

**Or run server directly:**
```bash
python3 server.py --host 127.0.0.1 --port 5000
```

**Port Auto-Detection:**
If the requested port is in use, the server automatically finds the next available port (checks up to 10 ports) and displays the actual URL to use.

### Access the UI

Open your IDE-integrated/browser and navigate to the URL shown in the terminal (typically `http://localhost:5000` or the auto-selected port).

3. Configure your environment:
   - Enter the path to your environment activation script (e.g., `/path/to/activate.sh`) or conda environment command (e.g., `conda activate myenv`)
   - Set the byobu session name (default: `training`)
   - Click "Save Configuration"

4. Select your script:
   - Enter the path to your training script
   - Click "Parse Script" to automatically extract all argparse arguments

5. Fill in the arguments:
   - The form will automatically generate input fields based on the script's argparse configuration
   - Required arguments are marked with a red badge
   - Default values are pre-filled

6. Add a comment (optional):
   - Add a note to describe this run

7. Review and run:
   - Check the command preview
   - Click "Run in Byobu" to execute

## Project Structure

```
vizTool/
├── server.py              # Flask backend server
├── start.sh               # Startup script
├── requirements.txt       # Python dependencies
├── templates/             # HTML templates
│   └── index.html        # Main UI
├── static/               # CSS and JavaScript
│   ├── style.css         # Minimal UI styles
│   └── script.js         # Frontend logic
└── data/                 # User data (auto-created, gitignored)
    ├── config.json       # Global configuration
    ├── configs/          # Saved configuration presets
    ├── arg_presets/      # Saved argument presets
    ├── history/          # Command history and favorites
    └── logs/             # Command execution logs
```

## Configuration

All user data is stored in the `data/` directory which is automatically created on first run:

- **config.json** - Global application settings (environment, session name, log directory)
- **configs/** - Named configuration presets
- **arg_presets/** - Saved argument sets for scripts
- **history/** - Command history and file browser favorites
- **logs/** - Timestamped command execution logs

The `data/` directory is excluded from version control (.gitignored) as it contains user-specific data.

## How It Works

1. **Argument Parsing**: The tool analyzes your Python script's source code to extract all `argparse.ArgumentParser.add_argument()` calls
2. **Form Generation**: It automatically creates appropriate form fields (text inputs, checkboxes, dropdowns) based on argument types
3. **Command Building**: Constructs the full command with all arguments
4. **Byobu Execution**: Sends the command to a byobu session (creates one if it doesn't exist)

## Notes

- The tool creates/uses a byobu session named "training" by default
- Commands are executed in the background in byobu
- You can attach to the byobu session to see the output: `byobu attach -t training`
- The tool handles environment activation automatically if configured
- All commands are automatically logged to `data/logs/command_log.txt` with:
  - Timestamp
  - Script path
  - Comment (if provided)
  - Environment activation script
  - Byobu session name
  - All arguments
  - Full command

## Troubleshooting

- **Script not parsing**: Make sure your script uses `argparse.ArgumentParser` and the parser variable is named `parser`
- **Byobu not found**: Install byobu: `sudo apt-get install byobu` (or equivalent)
- **Command not running**: Check that the script path is correct and accessible
