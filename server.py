#!/usr/bin/env python3
"""
Training Script Runner - Web Interface Server
A self-contained tool to run training scripts via a web interface with byobu terminal support.
"""

import os
import sys
import ast
import re
import subprocess
import json
import argparse
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS
import threading
import time
from datetime import datetime
import errno

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# Global configuration - Organized data directory structure
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
CONFIG_FILE = os.path.join(DATA_DIR, 'config.json')
CONFIGS_DIR = os.path.join(DATA_DIR, 'configs')
ARGS_PRESETS_DIR = os.path.join(DATA_DIR, 'arg_presets')
HISTORY_DIR = os.path.join(DATA_DIR, 'history')
HISTORY_FILE = os.path.join(HISTORY_DIR, 'command_history.json')
DEFAULT_ENV_SCRIPT = None  # Will be set from config
# Default to a 'logs' folder relative to the data directory (self-contained)
DEFAULT_LOG_DIR = os.path.join(DATA_DIR, 'logs')
LOG_DIR = None  # Will be set from config or use default when needed
LOG_FILE = None

# Ensure directories exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(CONFIGS_DIR, exist_ok=True)
os.makedirs(ARGS_PRESETS_DIR, exist_ok=True)
os.makedirs(HISTORY_DIR, exist_ok=True)
os.makedirs(DEFAULT_LOG_DIR, exist_ok=True)

def load_config():
    """Load configuration from JSON file."""
    global DEFAULT_ENV_SCRIPT, LOG_DIR, LOG_FILE
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
            DEFAULT_ENV_SCRIPT = config.get('pre_command', None)
            # Only set LOG_DIR if explicitly configured, otherwise leave as None
            log_dir = config.get('log_dir')
            if log_dir:
                LOG_DIR = log_dir
                LOG_FILE = os.path.join(LOG_DIR, 'command_log.txt')
            else:
                LOG_DIR = None
                LOG_FILE = None
            return config
    return {'pre_command': None, 'log_dir': None, 'default_script_path': None}

def save_config(config):
    """Save configuration to JSON file."""
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)

def log_command(script_path, args_dict, pre_command, comment, session_name, command, log_dir=None):
    """
    Log the executed command to a file with timestamp and metadata.
    If log_dir is None, logging is disabled.
    """
    if log_dir is None:
        return  # Logging disabled
    
    try:
        # Use provided log_dir or default
        log_directory = log_dir if log_dir else LOG_DIR
        log_file_path = os.path.join(log_directory, 'command_log.txt')
        
        # Ensure log directory exists
        os.makedirs(log_directory, exist_ok=True)
        
        # Get current timestamp
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # Build log entry
        log_entry = []
        log_entry.append("=" * 80)
        log_entry.append(f"Timestamp: {timestamp}")
        log_entry.append(f"Script: {script_path}")
        if comment:
            log_entry.append(f"Comment: {comment}")
        if pre_command:
            log_entry.append(f"Pre-command: {pre_command}")
        log_entry.append(f"Byobu Session: {session_name}")
        log_entry.append("-" * 80)
        log_entry.append("Arguments:")
        for key, value in sorted(args_dict.items()):
            log_entry.append(f"  --{key}: {value}")
        log_entry.append("-" * 80)
        log_entry.append("Full Command:")
        log_entry.append(command)
        log_entry.append("=" * 80)
        log_entry.append("")  # Empty line for readability
        
        # Append to log file
        with open(log_file_path, 'a', encoding='utf-8') as f:
            f.write('\n'.join(log_entry))
            f.write('\n')
    except Exception as e:
        # Don't fail the command execution if logging fails
        print(f"Warning: Failed to log command: {e}", file=sys.stderr)

def parse_argparse_from_file(script_path):
    """
    Parse argparse arguments from a Python script by analyzing the source code.
    Returns a list of argument definitions.
    """
    try:
        if not os.path.exists(script_path):
            raise FileNotFoundError(f"Script not found: {script_path}")
        
        with open(script_path, 'r') as f:
            content = f.read()
        
        # Find the ArgumentParser instantiation (more flexible pattern)
        # This handles: parser = argparse.ArgumentParser(...) or any_var = argparse.ArgumentParser(...)
        parser_pattern = r'\w+\s*=\s*argparse\.ArgumentParser\([^)]*\)'
        if not re.search(parser_pattern, content):
            # Try alternative patterns
            if 'ArgumentParser' not in content:
                raise ValueError("No ArgumentParser found in script. Make sure your script uses argparse.")
            # Maybe parser is created differently, try to find add_argument calls anyway
        
        # Extract all add_argument calls
        args = []
        # Pattern to match add_argument calls (handles multi-line and different variable names)
        # First, try to find the parser variable name
        parser_var_match = re.search(r'(\w+)\s*=\s*argparse\.ArgumentParser', content)
        parser_var = parser_var_match.group(1) if parser_var_match else 'parser'
        
        # Pattern to match add_argument calls with the found variable name
        pattern = rf'{re.escape(parser_var)}\.add_argument\s*\((.*?)\)'
        
        for match in re.finditer(pattern, content, re.DOTALL):
            arg_str = match.group(1)
            arg_dict = {}
            
            # Parse the argument string
            # Handle both '--arg' and '-short' formats
            # Allow hyphens in argument names (e.g., --log-level, --learning-rate)
            name_match = re.search(r"['\"](--?[\w-]+)[\"']", arg_str)
            if name_match:
                arg_dict['name'] = name_match.group(1)
            
            # Check for short form
            short_match = re.search(r"['\"](-[a-zA-Z]+)[\"']", arg_str)
            if short_match and short_match.group(1) != arg_dict.get('name', ''):
                arg_dict['short'] = short_match.group(1)
            
            # Check for action='store_true' or 'store_false' first (these are boolean flags)
            action_match = re.search(r"action\s*=\s*['\"]store_(true|false)['\"]", arg_str)
            if action_match:
                arg_dict['type'] = 'bool'
                arg_dict['action'] = action_match.group(1)  # 'true' or 'false'
                # Set default based on action: store_true defaults to False, store_false defaults to True
                if action_match.group(1) == 'true':
                    arg_dict['default'] = False
                else:  # store_false
                    arg_dict['default'] = True
            else:
                # Extract type
                type_match = re.search(r'type\s*=\s*(\w+)', arg_str)
                if type_match:
                    arg_type = type_match.group(1)
                    # Handle bool type (argparse treats type=bool as string conversion, but we want checkbox)
                    if arg_type == 'bool':
                        arg_dict['type'] = 'bool'
                    else:
                        arg_dict['type'] = arg_type
                else:
                    arg_dict['type'] = 'str'  # default
            
            # Extract help
            help_match = re.search(r"help\s*=\s*['\"]([^'\"]+)['\"]", arg_str)
            if help_match:
                arg_dict['help'] = help_match.group(1)
            
            # Extract default
            default_match = re.search(r'default\s*=\s*([^,)]+)', arg_str)
            if default_match:
                default_val = default_match.group(1).strip()
                # Try to evaluate the default value
                try:
                    if default_val.startswith("'") or default_val.startswith('"'):
                        arg_dict['default'] = default_val.strip("'\"")
                    elif default_val.lower() in ['true', 'false']:
                        arg_dict['default'] = default_val.lower() == 'true'
                    elif default_val.replace('.', '').replace('-', '').isdigit():
                        if '.' in default_val:
                            arg_dict['default'] = float(default_val)
                        else:
                            arg_dict['default'] = int(default_val)
                    else:
                        arg_dict['default'] = default_val
                except:
                    arg_dict['default'] = default_val
            
            # Check if required
            required_match = re.search(r'required\s*=\s*(True|False)', arg_str)
            if required_match:
                arg_dict['required'] = required_match.group(1) == 'True'
            else:
                arg_dict['required'] = False
            
            # Extract choices
            choices_match = re.search(r'choices\s*=\s*\[(.*?)\]', arg_str)
            if choices_match:
                choices_str = choices_match.group(1)
                # Parse choices (simple string list)
                choices = [c.strip().strip("'\"") for c in choices_str.split(',')]
                arg_dict['choices'] = choices
            
            # Extract nargs (for handling multiple values)
            nargs_match = re.search(r"nargs\s*=\s*['\"]?([+*?]|\d+)['\"]?", arg_str)
            if nargs_match:
                nargs_val = nargs_match.group(1)
                arg_dict['nargs'] = nargs_val
                # For nargs='+' or '*', we might want to handle it as a list
                if nargs_val in ['+', '*']:
                    arg_dict['multiple'] = True
            
            args.append(arg_dict)
        
        return args
    except FileNotFoundError as e:
        raise e
    except Exception as e:
        raise ValueError(f"Error parsing argparse from script: {str(e)}")

def build_command(script_path, args_dict, pre_command=None, comment=""):
    """
    Build the command to execute in byobu.
    """
    # Start with pre-command if provided (can be any command)
    cmd_parts = []
    
    if pre_command:
        pre_command = pre_command.strip()
        if pre_command:
            # Handle multiline commands - split by newlines and join with &&
            # This allows users to run multiple commands sequentially
            pre_cmd_lines = [line.strip() for line in pre_command.split('\n') if line.strip()]
            if pre_cmd_lines:
                # Join multiple lines with && so they execute sequentially
                pre_cmd_combined = ' && '.join(pre_cmd_lines)
                cmd_parts.append(pre_cmd_combined)
                cmd_parts.append("&&")
    
    # Build Python command with arguments
    python_cmd = f"python {script_path}"
    
    for key, value in args_dict.items():
        if value is not None and value != "":
            # Handle boolean values
            # The frontend sends True for boolean flags that should be included
            # For store_true: include --flag if value is True
            # For store_false: include --flag if value is True (to disable, making it False)
            # For regular bool: include --flag True/False
            if isinstance(value, bool):
                python_cmd += f" --{key}"
            # Handle string values with spaces (quote them)
            elif isinstance(value, str) and ' ' in value:
                python_cmd += f" --{key} '{value}'"
            else:
                python_cmd += f" --{key} {value}"
    
    cmd_parts.append(python_cmd)
    
    # Add comment if provided
    if comment:
        full_cmd = " ".join(cmd_parts)
        return f"# {comment}\n{full_cmd}"
    
    return " ".join(cmd_parts)

def execute_in_byobu(command, session_name="training"):
    """
    Execute a command in a byobu terminal session.
    Always opens a new window in the current/existing session.
    """
    try:
        # Create a script file that will be executed in byobu
        script_file = os.path.join(os.path.dirname(__file__), 'temp_byobu_script.sh')
        with open(script_file, 'w') as f:
            f.write("#!/bin/bash\n")
            f.write("set -e\n")  # Exit on error
            f.write("clear\n")  # Clear the terminal screen for a fresh start
            f.write(command)
            f.write("\n")
        
        os.chmod(script_file, 0o755)
        
        # Check if byobu session exists
        check_session = subprocess.run(
            ['byobu', 'list-sessions'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        # Quote the script file path to handle spaces/special characters
        script_file_quoted = f"'{script_file}'"
        
        # Try to find an existing session (prefer the specified one, or any existing)
        session_exists = False
        target_session = session_name
        
        if check_session.returncode == 0 and check_session.stdout.strip():
            # Check if specified session exists
            if session_name in check_session.stdout:
                session_exists = True
                target_session = session_name
            else:
                # Try to find any existing session (use the first one)
                lines = [line.strip() for line in check_session.stdout.strip().split('\n') if line.strip()]
                if lines:
                    # Parse session name from byobu list-sessions output (format: "session_name: 1 windows")
                    for line in lines:
                        if ':' in line:
                            existing_session = line.split(':')[0].strip()
                            if existing_session:
                                session_exists = True
                                target_session = existing_session
                                break
        
        if session_exists:
            # Use a unique window name based on timestamp to avoid conflicts
            window_name = f"run_{int(time.time() * 1000)}"  # Use milliseconds for better uniqueness
            
            # Create a new window in the existing session
            # Retry logic in case of index conflicts
            max_retries = 5
            message = None
            for attempt in range(max_retries):
                # Use -a flag to append window at the end and -k to kill if name exists
                # This helps avoid index conflicts by appending and cleaning up duplicates
                result = subprocess.run(
                    ['byobu', 'new-window', '-ak', '-t', target_session, '-n', window_name, 'bash', '-c', f'bash {script_file_quoted}; exec bash'],
                    cwd=os.path.expanduser('~'),
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                
                # Check if window creation was successful
                if result.returncode == 0:
                    # Refresh the byobu client to ensure the window is visible
                    subprocess.run(
                        ['byobu', 'refresh-client', '-t', target_session],
                        capture_output=True,
                        timeout=2
                    )  # Ignore errors - refresh is optional
                    message = f'Command started in new window "{window_name}" of byobu session "{target_session}"'
                    break
                else:
                    # Check if error is about index in use
                    error_msg = result.stderr.lower() if result.stderr else ""
                    if "index" in error_msg and "in use" in error_msg:
                        # Wait longer between retries to let byobu process
                        if attempt < max_retries - 1:
                            # Exponential backoff: 0.5s, 1.0s, 1.5s, 2.0s
                            time.sleep(0.5 * (attempt + 1))
                            # Generate new unique name for next attempt
                            window_name = f"run_{int(time.time() * 1000)}_{attempt + 1}"
                            continue
                        else:
                            # Last attempt failed, return error
                            return {'success': False, 'message': f'Failed to create window after {max_retries} attempts: {result.stderr}'}
                    else:
                        # Different error, return immediately
                        return {'success': False, 'message': f'Error creating window: {result.stderr}'}
            
            # If we get here and message is None, all retries failed
            if message is None:
                return {'success': False, 'message': f'Failed to create window after {max_retries} attempts'}
        else:
            # No existing session found, create new one
            subprocess.Popen(
                ['byobu', 'new-session', '-d', '-s', target_session, 'bash', '-c', f'bash {script_file_quoted}; exec bash'],
                cwd=os.path.expanduser('~')
            )
            message = f'Created new byobu session "{target_session}" and started command'
        
        return {'success': True, 'message': message}
    except subprocess.TimeoutExpired:
        return {'success': False, 'message': 'Timeout while executing byobu command'}
    except FileNotFoundError:
        return {'success': False, 'message': 'byobu not found. Please install byobu: sudo apt-get install byobu'}
    except Exception as e:
        return {'success': False, 'message': f'Error executing in byobu: {str(e)}'}

@app.route('/')
def index():
    """Serve the main page."""
    return render_template('index.html')

# File browser favorites storage
FAVORITES_FILE = os.path.join(HISTORY_DIR, 'favorites.json')

def load_favorites():
    """Load favorites from JSON file."""
    if os.path.exists(FAVORITES_FILE):
        try:
            with open(FAVORITES_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return {'paths': [], 'recent': []}

def save_favorites(favorites):
    """Save favorites to JSON file."""
    with open(FAVORITES_FILE, 'w') as f:
        json.dump(favorites, f, indent=2)

def add_to_recent(path, max_recent=10):
    """Add a path to recent history."""
    favorites = load_favorites()
    recent = favorites.get('recent', [])
    # Remove if already exists
    if path in recent:
        recent.remove(path)
    # Add to front
    recent.insert(0, path)
    # Keep only max_recent items
    favorites['recent'] = recent[:max_recent]
    save_favorites(favorites)

@app.route('/api/browse', methods=['GET'])
def browse_directory():
    """Browse filesystem directories and list Python files."""
    path = request.args.get('path', '')
    file_filter = request.args.get('filter', '.py')
    show_hidden = request.args.get('show_hidden', 'false').lower() == 'true'
    
    # Default to home directory if no path specified
    if not path:
        path = os.path.expanduser('~')
    else:
        path = os.path.expanduser(path)
        path = os.path.abspath(path)
    
    # Validate path exists
    if not os.path.exists(path):
        return jsonify({'error': f'Path does not exist: {path}'}), 400
    
    # If path is a file, use its parent directory
    if os.path.isfile(path):
        path = os.path.dirname(path)
    
    try:
        entries = os.listdir(path)
    except PermissionError:
        return jsonify({'error': f'Permission denied: {path}'}), 403
    except Exception as e:
        return jsonify({'error': str(e)}), 400
    
    directories = []
    files = []
    
    for entry in entries:
        # Skip hidden files unless requested
        if not show_hidden and entry.startswith('.'):
            continue
        
        full_path = os.path.join(path, entry)
        
        try:
            if os.path.isdir(full_path):
                directories.append({
                    'name': entry,
                    'path': full_path,
                    'type': 'directory'
                })
            elif os.path.isfile(full_path):
                # Apply file filter
                if file_filter:
                    if not entry.endswith(file_filter):
                        continue
                files.append({
                    'name': entry,
                    'path': full_path,
                    'type': 'file',
                    'size': os.path.getsize(full_path)
                })
        except (PermissionError, OSError):
            # Skip files we can't access
            continue
    
    # Sort alphabetically (case-insensitive)
    directories.sort(key=lambda x: x['name'].lower())
    files.sort(key=lambda x: x['name'].lower())
    
    # Build breadcrumb path segments
    path_parts = path.split(os.sep)
    breadcrumbs = []
    current_path = ''
    for i, part in enumerate(path_parts):
        if part:
            current_path = os.sep.join(path_parts[:i+1])
            if not current_path:
                current_path = os.sep
            breadcrumbs.append({
                'name': part if part else os.sep,
                'path': current_path if current_path else os.sep
            })
    
    # Add root if path starts with /
    if path.startswith(os.sep) and (not breadcrumbs or breadcrumbs[0]['path'] != os.sep):
        breadcrumbs.insert(0, {'name': os.sep, 'path': os.sep})
    
    # Track this as a recent path
    add_to_recent(path)
    
    return jsonify({
        'current_path': path,
        'parent_path': os.path.dirname(path) if path != os.sep else None,
        'breadcrumbs': breadcrumbs,
        'directories': directories,
        'files': files,
        'total_directories': len(directories),
        'total_files': len(files)
    })

@app.route('/api/favorites', methods=['GET', 'POST', 'DELETE'])
def manage_favorites():
    """Manage favorite/pinned paths."""
    if request.method == 'GET':
        favorites = load_favorites()
        return jsonify(favorites)
    
    elif request.method == 'POST':
        data = request.json
        path = data.get('path', '').strip()
        
        if not path:
            return jsonify({'error': 'Path is required'}), 400
        
        # Expand and validate path
        path = os.path.expanduser(path)
        path = os.path.abspath(path)
        
        if not os.path.exists(path):
            return jsonify({'error': f'Path does not exist: {path}'}), 400
        
        favorites = load_favorites()
        paths = favorites.get('paths', [])
        
        if path not in paths:
            paths.append(path)
            favorites['paths'] = paths
            save_favorites(favorites)
        
        return jsonify({'success': True, 'path': path})
    
    else:  # DELETE
        path = request.args.get('path', '').strip()
        
        if not path:
            return jsonify({'error': 'Path is required'}), 400
        
        # Expand path for comparison
        path = os.path.expanduser(path)
        path = os.path.abspath(path)
        
        favorites = load_favorites()
        paths = favorites.get('paths', [])
        
        if path in paths:
            paths.remove(path)
            favorites['paths'] = paths
            save_favorites(favorites)
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Path not in favorites'}), 404

@app.route('/api/parse-script', methods=['POST'])
def parse_script():
    """Parse argparse arguments from a Python script."""
    data = request.json
    script_path = data.get('script_path')
    
    if not script_path:
        return jsonify({'error': 'Script path is required'}), 400
    
    # Expand user path and make absolute
    script_path = os.path.expanduser(script_path)
    script_path = os.path.abspath(script_path)
    
    if not os.path.exists(script_path):
        return jsonify({'error': f'Script not found: {script_path}'}), 400
    
    if not script_path.endswith('.py'):
        return jsonify({'error': 'File must be a Python script (.py)'}), 400
    
    try:
        args = parse_argparse_from_file(script_path)
        return jsonify({'args': args, 'script_path': script_path})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/run-command', methods=['POST'])
def run_command():
    """Execute a command in byobu."""
    data = request.json
    script_path = data.get('script_path')
    args_dict = data.get('args', {})
    pre_command = data.get('pre_command', DEFAULT_ENV_SCRIPT)
    comment = data.get('comment', '')
    session_name = data.get('session_name', 'training')
    log_dir = data.get('log_dir')
    save_logs = data.get('save_logs', False)
    
    if not script_path:
        return jsonify({'error': 'Script path required'}), 400
    
    # Determine log directory: use provided, or default if save_logs is True but no dir given
    if save_logs:
        if log_dir:
            final_log_dir = log_dir
        else:
            # Use default logs directory when logging is enabled but no directory specified
            final_log_dir = DEFAULT_LOG_DIR
    else:
        final_log_dir = None
    
    command = build_command(script_path, args_dict, pre_command, comment)
    
    # Log the command before executing
    log_command(script_path, args_dict, pre_command, comment, session_name, command, final_log_dir)
    
    # Save to history
    try:
        history_entry = {
            'script_path': script_path,
            'args': args_dict,
            'pre_command': pre_command,
            'comment': comment,
            'session_name': session_name,
            'timestamp': datetime.now().isoformat(),
            'command': command
        }
        
        history = []
        if os.path.exists(HISTORY_FILE):
            try:
                with open(HISTORY_FILE, 'r') as f:
                    history = json.load(f)
            except:
                pass
        
        history.insert(0, history_entry)
        # Keep only last 50 entries
        history = history[:50]
        
        with open(HISTORY_FILE, 'w') as f:
            json.dump(history, f, indent=2)
    except Exception as e:
        # Don't fail if history saving fails
        print(f"Warning: Failed to save history: {e}", file=sys.stderr)
    
    result = execute_in_byobu(command, session_name)
    
    return jsonify(result)

@app.route('/api/config', methods=['GET', 'POST'])
def config():
    """Get or update configuration."""
    if request.method == 'GET':
        config = load_config()
        config['default_log_dir'] = DEFAULT_LOG_DIR
        return jsonify(config)
    else:
        config = request.json
        save_config(config)
        global DEFAULT_ENV_SCRIPT, LOG_DIR, LOG_FILE
        DEFAULT_ENV_SCRIPT = config.get('pre_command', None)
        # Only set LOG_DIR if explicitly configured
        log_dir = config.get('log_dir')
        if log_dir:
            LOG_DIR = log_dir
            LOG_FILE = os.path.join(LOG_DIR, 'command_log.txt')
        else:
            LOG_DIR = None
            LOG_FILE = None
        return jsonify({'success': True})

@app.route('/api/configs', methods=['GET', 'POST', 'DELETE'])
def configs():
    """Manage named configurations."""
    if request.method == 'GET':
        # List all saved configs
        configs_list = []
        if os.path.exists(CONFIGS_DIR):
            for filename in os.listdir(CONFIGS_DIR):
                if filename.endswith('.json'):
                    config_name = filename[:-5]  # Remove .json extension
                    config_path = os.path.join(CONFIGS_DIR, filename)
                    try:
                        with open(config_path, 'r') as f:
                            config_data = json.load(f)
                            configs_list.append({
                                'name': config_name,
                                'pre_command': config_data.get('pre_command'),
                                'byobu_session': config_data.get('byobu_session'),
                                'log_dir': config_data.get('log_dir')
                            })
                    except:
                        pass
        return jsonify({'configs': configs_list})
    
    elif request.method == 'POST':
        # Save a named config
        data = request.json
        config_name = data.get('name', '').strip()
        if not config_name:
            return jsonify({'error': 'Config name is required'}), 400
        
        # Sanitize filename
        safe_name = "".join(c for c in config_name if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_name = safe_name.replace(' ', '_')
        if not safe_name:
            return jsonify({'error': 'Invalid config name'}), 400
        
        config_data = {
            'pre_command': data.get('pre_command'),
            'byobu_session': data.get('byobu_session', 'training'),
            'log_dir': data.get('log_dir')
        }
        
        config_path = os.path.join(CONFIGS_DIR, f'{safe_name}.json')
        with open(config_path, 'w') as f:
            json.dump(config_data, f, indent=2)
        
        return jsonify({'success': True, 'name': safe_name})
    
    else:  # DELETE
        config_name = request.args.get('name', '').strip()
        if not config_name:
            return jsonify({'error': 'Config name is required'}), 400
        
        # Sanitize filename
        safe_name = "".join(c for c in config_name if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_name = safe_name.replace(' ', '_')
        
        config_path = os.path.join(CONFIGS_DIR, f'{safe_name}.json')
        if os.path.exists(config_path):
            os.remove(config_path)
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Config not found'}), 404

@app.route('/api/configs/<config_name>', methods=['GET'])
def get_config(config_name):
    """Get a specific named configuration."""
    safe_name = "".join(c for c in config_name if c.isalnum() or c in (' ', '-', '_')).strip()
    safe_name = safe_name.replace(' ', '_')
    config_path = os.path.join(CONFIGS_DIR, f'{safe_name}.json')
    
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            config_data = json.load(f)
        return jsonify(config_data)
    else:
        return jsonify({'error': 'Config not found'}), 404

@app.route('/api/presets/args', methods=['GET', 'POST'])
def arg_presets():
    """Manage argument presets."""
    if request.method == 'GET':
        # List all argument presets
        presets_list = []
        if os.path.exists(ARGS_PRESETS_DIR):
            for filename in os.listdir(ARGS_PRESETS_DIR):
                if filename.endswith('.json'):
                    preset_name = filename[:-5]
                    preset_path = os.path.join(ARGS_PRESETS_DIR, filename)
                    try:
                        with open(preset_path, 'r') as f:
                            preset_data = json.load(f)
                            presets_list.append({
                                'name': preset_name,
                                'script_path': preset_data.get('script_path'),
                                'created': preset_data.get('created')
                            })
                    except:
                        pass
        return jsonify({'presets': presets_list})
    
    else:  # POST
        # Save an argument preset
        data = request.json
        preset_name = data.get('name', '').strip()
        if not preset_name:
            return jsonify({'error': 'Preset name is required'}), 400
        
        # Sanitize filename
        safe_name = "".join(c for c in preset_name if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_name = safe_name.replace(' ', '_')
        if not safe_name:
            return jsonify({'error': 'Invalid preset name'}), 400
        
        preset_data = {
            'name': preset_name,
            'script_path': data.get('script_path'),
            'args': data.get('args', {}),
            'created': datetime.now().isoformat()
        }
        
        preset_path = os.path.join(ARGS_PRESETS_DIR, f'{safe_name}.json')
        with open(preset_path, 'w') as f:
            json.dump(preset_data, f, indent=2)
        
        return jsonify({'success': True, 'name': safe_name})

@app.route('/api/presets/args/<preset_name>', methods=['GET'])
def get_arg_preset(preset_name):
    """Get a specific argument preset."""
    safe_name = "".join(c for c in preset_name if c.isalnum() or c in (' ', '-', '_')).strip()
    safe_name = safe_name.replace(' ', '_')
    preset_path = os.path.join(ARGS_PRESETS_DIR, f'{safe_name}.json')
    
    if os.path.exists(preset_path):
        with open(preset_path, 'r') as f:
            preset_data = json.load(f)
        return jsonify(preset_data)
    else:
        return jsonify({'error': 'Preset not found'}), 404

@app.route('/api/history', methods=['GET'])
def get_history():
    """Get command history."""
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r') as f:
                history = json.load(f)
            # Return last 50 entries
            return jsonify({'history': history[:50]})
        except:
            return jsonify({'history': []})
    return jsonify({'history': []})

@app.route('/api/validate', methods=['POST'])
def validate():
    """Validate a command before execution."""
    data = request.json
    script_path = data.get('script_path')
    args_dict = data.get('args', {})
    
    if not script_path:
        return jsonify({'valid': False, 'error': 'Script path required'}), 400
    
    # Try to parse the script to get required arguments
    try:
        args = parse_argparse_from_file(script_path)
        missing_required = [arg for arg in args if arg.get('required') and not args_dict.get(arg['name'].replace('--', ''))]
        
        if missing_required:
            missing = [arg['name'] for arg in missing_required]
            return jsonify({
                'valid': False,
                'error': f"Missing required arguments: {', '.join(missing)}",
                'missing': missing
            })
        
        return jsonify({'valid': True})
    except Exception as e:
        return jsonify({'valid': False, 'error': str(e)}), 400

def find_available_port(start_port=5000, max_attempts=10):
    """
    Find an available port starting from start_port.
    Returns the first available port found.
    """
    import socket

    for port in range(start_port, start_port + max_attempts):
        try:
            # Try to bind to the port to check if it's available
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('', port))
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                return port
        except OSError:
            continue

    # If no port found in range, return None
    return None

def start_server_with_retry(host, port, debug, max_attempts=10):
    """
    Start the Flask server, automatically finding an available port if needed.
    """
    # First, try to find an available port
    available_port = find_available_port(port, max_attempts)

    if available_port is None:
        raise RuntimeError(f"Unable to find an available port in range {port}-{port + max_attempts - 1}")

    if available_port != port:
        print(f"Port {port} is in use. Using available port {available_port} instead.")

    print(f"\n{'='*60}")
    print(f"🚀 Training Script Runner")
    print(f"{'='*60}")
    print(f"Server URL: http://{host}:{available_port}")
    print(f"{'='*60}\n")
    print(f"Open the URL above in your browser to use the tool.")
    print(f"Press Ctrl+C to stop the server.\n")

    try:
        app.run(host=host, port=available_port, debug=debug)
    except KeyboardInterrupt:
        print("\n\nServer stopped by user.")
    except Exception as e:
        print(f"\n\nError starting server: {e}")
        raise

if __name__ == '__main__':
    # Load config on startup
    load_config()
    
    # Parse command line arguments for the server
    parser = argparse.ArgumentParser(description='Training Script Runner Web Server')
    parser.add_argument('--host', default='127.0.0.1', help='Host to bind to')
    parser.add_argument('--port', type=int, default=5000, help='Port to bind to')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    args = parser.parse_args()

    # Suppress Flask development server warning for this development tool
    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)

    try:
        start_server_with_retry(args.host, args.port, args.debug)
    except Exception as e:
        print(f"Failed to start the server: {e}", file=sys.stderr)
        sys.exit(1)
