// === GUI SETUP ===
let ui = {};
const presetStoreKey = 'AUDIO_EFFECT_PRESET';
const DEBUG_MODE = true;

// EXPOSE FOR MANUAL TESTING
debug_expose();

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

    // LOW PASS
    ui.lpCutoff = addSlider('#lowPassControls', 'Cutoff (Hz)', 0, 1, 0.9, 0.01);
    ui.lpRes = addSlider('#lowPassControls', 'Resonance (Q)', 0.1, 20, 1, 0.1);
    ui.lpDW = addSlider('#lowPassControls', 'Dry/Wet', 0, 1, 0.0, 0.01);
    ui.lpOL = addSlider('#lowPassControls', 'Output Level', 0, 1, 1.0, 0.01);

    // Apply lowpass handlers
    for (const elem of [ui.lpCutoff, ui.lpRes, ui.lpDW, ui.lpOL])
        addCustomHandler(elem, () => applyLowPassFromUI());

    // WAVESHAPER DISTORTION
    ui.distAmt = addSlider('#distControls', 'Amount', 0, 1, 0.0, 0.01);
    ui.distOS = addDropdown('#distControls', 'Oversample', ['none', '2x', '4x'], 'none');
    ui.distDW = addSlider('#distControls', 'Dry/Wet', 0, 1, 0.0, 0.01);
    ui.distOL = addSlider('#distControls', 'Output Level', 0, 1, 1.0, 0.01);

    // Apply distortion handlers
    for (const elem of [ui.distAmt, ui.distOS, ui.distDW, ui.distOL])
        addCustomHandler(elem, () => applyDistortionFromUI());

    // DYNAMIC COMPRESSOR
    ui.compAttack = addSlider('#compControls', 'Attack (s)', 0, 1, 0.003, 0.001);
    ui.compKnee = addSlider('#compControls', 'Knee (dB)', 0, 40, 30, 1);
    ui.compRelease = addSlider('#compControls', 'Release (s)', 0, 1, 0.25, 0.01);
    ui.compRatio = addSlider('#compControls', 'Ratio', 1, 20, 12, 0.1);
    ui.compThresh = addSlider('#compControls', 'Threshold (dB)', -100, 0, -24, 1);
    ui.compDW = addSlider('#compControls', 'Dry/Wet', 0, 1, 0.0, 0.01);
    ui.compOL = addSlider('#compControls', 'Output Level', 0, 1, 1.0, 0.01);

    // Apply compressor handlers
    for (const elem of [ui.compThresh, ui.compRatio, ui.compAttack, ui.compKnee, ui.compRelease, ui.compDW, ui.compOL]) {
        addCustomHandler(elem, () => applyCompressorFromUI());
    }

    // REVERB FILTER
    ui.revTime = addSlider('#revControls', 'Time (s)', 0, 10, 2.5, 0.1);
    ui.revMix = addSlider('#revControls', 'Mix', 0, 1, 0.3, 0.01);

    ui.masterGain = addSlider('#masterControls', 'Gain', 0, 1, 0.8, 0.01);
    addCustomHandler(ui.masterGain, () => applyMasterGainFromUI());

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

    // Slider text value
    let textVal = slider.value();

    // Special logic for logarithmic scale
    if (slider === ui.lpCutoff){
        const freq = mapLog(Number(textVal), 20, 20000);
        textVal = Math.round(freq) + ' Hz';
    }

    slider._labelElem.html(`${slider._labelTxt}: ${textVal}`);
}

function addCustomHandler(slider, handler) {
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

function setDropdownValue(dropdown, val) {
    if (!dropdown) return;

    dropdown.selected(val);
    
    // Emulate change of dropdown option
    dropdown.elt.dispatchEvent(
        new Event('change', { bubbles: true })
    );
}

function readEffectsFromUI() {
    return {
        lpCutoff: Number(ui.lpCutoff.value()),
        lpRes: Number(ui.lpRes.value()),
        lpDW: Number(ui.lpDW.value()),
        lpOL: Number(ui.lpOL.value()),
        distAmt: Number(ui.distAmt.value()),
        distOS: ui.distOS.value(),
        distDW: Number(ui.distDW.value()),
        distOL: Number(ui.distOL.value()),
        compAttack: Number(ui.compAttack.value()),
        compKnee: Number(ui.compKnee.value()),
        compRelease: Number(ui.compRelease.value()),
        compRatio: Number(ui.compRatio.value()),
        compThresh: Number(ui.compThresh.value()),
        compDW: Number(ui.compDW.value()),
        compOL: Number(ui.compOL.value()),
        revTime: Number(ui.revTime.value()),
        revMix: Number(ui.revMix.value()),
        masterGain: Number(ui.masterGain.value()),
    };
}

function writeEffectsToUI(e) {
    setSliderValue(ui.lpCutoff, e.lpCutoff);
    setSliderValue(ui.lpRes, e.lpRes);
    setSliderValue(ui.lpDW, e.lpDW);
    setSliderValue(ui.lpOL, e.lpOL);

    setSliderValue(ui.distAmt, e.distAmt);
    setDropdownValue(ui.distOS, e.distOS);
    setSliderValue(ui.distDW, e.distDW);
    setSliderValue(ui.distOL, e.distOL);

    setSliderValue(ui.compAttack, e.compAttack);
    setSliderValue(ui.compKnee, e.compKnee);
    setSliderValue(ui.compRelease, e.compRelease);
    setSliderValue(ui.compThresh, e.compThresh);
    setSliderValue(ui.compRatio, e.compRatio);
    setSliderValue(ui.compDW, e.compDW);
    setSliderValue(ui.compOL, e.compOL);

    setSliderValue(ui.revTime, e.revTime);
    setSliderValue(ui.revMix, e.revMix);
    setSliderValue(ui.masterGain, e.masterGain);
}

function setEffectsToDefaults() {
    writeEffectsToUI({
        lpCutoff: 0.9,
        lpRes: 1,
        lpDW: 0,
        lpOL: 1.0,

        distAmt: 0.0,
        distOS: 'none',
        distDW: 0.0,
        distOL: 1.0,

        compAttack: 0.003,
        compKnee: 30,
        compRelease: 0.25,
        compRatio: 4,
        compThresh: -24,
        compDW: 0.0,
        compOL: 1.0,

        revTime: 2.5,
        revMix: 0.3,
        masterGain: 0.8,
    });
}

function addDropdown(parentSel, labelText, options, defaultValue, onChange) {
    const parent = select(parentSel);
    const wrapper = createDiv().addClass('control');

    const label = createElement('label', `${labelText}:`);

    const dropdown = createSelect();
    dropdown._labelTxt = labelText;
    dropdown._handlers = [];

    // Build options (either strings or {value: X, label: Y} dicts)
    for (const opt of options) {
        if (typeof opt === 'string') dropdown.option(opt, opt);
        else dropdown.option(opt.label, opt.value);
    }

    // Default value
    if (defaultValue !== undefined && defaultValue !== null) {
        dropdown.selected(defaultValue);
    }

    // Populate handlers
    if (typeof onChange === 'function') dropdown._handlers.push(onChange);

    const handleChange = () => {
        const val = dropdown.value();
        // Fire up all handlers
        for (const handler of dropdown._handlers) 
            handler(val);
    };

    // Connect handler to the dropdown
    dropdown.changed(handleChange);

    // Fire once to apply defaults
    handleChange();

    wrapper.child(label);
    wrapper.child(dropdown);
    parent.child(wrapper);

    return dropdown;
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

function debug_log(...args) {
    if(!DEBUG_MODE) return;
    console.log('[DEBUG MSG]: ', ...args);
}

function debug_expose() {
    if(!DEBUG_MODE) return;
    window.__app = {
      get sound() { return currentSound; },
      get lowpass() { return effectLowPass; },
      get dist() { return effectDistortion; },
      get comp() { return effectCompressor; },
      get rev() { return effectReverb; },
      get master() { return masterGainNode; },
      ui
    };

    debug_log('Exposed window.__app for debugging: sound, lowpass, dist, comp, rev, master, ui');
}

function mapLog(norm, minFreq, maxFreq) {
    const minLog = Math.log(minFreq);
    const maxLog = Math.log(maxFreq);
    const scale = (maxLog - minLog) * norm + minLog;

    return Math.exp(scale);
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

    // Setup effects chain
    connectSoundToEffectsChain(sound);
    // Apply default params
    applyAllEffectParamsFromUI();

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

    setStatus(isLoopMode ? 'Status: Playing (loop mode).' : 'Status: Playing.');
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

// === SOUND EFFECTS ===
let effectLowPass = null;
let effectDistortion = null;
let effectCompressor = null;
let effectReverb = null;

function ensureEffectsChain() {
    // Skip if already exists
    if (effectLowPass) return;

    effectLowPass = new p5.LowPass();
    effectDistortion = new p5.Distortion();
    effectCompressor = new p5.Compressor();
    effectReverb = new p5.Reverb();
}

function connectSoundToEffectsChain(sound) {
    // Ensure we have full sound chain
    ensureMasterNode();
    ensureEffectsChain();

    // Disconnect default output so we don't double-route.
    effectLowPass.disconnect();
    effectDistortion.disconnect();
    effectCompressor.disconnect();
    effectReverb.disconnect();
    sound.disconnect();

    // Plug sound chain
    sound.connect(effectLowPass);
    effectLowPass.connect(effectDistortion);
    effectDistortion.connect(effectCompressor);
    effectCompressor.connect(effectReverb);
    effectReverb.connect(masterGainNode);
}

function applyAllEffectParamsFromUI() {
    applyLowPassFromUI();
    applyDistortionFromUI();
    applyCompressorFromUI();

    applyMasterGainFromUI();
    debug_log('Applied all effect params!');
}

function applyLowPassFromUI() {
    if (!effectLowPass) return;

    const normalized = Number(ui.lpCutoff.value());
    const cutoffFreq = mapLog(normalized, 20, 20000);

    const res = Number(ui.lpRes.value());
    const dw  = Number(ui.lpDW.value());
    const ol  = Number(ui.lpOL.value());

    // Set lowpass param
    effectLowPass.freq(cutoffFreq);
    effectLowPass.res(res);
    effectLowPass.drywet(dw);
    effectLowPass.amp(ol);

    debug_log(
        'LowPass Cutoff Frequence', Math.round(cutoffFreq),
        'LowPass Resonance', res,
        'LowPass Dry/Wet', dw,
        'LowPass Output Level', ol
    );
}

function applyDistortionFromUI() {
    if (!effectDistortion) return;

    const amount = Number(ui.distAmt.value());
    const oversample = ui.distOS.value();
    const dw = Number(ui.distDW.value());
    const ol = Number(ui.distOL.value());

    // Set distortion params
    effectDistortion.set(amount, oversample);
    effectDistortion.drywet(dw);
    effectDistortion.amp(ol);

    debug_log(
        'Distortion Amount', amount,
        'Distortion Oversample', oversample,
        'Distortion Dry/Wet', dw,
        'Distortion Output Level', ol
    );
}

function applyCompressorFromUI() {
    if (!effectCompressor) return;

    const attack = Number(ui.compAttack.value());
    const knee = Number(ui.compKnee.value());
    const rel = Number(ui.compRelease.value());
    const ratio = Number(ui.compRatio.value());
    const thr = Number(ui.compThresh.value());
    const dw = Number(ui.compDW.value());
    const ol = Number(ui.compOL.value());

    // Apply compressor params
    effectCompressor.attack(attack);
    effectCompressor.knee(knee);
    effectCompressor.release(rel);
    effectCompressor.ratio(ratio);
    effectCompressor.threshold(thr);
    effectCompressor.drywet(dw);
    effectCompressor.amp(ol);

    debug_log(
        'Compressor Threshold', thr,
        'Compressor Ratio', ratio,
        'Compressor Attack', attack,
        'Compressor Knee', knee,
        'Compressor Release', rel,
        'Compressor Dry/Wet', dw,
        'Compressor Output Level', ol
    );
}