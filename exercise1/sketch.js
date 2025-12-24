// === GUI SETUP ===
let ui = {};
const presetStoreKey = 'AUDIO_EFFECT_PRESET';

function setup() {
    noCanvas();
    buildTransportUI();
    buildEffectControlsUI();
    buildLibraryUI();
    renderLibraryList();
    setEffectsToDefaults();
    setStatus('Status: UI loaded. Click "Load default sound" to begin.');
}

function buildTransportUI() {
    const holder = select('#transportRow');

    ui.btnLoad = createButton('Load default sound');
    ui.btnPlay = createButton('Play');
    ui.btnStop = createButton('Stop');
    ui.btnLoop = createButton('Loop: off');

    ui.btnPlay.attribute('disabled', true);
    ui.btnStop.attribute('disabled', true);
    ui.btnLoop.attribute('disabled', true);

    ui.btnLoad.mousePressed(async () => {
        await userStartAudio();
        loadDefaultSound();
    });

    ui.btnPlay.mousePressed(async () => {
        await userStartAudio();
        togglePlayPause();
    });

    ui.btnStop.mousePressed(async () => {
        await userStartAudio();
        stopToStart();
    });

    ui.btnLoop.mousePressed(() => {
        toggleLoopMode();
    });

    holder.child(ui.btnLoad);
    holder.child(ui.btnPlay);
    holder.child(ui.btnStop);
    holder.child(ui.btnLoop);
}

function buildEffectControlsUI() {
    // Control sliders
    ui.lpCutoff = addSlider('#lowPassControls', 'Cutoff (Hz)', 50, 20000, 8000, 1);
    ui.lpRes = addSlider('#lowPassControls', 'Resonance (Q)', 0.1, 20, 1, 0.1);

    ui.distAmt = addSlider('#distControls', 'Amount', 0, 1, 0.0, 0.01);

    ui.compThresh = addSlider('#compControls', 'Threshold', -60, 0, -24, 1);
    ui.compRatio = addSlider('#compControls', 'Ratio', 1, 20, 4, 0.1);

    ui.revTime = addSlider('#revControls', 'Time (s)', 0, 10, 2.5, 0.1);
    ui.revMix = addSlider('#revControls', 'Mix', 0, 1, 0.3, 0.01);

    ui.masterGain = addSlider('#masterControls', 'Gain', 0, 1, 0.8, 0.01);
    addSliderListener(ui.masterGain, () => applyMasterGainFromUI());

    ui.btnRec = createButton('Record');
    ui.btnRec.addClass('record');
    ui.btnRec.attribute('disabled', true);
    ui.btnRec.parent(select('#recControls'));
}

function buildLibraryUI() {
    const btnSave = select('#btnSavePreset');
    const btnClear = select('#btnClearPreset');

    btnSave.mousePressed(() => {
        const presets = loadPresets();
        const item = {
            id: crypto.randomUUID(),
            name: `Preset ${presets.length + 1}`,
            createdAt: new Date().toISOString(),
            effects: readEffectsFromUI(),
        };
        presets.unshift(item);
        savePresets(presets);
        renderLibraryList();
        setStatus('Status: Saved preset (settings only).');
    });

    btnClear.mousePressed(() => {
        setEffectsToDefaults();
        setStatus('Status: Reset to defaults.');
    });
}

function renderLibraryList() {
    const list = select('#libraryList');
    list.html('');

    const presets = loadPresets();

    if (presets.length === 0) {
        const empty = createDiv('No saved presets yet.');
        empty.addClass('small-text');
        list.child(empty);

        return;
    }

    presets.forEach(p => {
        const card = createDiv();
        card.addClass('item');

        const title = createDiv(
            `<div class='title'><b>${p.name}</b></div>
            <div class='small-text'>${new Date(p.createdAt).toLocaleString()}</div>`
        );
        title.addClass('column tight');
        card.child(title);

        const actions = createDiv();
        actions.addClass('actions');

        const btnLoad = createButton('Load');
        btnLoad.mousePressed(
            () => {
                writeEffectsToUI(p.effects);
                setStatus(`Status: Loaded preset '${p.name}'.`);
            }
        );

        const btnRename = createButton('Rename');
        btnRename.addClass('secondary');
        btnRename.mousePressed(
            () => {
                const newName = prompt('Preset name:', p.name);

                if (!newName) return;

                const all = loadPresets();
                const idx = all.findIndex(x => x.id === p.id);

                if (idx >= 0) {
                    all[idx].name = newName;
                    savePresets(all);
                    renderLibraryList();
                }
            }
        );

        const btnDelete = createButton('Delete');
        btnDelete.addClass('secondary');
        btnDelete.mousePressed(
            () => {
                const all = loadPresets().filter(x => x.id !== p.id);

                savePresets(all);
                renderLibraryList();
                setStatus(`Status: Deleted preset '${p.name}'.`);
            }
        );

        actions.child(btnLoad);
        actions.child(btnRename);
        actions.child(btnDelete);

        card.child(actions);
        list.child(card);
    });
}

// === HELPERS ===
function addSlider(parentSel, labelText, min, max, value, step, onChange) {
    const parent = select(parentSel);
    const wrapper = createDiv();

    wrapper.addClass('control');

    const label = createElement('label', `${labelText}: ${value}`);
    const slider = createSlider(min, max, value, step);

    slider._labelElem = label;
    slider._labelTxt = labelText;
    slider._handlers = [];
    
    // Single handler
    if(typeof onChange ==='function') slider._handlers.push(onChange);

    const handleInput = () => {
        refreshSliderUI(slider);
        const val = Number(slider.value());

        for (const handler of slider._handlers){
            if(typeof handler === 'function') handler(val);
        }
    }
    
    // Add handler
    slider.input(handleInput);

    // Run with initial value
    handleInput();

    wrapper.child(label);
    wrapper.child(slider);
    parent.child(wrapper);

    return slider;
}

function refreshSliderUI(slider) {
    if (!slider?._labelElem) return;

    slider._labelElem.html(`${slider._labelTxt}: ${slider.value()}`);
}

function addSliderListener(slider, handler) {
    if (!slider || typeof handler !== 'function') return;

    slider._handlers = slider._handlers || [];
    slider._handlers.push(handler);
}

function setSliderValue(slider, val) {
    if(!slider) return;

    slider.value(val);
    // Emulate sliderr value using manually dispatched input event
    slider.elt.dispatchEvent(
        new Event('input', { bubbles: true })
    );
}

function readEffectsFromUI() {
    return {
        lpCutoff: Number(ui.lpCutoff.value()),
        lpRes: Number(ui.lpRes.value()),
        distAmt: Number(ui.distAmt.value()),
        compThresh: Number(ui.compThresh.value()),
        compRatio: Number(ui.compRatio.value()),
        revTime: Number(ui.revTime.value()),
        revMix: Number(ui.revMix.value()),
        masterGain: Number(ui.masterGain.value()),
    };
}

function writeEffectsToUI(e) {
    setSliderValue(ui.lpCutoff, e.lpCutoff);
    setSliderValue(ui.lpRes, e.lpRes);
    setSliderValue(ui.distAmt, e.distAmt);
    setSliderValue(ui.compThresh, e.compThresh);
    setSliderValue(ui.compRatio, e.compRatio);
    setSliderValue(ui.revTime, e.revTime);
    setSliderValue(ui.revMix, e.revMix);
    setSliderValue(ui.masterGain, e.masterGain);
}

function setEffectsToDefaults() {
    writeEffectsToUI({
        lpCutoff: 8000,
        lpRes: 1,
        distAmt: 0.0,
        compThresh: -24,
        compRatio: 4,
        revTime: 2.5,
        revMix: 0.3,
        masterGain: 0.8,
    });
}

// === LOCAL STORAGE ===
function loadPresets() {
    try {
        const raw = localStorage.getItem(presetStoreKey);

        if (!raw) return [];

        const arr = JSON.parse(raw);

        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

function savePresets(arr) {
    localStorage.setItem(presetStoreKey, JSON.stringify(arr));
}

function setStatus(text) {
    select('#transportStatus').html(text);
}

// === AUDIO LOADING ===
let currentSound = null;

// Final volume
let masterGainNode = null;
let isLoopMode = false;

// Ensure that final gain node exists (or create one if not)
function ensureMasterNode() {
    if (masterGainNode) return;

    masterGainNode = new p5.Gain();
    masterGainNode.connect();
}

function loadDefaultSound() {
    // Ensure gain node exists
    ensureMasterNode();

    setStatus('Status: Loading default sound (assets/demo.wav)...');

    // Stop currend sound
    unloadCurrentSound();

    loadSound(
        'assets/demo.wav',
        (snd) => onSoundLoaded(snd, 'demo.wav'),
        (err) => {
            console.error(err);
            setStatus('Status: Failed to load assets/demo.wav (check that file exists).');
        }
    );
}

function onSoundLoaded(sound, label) {
    ensureMasterNode();
    currentSound = sound;

    // Disconnect from default output
    currentSound.disconnect();

    // Plug it into master gain node instead
    currentSound.connect(masterGainNode);

    // Update UI on ending
    currentSound.onended(
        () => {
            if (isLoopMode) return;

            ui.btnPlay.html("Play");
            setStatus("Status: Finished.");
        }
    )

    // Enable transport UI
    ui.btnPlay.removeAttribute('disabled');
    ui.btnStop.removeAttribute('disabled');
    ui.btnLoop.removeAttribute('disabled');

    // Update buttno text
    ui.btnPlay.html('Play');

    // Apply gain
    applyMasterGainFromUI();

    setStatus(`Status: Loaded '${label}'. Ready!`);
}

function togglePlayPause() {
    if (!currentSound) return;

    if (currentSound.isPlaying()) {
        currentSound.pause();
        ui.btnPlay.html("Play");
        setStatus("Status: Paused.");
        return;
    }
    
    startPlayback();
}

function startPlayback() {
    if (!currentSound) return;

    // Start audio
    currentSound.play();
    ui.btnPlay.html('Pause');

    // Apply loop as soon as playback is active.
    if (typeof currentSound.setLoop === 'function') {
        // Use timeout to prevent setting loop to early
        setTimeout(() => {
            // Only apply if still playing
            if (currentSound && currentSound.isPlaying()) {
                currentSound.setLoop(isLoopMode);
            }
        }, 0);
    }

    setStatus(isLooping ? 'Status: Playing (loop mode).' : 'Status: Playing.');
}

function stopToStart() {
    if (!currentSound) return;

    // Stop playback
    currentSound.stop();

    ui.btnPlay.html('Play');
    setStatus('Status: Stopped (at start).');
}

function toggleLoopMode() {
    // Toggle loop mode and update button
    isLoopMode = !isLoopMode;
    ui.btnLoop.html(isLoopMode ? 'Loop: on' : 'Loop: off');

    // No sound loaded
    if (!currentSound) {
        setStatus(isLoopMode ? 'Status: Loop enabled (applies on play).' : 'Status: Loop disabled.');
        return;
    }

    // Apply immediately only if the sound is currently playing
    if (currentSound.isPlaying()) {
        currentSound.setLoop(isLoopMode);
        setStatus(isLoopMode ? 'Status: Loop enabled.' : 'Status: Loop disabled.');
    } else {
        setStatus(isLoopMode ? 'Status: Loop enabled (applies on play).' : 'Status: Loop disabled (applies on play).');
    }
}

function applyMasterGainFromUI() {
    if (!masterGainNode || !ui.masterGain) return;

    const gain = Number(ui.masterGain.value());
    // Set gain (small value to avoid clicks)
    masterGainNode.amp(gain, 0.01);
}

function unloadCurrentSound() {
    if (!currentSound) return;
    // Stop current sound before the switch
    try { 
        currentSound.stop(); 
    } catch {}
    currentSound = null;
}