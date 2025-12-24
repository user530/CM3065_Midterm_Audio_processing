// === GUI SETUP ===
let ui = {};
let presetStoreKey = 'AUDIO_EFFECT_PRESET';

function setup() {
    noCanvas();
    buildTransportUI();
    buildEffectControlsUI();
    buildLibraryUI();
    renderLibraryList();
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

    ui.btnLoad.mousePressed(() => setStatus('Status: Sound X loaded'));
    ui.btnPlay.mousePressed(() => setStatus('Status: Sound play'));
    ui.btnStop.mousePressed(() => setStatus('Status: Sound stop'));
    ui.btnLoop.mousePressed(() => setStatus('Status: Sound loop toggle'));

    holder.child(ui.btnLoad);
    holder.child(ui.btnPlay);
    holder.child(ui.btnStop);
    holder.child(ui.btnLoop);
}

function buildEffectControlsUI() {
    // Control sliders
    ui.lpCutoff = addSlider('#lowPassControls', 'Cutoff (Hz)', 50, 20000, 8000, 1);
    ui.lpRes    = addSlider('#lowPassControls', 'Resonance (Q)', 0.1, 20, 1, 0.1);

    ui.distAmt  = addSlider('#distControls', 'Amount', 0, 1, 0.0, 0.01);

    ui.compThresh = addSlider('#compControls', 'Threshold', -60, 0, -24, 1);
    ui.compRatio  = addSlider('#compControls', 'Ratio', 1, 20, 4, 0.1);

    ui.revTime  = addSlider('#revControls', 'Time (s)', 0, 10, 2.5, 0.1);
    ui.revMix   = addSlider('#revControls', 'Mix', 0, 1, 0.3, 0.01);

    ui.masterGain = addSlider('#masterControls', 'Gain', 0, 1, 0.8, 0.01);

    ui.btnRec = createButton('Record');
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
        setStatus('Status: saved preset (settings only).');
    });

    btnClear.mousePressed(() => {
        setEffectsToDefaults();
        setStatus('Status: reset to defaults.');
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

        const title = createDiv(`<div class='title'><b>${p.name}</b></div><div class='small-text'>${new Date(p.createdAt).toLocaleString()}</div>`);
        title.addClass('column tight');
        card.child(title);

        const actions = createDiv();
        actions.addClass('actions');

        const btnLoad = createButton('Load');
        btnLoad.mousePressed(
            () => {
                writeEffectsToUI(p.effects);
                setStatus(`Status: loaded preset '${p.name}'.`);
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
                setStatus(`Status: deleted preset '${p.name}'.`);
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
function addSlider(parentSel, labelText, min, max, value, step) {
    const parent = select(parentSel);
    const wrapper = createDiv();

    wrapper.addClass('control');

    const label = createElement('label', `${labelText}: ${value}`);
    const slider = createSlider(min, max, value, step);

    slider.input(() => label.html(`${labelText}: ${slider.value()}`));

    wrapper.child(label);
    wrapper.child(slider);
    parent.child(wrapper);

    return slider;
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
    ui.lpCutoff.value(e.lpCutoff);
    ui.lpRes.value(e.lpRes);
    ui.distAmt.value(e.distAmt);
    ui.compThresh.value(e.compThresh);
    ui.compRatio.value(e.compRatio);
    ui.revTime.value(e.revTime);
    ui.revMix.value(e.revMix);
    ui.masterGain.value(e.masterGain);

    // Force labels update by emulating input event
    ui.lpCutoff.elt.dispatchEvent(new Event('input'));
    ui.lpRes.elt.dispatchEvent(new Event('input'));
    ui.distAmt.elt.dispatchEvent(new Event('input'));
    ui.compThresh.elt.dispatchEvent(new Event('input'));
    ui.compRatio.elt.dispatchEvent(new Event('input'));
    ui.revTime.elt.dispatchEvent(new Event('input'));
    ui.revMix.elt.dispatchEvent(new Event('input'));
    ui.masterGain.elt.dispatchEvent(new Event('input'));
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