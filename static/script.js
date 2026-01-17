// Training Script Runner - Enhanced Frontend JavaScript

// Global State
let currentArgs = [];
let currentScriptPath = '';
let commandHistory = [];
let sectionStates = {};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

// Initialize Application
function initializeApp() {
    // Load saved state
    loadConfig();
    loadPresetsList();
    loadArgumentPresets();
    loadCommandHistory();

    // Set up event listeners
    setupEventListeners();

    // Initialize mini tabs (Preview/History)
    initializeMiniTabs();

    // Initialize config expand button
    initializeConfigExpand();

    // Initialize dark mode
    initializeDarkMode();

    // Set up keyboard shortcuts
    setupKeyboardShortcuts();

    // Set up auto-update preview
    setupAutoPreview();
}

// Mini Tab Functions (for Preview/History panel)
function initializeMiniTabs() {
    document.querySelectorAll('.tab-mini-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;

            // Remove active from all
            document.querySelectorAll('.tab-mini-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-mini-content').forEach(c => c.classList.remove('active'));

            // Add active to clicked
            btn.classList.add('active');
            const content = document.getElementById(`${tabId}-content`);
            if (content) content.classList.add('active');
        });
    });
}

// Config Expand
function initializeConfigExpand() {
    const expandBtn = document.getElementById('config-expand');
    const expandedSection = document.getElementById('config-expanded');

    if (expandBtn && expandedSection) {
        expandBtn.addEventListener('click', () => {
            const isHidden = expandedSection.style.display === 'none';
            expandedSection.style.display = isHidden ? 'block' : 'none';
        });
    }
}

// Modal helpers
function closeConfigModal() {
    document.getElementById('config-modal').style.display = 'none';
}

// Old tab functions removed - minimal UI uses mini-tabs in panel headers

// Setup Event Listeners
function setupEventListeners() {
    // Main actions
    const parseBtn = document.getElementById('parse-script');
    const runBtn = document.getElementById('run-command');
    if (parseBtn) parseBtn.addEventListener('click', parseScript);
    if (runBtn) runBtn.addEventListener('click', runCommand);

    // File browser
    const browseBtn = document.getElementById('browse-script');
    const parentBtn = document.getElementById('file-browser-parent');
    const homeBtn = document.getElementById('file-browser-home');
    const refreshBtn = document.getElementById('file-browser-refresh');
    const selectBtn = document.getElementById('file-browser-select');
    const favBtn = document.getElementById('add-to-favorites');
    if (browseBtn) browseBtn.addEventListener('click', openFileBrowser);
    if (parentBtn) parentBtn.addEventListener('click', navigateToParent);
    if (homeBtn) homeBtn.addEventListener('click', navigateToHome);
    if (refreshBtn) refreshBtn.addEventListener('click', refreshFileBrowser);
    if (selectBtn) selectBtn.addEventListener('click', selectFileAndClose);
    if (favBtn) favBtn.addEventListener('click', addCurrentPathToFavorites);

    // Preset management
    const savePresetBtn = document.getElementById('save-preset');
    const deletePresetBtn = document.getElementById('delete-preset');
    const presetNameInput = document.getElementById('preset-name');
    const loadPresetSelect = document.getElementById('load-preset');
    if (savePresetBtn) savePresetBtn.addEventListener('click', saveNamedPreset);
    if (deletePresetBtn) deletePresetBtn.addEventListener('click', deleteSelectedPreset);
    if (presetNameInput) presetNameInput.addEventListener('input', updateConfigSectionVisibility);
    if (loadPresetSelect) loadPresetSelect.addEventListener('change', handlePresetLoad);

    // Argument management
    const clearArgsBtn = document.getElementById('clear-all-args');
    const resetBtn = document.getElementById('reset-defaults');
    const fillReqBtn = document.getElementById('fill-required');
    if (clearArgsBtn) clearArgsBtn.addEventListener('click', clearAllArgs);
    if (resetBtn) resetBtn.addEventListener('click', resetToDefaults);
    if (fillReqBtn) fillReqBtn.addEventListener('click', fillRequiredOnly);

    // Argument presets - these don't exist in minimal UI, skip them
    const saveArgPresetBtn = document.getElementById('save-arg-preset');
    const loadArgPresetSelect = document.getElementById('load-arg-preset');
    if (saveArgPresetBtn) saveArgPresetBtn.addEventListener('click', saveArgumentPreset);
    if (loadArgPresetSelect) loadArgPresetSelect.addEventListener('change', loadArgumentPreset);

    // Command preview
    const copyBtn = document.getElementById('copy-command');
    const validateBtn = document.getElementById('validate-command');
    if (copyBtn) copyBtn.addEventListener('click', copyCommandToClipboard);
    if (validateBtn) validateBtn.addEventListener('click', validateCommand);

    // Search
    const searchInput = document.getElementById('args-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(filterArguments, 300));
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                filterArguments();
            }
        });
    }
}

// Initialize Accordions
function initializeAccordions() {
    const sections = document.querySelectorAll('.accordion-section');
    sections.forEach(section => {
        const sectionId = section.dataset.section;
        const isCollapsed = sectionStates[sectionId] === false;
        if (isCollapsed) {
            section.classList.add('collapsed');
        }
    });
}

// Toggle Section
function toggleSection(sectionId) {
    const section = document.querySelector(`[data-section="${sectionId}"]`);
    if (!section) return;

    section.classList.toggle('collapsed');
    const isCollapsed = section.classList.contains('collapsed');
    sectionStates[sectionId] = !isCollapsed;
    saveSectionStates();
}

// Save/Load Section States
function saveSectionStates() {
    localStorage.setItem('sectionStates', JSON.stringify(sectionStates));
}

function loadSectionStates() {
    const saved = localStorage.getItem('sectionStates');
    if (saved) {
        sectionStates = JSON.parse(saved);
    }
}

// Setup Keyboard Shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

        // Ctrl/Cmd + Enter: Run command
        if (ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            const runBtn = document.getElementById('run-command');
            const actionBar = document.getElementById('action-bar');
            if (runBtn && actionBar && actionBar.style.display !== 'none') {
                runCommand();
            }
        }

        // Ctrl/Cmd + K: Focus search
        if (ctrlKey && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.getElementById('args-search');
            if (searchInput && searchInput.offsetParent !== null) {
                searchInput.focus();
            }
        }

        // Esc: Close modals
        if (e.key === 'Escape') {
            closeFileBrowser();
            closeConfigModal();
        }
    });
}

// Help Modal
function toggleHelpModal() {
    const modal = document.getElementById('help-modal');
    modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
}

function closeHelpModal() {
    document.getElementById('help-modal').style.display = 'none';
}

// Initialize Dark Mode
function initializeDarkMode() {
    const darkModeToggle = document.getElementById('dark-mode-toggle');

    if (!darkModeToggle) {
        console.error('Dark mode toggle not found!');
        return;
    }

    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    console.log('Initializing dark mode, saved state:', savedDarkMode);

    if (savedDarkMode) {
        darkModeToggle.checked = true;
        document.body.classList.add('dark-mode');
    }

    darkModeToggle.addEventListener('change', function () {
        console.log('Dark mode toggle changed:', this.checked);
        if (this.checked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('darkMode', 'true');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('darkMode', 'false');
        }
    });
}

// Setup Auto Preview
function setupAutoPreview() {
    document.addEventListener('input', function (e) {
        if (e.target.closest('#args-form') ||
            e.target.id === 'comment' ||
            e.target.id === 'pre-command' ||
            e.target.id === 'script-path') {
            updatePreview();
            validateFields();
        }

        if (e.target.id === 'log-dir') {
            const logDir = e.target.value;
            const logPathDisplay = document.getElementById('log-path-display-removed');
            if (logPathDisplay) {
                if (logDir) {
                    logPathDisplay.textContent = 'command_log.txt in ' + logDir;
                } else {
                    logPathDisplay.textContent = './logs/command_log.txt (default if enabled)';
                }
            }
        }
    });

    document.addEventListener('change', function (e) {
        if (e.target.closest('#args-form') ||
            e.target.id === 'comment' ||
            e.target.id === 'pre-command' ||
            e.target.id === 'script-path') {
            updatePreview();
            validateFields();
        }
    });
}

// Config Management
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();

        if (config.pre_command) {
            document.getElementById('pre-command').value = config.pre_command;
        }
        if (config.byobu_session) {
            document.getElementById('byobu-session').value = config.byobu_session;
        }
        if (config.log_dir) {
            document.getElementById('log-dir').value = config.log_dir;
            const logPathDisplay = document.getElementById('log-path-display-removed');
            if (logPathDisplay) {
                logPathDisplay.textContent = config.log_dir + '/command_log.txt';
            }
        } else {
            const logPathDisplay = document.getElementById('log-path-display-removed');
            if (logPathDisplay) {
                logPathDisplay.textContent = './logs/command_log.txt (default if enabled)';
            }
        }
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

function updateConfigSectionVisibility() {
    const presetName = document.getElementById('preset-name').value.trim();
    const loadPreset = document.getElementById('load-preset').value;
    const expandedSection = document.getElementById('config-expanded');

    // Auto-expand config when typing a new preset name
    if (presetName && !loadPreset) {
        if (expandedSection) {
            expandedSection.style.display = 'block';
        }
        // Clear fields for new preset
        document.getElementById('pre-command').value = '';
        document.getElementById('log-dir').value = '';
    }
}

// Preset Management
async function loadPresetsList() {
    try {
        const response = await fetch('/api/configs');
        const data = await response.json();
        const select = document.getElementById('load-preset');

        if (!select) {
            console.error('Load preset select element not found!');
            return;
        }

        select.innerHTML = '<option value="">-- Select a saved preset --</option>';

        console.log('Loaded presets:', data.configs);

        if (data.configs && data.configs.length > 0) {
            data.configs.forEach(config => {
                const option = document.createElement('option');
                option.value = config.name;
                option.textContent = config.name;
                select.appendChild(option);
            });
            console.log(`Added ${data.configs.length} presets to dropdown`);
        } else {
            console.log('No presets found');
        }
    } catch (error) {
        console.error('Error loading presets list:', error);
    }
}

function handlePresetLoad() {
    const hasSelection = this.value !== '';
    const expandedSection = document.getElementById('config-expanded');

    document.getElementById('delete-preset').style.display = hasSelection ? 'block' : 'none';

    if (hasSelection) {
        // Auto-expand config when loading a preset
        if (expandedSection) {
            expandedSection.style.display = 'block';
        }
        document.getElementById('preset-name').value = this.value;
        loadSelectedPreset();
    } else {
        // Collapse config when deselecting
        if (expandedSection) {
            expandedSection.style.display = 'none';
        }
        document.getElementById('preset-name').value = '';
        updateConfigSectionVisibility();
    }
}

async function loadSelectedPreset() {
    const presetName = document.getElementById('load-preset').value;
    if (!presetName) return;

    try {
        const response = await fetch(`/api/configs/${presetName}`);
        const config = await response.json();

        if (response.ok) {
            document.getElementById('pre-command').value = config.pre_command || '';
            document.getElementById('byobu-session').value = config.byobu_session || 'training';
            document.getElementById('log-dir').value = config.log_dir || '';

            const logPathDisplay = document.getElementById('log-path-display-removed');
            if (logPathDisplay) {
                if (config.log_dir) {
                    logPathDisplay.textContent = config.log_dir + '/command_log.txt';
                } else {
                    logPathDisplay.textContent = './logs/command_log.txt (default if enabled)';
                }
            }

            document.getElementById('preset-name').value = presetName;
            updateConfigSectionVisibility();

            await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pre_command: config.pre_command || null,
                    byobu_session: config.byobu_session || 'training',
                    log_dir: config.log_dir || null
                })
            });

            showToast(`Preset "${presetName}" loaded successfully!`, 'success');
        }
    } catch (error) {
        showToast('Error loading preset: ' + error.message, 'error');
    }
}

async function saveNamedPreset() {
    const presetName = document.getElementById('preset-name').value.trim();
    if (!presetName) {
        showToast('Please enter a preset name', 'error');
        return;
    }

    const preCommand = document.getElementById('pre-command').value;
    const sessionName = document.getElementById('byobu-session').value;
    const logDir = document.getElementById('log-dir').value.trim();

    try {
        const response = await fetch('/api/configs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: presetName,
                pre_command: preCommand || null,
                byobu_session: sessionName,
                log_dir: logDir || null
            })
        });

        const result = await response.json();

        if (response.ok) {
            await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pre_command: preCommand || null,
                    byobu_session: sessionName,
                    log_dir: logDir || null
                })
            });

            await loadPresetsList();
            document.getElementById('load-preset').value = result.name;
            document.getElementById('delete-preset').style.display = 'block';

            showToast(`Preset "${result.name}" saved successfully!`, 'success');
        } else {
            showToast('Error saving preset: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showToast('Error saving preset: ' + error.message, 'error');
    }
}

async function deleteSelectedPreset() {
    const presetName = document.getElementById('load-preset').value;
    if (!presetName) {
        showToast('Please select a preset to delete', 'error');
        return;
    }

    if (!confirm(`Are you sure you want to delete preset "${presetName}"?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/configs?name=${encodeURIComponent(presetName)}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok) {
            await loadPresetsList();
            document.getElementById('load-preset').value = '';
            document.getElementById('preset-name').value = '';
            document.getElementById('delete-preset').style.display = 'none';
            updateConfigSectionVisibility();

            showToast(`Preset "${presetName}" deleted successfully!`, 'success');
        } else {
            showToast('Error deleting preset: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showToast('Error deleting preset: ' + error.message, 'error');
    }
}

// Script Parsing
async function parseScript() {
    const scriptPath = document.getElementById('script-path').value.trim();

    if (!scriptPath) {
        showToast('Please enter a script path', 'error');
        return;
    }

    currentScriptPath = scriptPath;
    const parseBtn = document.getElementById('parse-script');
    const btnText = parseBtn.querySelector('.btn-text');
    const btnSpinner = parseBtn.querySelector('.btn-spinner');

    try {
        parseBtn.disabled = true;
        btnText.style.display = 'none';
        btnSpinner.style.display = 'inline';

        showToast('Parsing script...', 'info');

        const response = await fetch('/api/parse-script', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ script_path: scriptPath })
        });

        const data = await response.json();

        if (data.error) {
            showToast('Error: ' + data.error, 'error');
            return;
        }

        currentArgs = data.args;
        renderArgsForm(data.args);

        // Show action bar and update arg count
        document.getElementById('action-bar').style.display = 'flex';
        const argsCount = document.getElementById('args-count');
        if (argsCount && data.args.length > 0) {
            argsCount.textContent = `(${data.args.length})`;
        }

        // Hide empty state, show args form
        document.getElementById('args-empty').style.display = 'none';

        updatePreview();
        showToast('Script parsed successfully!', 'success');
    } catch (error) {
        showToast('Error parsing script: ' + error.message, 'error');
    } finally {
        parseBtn.disabled = false;
        btnText.style.display = 'inline';
        btnSpinner.style.display = 'none';
    }
}

// Render Arguments Form
function renderArgsForm(args) {
    const form = document.getElementById('args-form');
    form.innerHTML = '';

    if (args.length === 0) {
        form.innerHTML = '';
        document.getElementById('args-empty').style.display = 'block';
        const argsCount = document.getElementById('args-count');
        if (argsCount) argsCount.textContent = '';
        return;
    }

    // Update args count
    const argsCount = document.getElementById('args-count');
    if (argsCount) {
        argsCount.textContent = `(${args.length})`;
    }

    document.getElementById('args-empty').style.display = 'none';

    args.forEach(arg => {
        const argDiv = document.createElement('div');
        argDiv.className = 'arg-item';
        argDiv.dataset.argName = arg.name.toLowerCase();

        const label = document.createElement('label');
        const argName = arg.name.replace('--', '');

        if (arg.required) {
            argDiv.classList.add('required-arg');
        }

        label.innerHTML = `<span class="arg-name">${arg.name}</span>`;

        if (arg.required) {
            label.innerHTML += '<span class="required-badge">Required</span>';
        }

        if (arg.default !== undefined) {
            label.innerHTML += `<span class="default-badge">Default: ${arg.default}</span>`;
        }

        const helpText = document.createElement('div');
        helpText.className = 'help-text';
        helpText.textContent = arg.help || 'No description';

        let input;

        if (arg.choices && arg.choices.length > 0) {
            input = document.createElement('select');
            input.id = `arg-${argName}`;
            input.name = argName;

            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = arg.default !== undefined ? `Default: ${arg.default}` : 'Select...';
            input.appendChild(defaultOption);

            arg.choices.forEach(choice => {
                const option = document.createElement('option');
                option.value = choice;
                option.textContent = choice;
                if (arg.default === choice) {
                    option.selected = true;
                }
                input.appendChild(option);
            });
        } else if (arg.type === 'bool') {
            input = document.createElement('input');
            input.type = 'checkbox';
            input.id = `arg-${argName}`;
            input.name = argName;

            if (arg.action === 'true') {
                input.checked = arg.default === true;
            } else if (arg.action === 'false') {
                input.checked = arg.default !== false;
            } else {
                if (arg.default === true) {
                    input.checked = true;
                }
            }
        } else if (arg.type === 'int' || arg.type === 'float') {
            input = document.createElement('input');
            input.type = 'number';
            input.id = `arg-${argName}`;
            input.name = argName;
            if (arg.default !== undefined) {
                input.value = arg.default;
            }
            if (arg.type === 'float') {
                input.step = 'any';
            }
        } else {
            input = document.createElement('input');
            input.type = 'text';
            input.id = `arg-${argName}`;
            input.name = argName;
            if (arg.default !== undefined) {
                input.value = arg.default;
            }
            input.placeholder = arg.help || '';
            if (arg.type === 'str') {
                input.classList.add('string-input');
            }
        }

        const validationError = document.createElement('div');
        validationError.className = 'validation-error';
        validationError.textContent = 'This field is required';

        argDiv.appendChild(label);
        argDiv.appendChild(helpText);
        argDiv.appendChild(input);
        argDiv.appendChild(validationError);
        form.appendChild(argDiv);
    });

    // Show argument presets bar (if exists in UI)
    const argsPresetsBar = document.getElementById('args-presets-bar');
    if (argsPresetsBar) {
        argsPresetsBar.style.display = 'flex';
    }
}

// Filter Arguments
function filterArguments() {
    const searchTerm = document.getElementById('args-search').value.toLowerCase();
    const argItems = document.querySelectorAll('.arg-item');
    let visibleCount = 0;

    argItems.forEach(item => {
        const argName = item.dataset.argName || '';
        const helpText = item.querySelector('.help-text')?.textContent.toLowerCase() || '';
        const matches = argName.includes(searchTerm) || helpText.includes(searchTerm);

        if (matches) {
            item.classList.remove('hidden');
            visibleCount++;
        } else {
            item.classList.add('hidden');
        }
    });

    const emptyMsg = document.getElementById('args-empty');
    if (visibleCount === 0 && searchTerm) {
        emptyMsg.style.display = 'block';
    } else {
        emptyMsg.style.display = 'none';
    }
}

// Get Arguments Values
function getArgsValues() {
    const args = {};

    currentArgs.forEach(arg => {
        const argName = arg.name.replace('--', '');
        const input = document.getElementById(`arg-${argName}`);

        if (!input) return;

        if (input.type === 'checkbox') {
            const argDef = currentArgs.find(a => a.name.replace('--', '') === argName);
            if (argDef && argDef.action === 'false') {
                if (!input.checked) {
                    args[argName] = true;
                }
            } else {
                if (input.checked) {
                    args[argName] = true;
                }
            }
        } else if (input.type === 'select-one') {
            if (input.value) {
                args[argName] = input.value;
            }
        } else {
            const value = input.value.trim();
            if (value) {
                if (arg.type === 'int') {
                    args[argName] = parseInt(value);
                } else if (arg.type === 'float') {
                    args[argName] = parseFloat(value);
                } else {
                    args[argName] = value;
                }
            }
        }
    });

    return args;
}

// Quick Actions
function clearAllArgs() {
    if (!confirm('Are you sure you want to clear all arguments?')) {
        return;
    }

    currentArgs.forEach(arg => {
        const argName = arg.name.replace('--', '');
        const input = document.getElementById(`arg-${argName}`);
        if (!input) return;

        if (input.type === 'checkbox') {
            input.checked = false;
        } else {
            input.value = '';
        }
    });

    updatePreview();
    showToast('All arguments cleared', 'info');
}

function resetToDefaults() {
    currentArgs.forEach(arg => {
        const argName = arg.name.replace('--', '');
        const input = document.getElementById(`arg-${argName}`);
        if (!input) return;

        if (input.type === 'checkbox') {
            if (arg.action === 'true') {
                input.checked = false;
            } else if (arg.action === 'false') {
                input.checked = true;
            } else {
                input.checked = arg.default === true;
            }
        } else if (input.type === 'select-one') {
            if (arg.default !== undefined) {
                input.value = arg.default;
            } else {
                input.value = '';
            }
        } else {
            if (arg.default !== undefined) {
                input.value = arg.default;
            } else {
                input.value = '';
            }
        }
    });

    updatePreview();
    showToast('Reset to defaults', 'info');
}

function fillRequiredOnly() {
    let filled = 0;
    currentArgs.forEach(arg => {
        if (arg.required) {
            const argName = arg.name.replace('--', '');
            const input = document.getElementById(`arg-${argName}`);
            if (!input) return;

            if (input.value.trim() === '' && arg.default !== undefined) {
                if (input.type === 'checkbox') {
                    input.checked = arg.default === true;
                } else {
                    input.value = arg.default;
                }
                filled++;
            }
        }
    });

    updatePreview();
    if (filled > 0) {
        showToast(`Filled ${filled} required field(s) with defaults`, 'info');
    } else {
        showToast('No required fields needed filling', 'info');
    }
}

// Argument Presets
async function loadArgumentPresets() {
    try {
        const response = await fetch('/api/presets/args');
        const data = await response.json();
        const select = document.getElementById('load-arg-preset');

        select.innerHTML = '<option value="">-- Load argument preset --</option>';

        if (data.presets) {
            data.presets.forEach(preset => {
                const option = document.createElement('option');
                option.value = preset.name;
                option.textContent = preset.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading argument presets:', error);
    }
}

async function saveArgumentPreset() {
    const presetName = document.getElementById('save-arg-preset-name').value.trim();
    if (!presetName) {
        showToast('Please enter a preset name', 'error');
        return;
    }

    if (!currentScriptPath) {
        showToast('Please parse a script first', 'error');
        return;
    }

    const args = getArgsValues();

    try {
        const response = await fetch('/api/presets/args', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: presetName,
                script_path: currentScriptPath,
                args: args
            })
        });

        const result = await response.json();

        if (response.ok) {
            document.getElementById('save-arg-preset-name').value = '';
            await loadArgumentPresets();
            showToast(`Argument preset "${presetName}" saved!`, 'success');
        } else {
            showToast('Error saving preset: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showToast('Error saving preset: ' + error.message, 'error');
    }
}

async function loadArgumentPreset() {
    const presetName = this.value;
    if (!presetName) return;

    try {
        const response = await fetch(`/api/presets/args/${presetName}`);
        const preset = await response.json();

        if (response.ok && preset.args) {
            // Load arguments
            Object.entries(preset.args).forEach(([key, value]) => {
                const input = document.getElementById(`arg-${key}`);
                if (!input) return;

                if (input.type === 'checkbox') {
                    input.checked = value === true;
                } else {
                    input.value = value;
                }
            });

            updatePreview();
            showToast(`Argument preset "${presetName}" loaded!`, 'success');
        }
    } catch (error) {
        showToast('Error loading preset: ' + error.message, 'error');
    }
}

// Update Preview
function updatePreview() {
    if (!currentScriptPath) {
        document.getElementById('command-preview').textContent = '';
        return;
    }

    const args = getArgsValues();
    const preCommand = document.getElementById('pre-command').value;
    const comment = document.getElementById('comment').value;

    let preview = '';

    if (comment) {
        preview += `# ${comment}\n`;
    }

    if (preCommand) {
        const preCmdLines = preCommand.split('\n').filter(line => line.trim());
        if (preCmdLines.length > 1) {
            preview += preCmdLines.join(' &&\n');
            preview += ' &&\n';
        } else {
            preview += `${preCommand}\n`;
            preview += '&& ';
        }
    }

    preview += `python ${currentScriptPath}`;

    Object.entries(args).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            if (typeof value === 'boolean') {
                preview += ` --${key}`;
            } else if (typeof value === 'string' && (value.includes(' ') || value.includes("'"))) {
                preview += ` --${key} "${value}"`;
            } else {
                preview += ` --${key} ${value}`;
            }
        }
    });

    const lines = preview.split('\n').filter(line => line.trim() !== '');
    const formattedPreview = lines.map((line) => {
        if (line.trim().startsWith('#')) {
            return line;
        } else if (line.trim()) {
            return `$ ${line}`;
        }
        return line;
    }).join('\n');

    document.getElementById('command-preview').textContent = formattedPreview;
}

// Copy to Clipboard
async function copyCommandToClipboard() {
    const preview = document.getElementById('command-preview').textContent;
    if (!preview) {
        showToast('No command to copy', 'warning');
        return;
    }

    try {
        await navigator.clipboard.writeText(preview);
        showToast('Command copied to clipboard!', 'success');
    } catch (error) {
        showToast('Failed to copy: ' + error.message, 'error');
    }
}

// Validate Command
async function validateCommand() {
    const args = getArgsValues();
    const missingRequired = currentArgs.filter(arg => {
        if (!arg.required) return false;
        const argName = arg.name.replace('--', '');
        return !args[argName] || args[argName] === '';
    });

    const resultDiv = document.getElementById('validation-result');

    if (missingRequired.length > 0) {
        const missing = missingRequired.map(arg => arg.name).join(', ');
        resultDiv.className = 'invalid';
        resultDiv.textContent = `Missing required arguments: ${missing}`;
        resultDiv.style.display = 'block';
        showToast('Validation failed: Missing required arguments', 'error');
    } else {
        resultDiv.className = 'valid';
        resultDiv.textContent = '✓ Command is valid and ready to run';
        resultDiv.style.display = 'block';
        showToast('Command is valid', 'success');
    }
}

// Validate Fields
function validateFields() {
    currentArgs.forEach(arg => {
        if (arg.required) {
            const argName = arg.name.replace('--', '');
            const input = document.getElementById(`arg-${argName}`);
            if (!input) return;

            const value = input.type === 'checkbox' ? input.checked : input.value.trim();
            const isValid = value !== '' && value !== false;

            if (isValid) {
                input.classList.remove('invalid');
            } else {
                input.classList.add('invalid');
            }
        }
    });
}

// Run Command
async function runCommand() {
    const args = getArgsValues();
    const preCommand = document.getElementById('pre-command').value;
    const comment = document.getElementById('comment').value;
    const sessionName = document.getElementById('byobu-session').value || 'training';
    const logDir = document.getElementById('log-dir').value;
    const saveLogs = document.getElementById('save-logs').checked;

    // Validate required arguments
    const missingRequired = currentArgs.filter(arg => {
        if (!arg.required) return false;
        const argName = arg.name.replace('--', '');
        return !args[argName] || args[argName] === '';
    });

    if (missingRequired.length > 0) {
        const missing = missingRequired.map(arg => arg.name).join(', ');
        showToast(`Missing required arguments: ${missing}`, 'error');
        return;
    }

    const runBtn = document.getElementById('run-command');
    const btnText = runBtn.querySelector('.btn-text');
    const btnSpinner = runBtn.querySelector('.btn-spinner');

    try {
        runBtn.disabled = true;
        btnText.style.display = 'none';
        btnSpinner.style.display = 'inline';

        showToast('Sending command to byobu...', 'info');

        const response = await fetch('/api/run-command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                script_path: currentScriptPath,
                args: args,
                pre_command: preCommand || null,
                comment: comment,
                session_name: sessionName,
                save_logs: saveLogs,
                log_dir: logDir || null
            })
        });

        const result = await response.json();

        if (result.success) {
            showToast(result.message, 'success');

            // Save to history
            saveToHistory({
                script_path: currentScriptPath,
                args: args,
                pre_command: preCommand,
                comment: comment,
                session_name: sessionName,
                timestamp: new Date().toISOString()
            });

            // Reload history from server
            await loadCommandHistory();

            // Switch to History mini tab
            document.querySelectorAll('.tab-mini-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-mini-content').forEach(c => c.classList.remove('active'));
            const historyBtn = document.querySelector('[data-tab="history"]');
            const historyContent = document.getElementById('history-content');
            if (historyBtn && historyContent) {
                historyBtn.classList.add('active');
                historyContent.classList.add('active');
            }
        } else {
            showToast(result.message, 'error');
        }
    } catch (error) {
        showToast('Error running command: ' + error.message, 'error');
    } finally {
        runBtn.disabled = false;
        btnText.style.display = 'inline';
        btnSpinner.style.display = 'none';
    }
}

// Command History
async function loadCommandHistory() {
    try {
        const response = await fetch('/api/history');
        const data = await response.json();
        if (data.history) {
            commandHistory = data.history;
        }
    } catch (error) {
        // Fallback to localStorage
        const saved = localStorage.getItem('commandHistory');
        if (saved) {
            try {
                commandHistory = JSON.parse(saved);
            } catch (e) {
                commandHistory = [];
            }
        }
    }
    renderCommandHistory();
}

function saveToHistory(commandData) {
    commandHistory.unshift(commandData);
    if (commandHistory.length > 50) {
        commandHistory = commandHistory.slice(0, 50);
    }
    // Also save to localStorage as backup
    localStorage.setItem('commandHistory', JSON.stringify(commandHistory));
}

function renderCommandHistory() {
    const historyList = document.getElementById('history-list');
    const historyEmpty = document.getElementById('history-empty');

    console.log('Rendering command history, count:', commandHistory.length);

    if (!historyList || !historyEmpty) {
        console.error('History elements not found!');
        return;
    }

    if (commandHistory.length === 0) {
        historyList.innerHTML = '';
        historyEmpty.style.display = 'block';
        console.log('No history to display');
        return;
    }

    historyEmpty.style.display = 'none';
    historyList.innerHTML = '';

    commandHistory.forEach((cmd, index) => {
        const item = document.createElement('div');
        item.className = 'history-item';

        const time = new Date(cmd.timestamp).toLocaleString();
        const scriptName = cmd.script_path.split('/').pop();

        item.innerHTML = `
            <div class="history-item-header">
                <div class="history-item-time">${time}</div>
                <div class="history-item-actions">
                    <button class="btn-sm" onclick="rerunCommand(${index})" title="Re-run">↺</button>
                    <button class="btn-sm" onclick="copyHistoryCommand(${index})" title="Copy">📋</button>
                </div>
            </div>
            <div class="history-item-script">${scriptName}</div>
            ${cmd.comment ? `<div class="history-item-comment">${cmd.comment}</div>` : ''}
            <div class="history-item-command">${buildCommandPreview(cmd)}</div>
        `;

        historyList.appendChild(item);
    });
}

function buildCommandPreview(cmd) {
    // Use stored command if available
    if (cmd.command) {
        return cmd.command;
    }

    // Otherwise build it
    let preview = '';
    if (cmd.pre_command) {
        preview += cmd.pre_command + ' && ';
    }
    preview += `python ${cmd.script_path}`;
    Object.entries(cmd.args || {}).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            if (typeof value === 'boolean') {
                preview += ` --${key}`;
            } else {
                preview += ` --${key} ${value}`;
            }
        }
    });
    return preview;
}

async function rerunCommand(index) {
    const cmd = commandHistory[index];
    if (!cmd) return;

    // Load script path
    document.getElementById('script-path').value = cmd.script_path;

    // Parse script and then load arguments
    await parseScript();

    // Wait a bit for form to render
    setTimeout(() => {
        // Load arguments
        Object.entries(cmd.args || {}).forEach(([key, value]) => {
            const input = document.getElementById(`arg-${key}`);
            if (!input) return;

            if (input.type === 'checkbox') {
                input.checked = value === true;
            } else {
                input.value = value;
            }
        });

        // Load comment
        if (cmd.comment) {
            document.getElementById('comment').value = cmd.comment;
        }

        updatePreview();
        showToast('Command loaded from history', 'info');
    }, 500);
}

async function copyHistoryCommand(index) {
    const cmd = commandHistory[index];
    if (!cmd) return;

    // Use stored command if available, otherwise build it
    const command = cmd.command || buildCommandPreview(cmd);
    try {
        await navigator.clipboard.writeText(command);
        showToast('Command copied to clipboard!', 'success');
    } catch (error) {
        showToast('Failed to copy: ' + error.message, 'error');
    }
}

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Utility: Debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ===================================
// File Browser Functions
// ===================================

let fileBrowserCurrentPath = '';
let fileBrowserSelectedFile = null;

async function openFileBrowser() {
    const modal = document.getElementById('file-browser-modal');
    modal.style.display = 'flex';

    const scriptPath = document.getElementById('script-path').value.trim();
    let initialPath = '';

    if (scriptPath) {
        const lastSlash = scriptPath.lastIndexOf('/');
        if (lastSlash > 0) {
            initialPath = scriptPath.substring(0, lastSlash);
        }
    }

    await loadFileBrowserFavorites();
    await loadDirectory(initialPath);
    document.addEventListener('keydown', fileBrowserKeyHandler);
}

function closeFileBrowser() {
    const modal = document.getElementById('file-browser-modal');
    modal.style.display = 'none';
    fileBrowserSelectedFile = null;
    document.getElementById('file-browser-selected-path').value = '';
    document.getElementById('file-browser-select').disabled = true;
    document.removeEventListener('keydown', fileBrowserKeyHandler);
}

function fileBrowserKeyHandler(e) {
    const modal = document.getElementById('file-browser-modal');
    if (modal.style.display === 'none') return;

    if (e.key === 'Escape') {
        closeFileBrowser();
        e.preventDefault();
    } else if (e.key === 'Enter' && fileBrowserSelectedFile) {
        selectFileAndClose();
        e.preventDefault();
    }
}

async function loadDirectory(path) {
    const listEl = document.getElementById('file-browser-list');
    const loadingEl = document.getElementById('file-browser-loading');
    const emptyEl = document.getElementById('file-browser-empty');

    listEl.style.display = 'none';
    emptyEl.style.display = 'none';
    loadingEl.style.display = 'block';

    try {
        const params = new URLSearchParams();
        if (path) params.set('path', path);
        params.set('filter', '.py');

        const response = await fetch(`/api/browse?${params}`);
        const data = await response.json();

        if (data.error) {
            showToast('Error: ' + data.error, 'error');
            loadingEl.style.display = 'none';
            return;
        }

        fileBrowserCurrentPath = data.current_path;
        fileBrowserSelectedFile = null;
        document.getElementById('file-browser-selected-path').value = '';
        document.getElementById('file-browser-select').disabled = true;

        renderBreadcrumbs(data.breadcrumbs);
        document.getElementById('file-browser-parent').disabled = !data.parent_path;

        listEl.innerHTML = '';

        data.directories.forEach(dir => {
            listEl.appendChild(createFileItem(dir, 'directory'));
        });

        data.files.forEach(file => {
            listEl.appendChild(createFileItem(file, 'file'));
        });

        loadingEl.style.display = 'none';

        if (data.directories.length === 0 && data.files.length === 0) {
            emptyEl.style.display = 'block';
        } else {
            listEl.style.display = 'flex';
        }
    } catch (error) {
        showToast('Error loading directory: ' + error.message, 'error');
        loadingEl.style.display = 'none';
    }
}

function createFileItem(item, type) {
    const div = document.createElement('div');
    div.className = `file-browser-item ${type}`;
    div.dataset.path = item.path;

    const icon = document.createElement('span');
    icon.className = 'file-browser-item-icon';
    icon.textContent = type === 'directory' ? '📁' : '🐍';

    const name = document.createElement('span');
    name.className = 'file-browser-item-name';
    name.textContent = item.name;

    div.appendChild(icon);
    div.appendChild(name);

    if (type === 'file' && item.size !== undefined) {
        const size = document.createElement('span');
        size.className = 'file-browser-item-size';
        size.textContent = formatFileSize(item.size);
        div.appendChild(size);
    }

    div.addEventListener('click', () => {
        if (type === 'directory') {
            loadDirectory(item.path);
        } else {
            selectFile(item.path);
        }
    });

    if (type === 'file') {
        div.addEventListener('dblclick', () => {
            selectFile(item.path);
            selectFileAndClose();
        });
    }

    return div;
}

function selectFile(path) {
    document.querySelectorAll('.file-browser-item.selected').forEach(el => {
        el.classList.remove('selected');
    });

    const item = document.querySelector(`.file-browser-item[data-path="${CSS.escape(path)}"]`);
    if (item) item.classList.add('selected');

    fileBrowserSelectedFile = path;
    document.getElementById('file-browser-selected-path').value = path;
    document.getElementById('file-browser-select').disabled = false;
}

function selectFileAndClose() {
    if (!fileBrowserSelectedFile) return;
    document.getElementById('script-path').value = fileBrowserSelectedFile;
    closeFileBrowser();
    showToast('Selected: ' + fileBrowserSelectedFile.split('/').pop(), 'success');

    // Auto-parse the selected script
    parseScript();
}

function renderBreadcrumbs(breadcrumbs) {
    const container = document.getElementById('file-browser-breadcrumbs');
    container.innerHTML = '';

    breadcrumbs.forEach((crumb, index) => {
        const span = document.createElement('span');
        span.className = 'file-browser-breadcrumb';
        span.textContent = crumb.name;
        span.addEventListener('click', () => loadDirectory(crumb.path));
        container.appendChild(span);

        if (index < breadcrumbs.length - 1) {
            const sep = document.createElement('span');
            sep.className = 'file-browser-breadcrumb-separator';
            sep.textContent = ' / ';
            container.appendChild(sep);
        }
    });
}

function navigateToParent() {
    if (fileBrowserCurrentPath && fileBrowserCurrentPath !== '/') {
        const parentPath = fileBrowserCurrentPath.substring(0, fileBrowserCurrentPath.lastIndexOf('/'));
        loadDirectory(parentPath || '/');
    }
}

function navigateToHome() {
    loadDirectory('');
}

function refreshFileBrowser() {
    loadDirectory(fileBrowserCurrentPath);
}

async function loadFileBrowserFavorites() {
    try {
        const response = await fetch('/api/favorites');
        const data = await response.json();

        const favoritesEl = document.getElementById('file-browser-favorites');
        favoritesEl.innerHTML = '';

        if (data.paths && data.paths.length > 0) {
            data.paths.forEach(path => {
                favoritesEl.appendChild(createQuickItem(path, true));
            });
        } else {
            favoritesEl.innerHTML = '<div style="color:#666;font-size:0.8em;">No favorites</div>';
        }

        const recentEl = document.getElementById('file-browser-recent');
        recentEl.innerHTML = '';

        if (data.recent && data.recent.length > 0) {
            data.recent.slice(0, 5).forEach(path => {
                recentEl.appendChild(createQuickItem(path, false));
            });
        } else {
            recentEl.innerHTML = '<div style="color:#666;font-size:0.8em;">No recent</div>';
        }
    } catch (error) {
        console.error('Error loading favorites:', error);
    }
}

function createQuickItem(path, isFavorite) {
    const div = document.createElement('div');
    div.className = 'file-browser-quick-item';

    const name = document.createElement('span');
    name.className = 'path-name';
    name.textContent = path.split('/').pop() || path;
    name.title = path;
    div.appendChild(name);

    if (isFavorite) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await removeFromFavorites(path);
        });
        div.appendChild(removeBtn);
    }

    div.addEventListener('click', () => loadDirectory(path));
    return div;
}

async function addCurrentPathToFavorites() {
    if (!fileBrowserCurrentPath) {
        showToast('No directory selected', 'warning');
        return;
    }

    try {
        const response = await fetch('/api/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: fileBrowserCurrentPath })
        });

        if (response.ok) {
            showToast('Added to favorites', 'success');
            await loadFileBrowserFavorites();
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function removeFromFavorites(path) {
    try {
        const response = await fetch(`/api/favorites?path=${encodeURIComponent(path)}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Removed from favorites', 'info');
            await loadFileBrowserFavorites();
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Make functions available globally
window.toggleSection = toggleSection;
window.closeHelpModal = closeHelpModal;
window.rerunCommand = rerunCommand;
window.copyHistoryCommand = copyHistoryCommand;
window.toggleHelpModal = toggleHelpModal;
window.closeFileBrowser = closeFileBrowser;
