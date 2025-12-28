let ui = {};
let mode = 'captcha';
let captchaIsPlaying = false;
let viz = { canvas: null, fft: null };

// Task 2.2
let visualiserState = {
    sounds: {},
    selectedSoundKey: 'sound1',
    isPlaying: false,

    // p5Audio nodes for Meyda
    sourceNode: null,
    gainNode: null,
    analyzer: null,

    // Meyda features
    features: {
        rms: 0,
        zcr: 0,
        spectralCentroid: 0,
        spectralFlatness: 0,
        spectralRolloff: 0,
    },
}

// Task 2.3
let voiceState = {
  sound: null,
  isPlaying: false,

  bg: 'black',
  shape: 'square',

  speechRec: null,
  isListening: false,
  lastHeard: '—',
  lastAction: '—',
};

// Captcha variables
let captchaToken = '';
let captchaReady = false;
let captchaSchedule = null;
let captchaBus = null;
let captchaEffects = {
  bp: null,
  hp: null,
  lp: null,
  dist: null,
  gain: null,
  noise: null,
  noiseAmp: null,
};
let digitSounds = {};
let assetsLoaded = false;

function preload() {
    // TASK 2.1
    // Base path
    const base = 'assets/digits/';
    
    // Load digit WAV assets
    for (let d = 0; d <= 9; d++) {
        const key = String(d);
        digitSounds[key] = loadSound(
            `${base}${key}.wav`,
            () => {},
            () => {}
        );
    }

    // TASK 2.2
    visualiserState.sounds.sound1 = loadSound('assets/visualize/Ex2_sound1.wav');
    visualiserState.sounds.sound2 = loadSound('assets/visualize/Ex2_sound2.wav');
    visualiserState.sounds.sound3 = loadSound('assets/visualize/Ex2_sound3.wav');

    // TASK 2.3
    voiceState.sound = loadSound('assets/voice/Kalte_Ohren_(_Remix_).mp3');
}

function setup() {
    setupVizualizer();
    
    wireModeButtons();
    wireCaptchaUI();
    wireVisualUI();
    wireVoiceUI();
    
    // TASK 2.1
    // Build audio FX chain
    buildCaptchaEffectsChain();
    
    // Set initial mode
    setMode('captcha');

    // Check that assets loaded
    assetsLoaded = areDigitAssetsLoaded();
    setDebug(assetsLoaded ? 'Ready: digit assets loaded' : 'Warning: digit assets not loaded (or missing)');

    setStatus('Status: UI loaded. Click "New captcha" to begin.');
}

function draw() {
    background(245);

    if(mode === 'captcha') {
        renderWaveform();
        return;
    }

    if(mode === 'visual') {
        renderMeydaVisualiser();
        return;
    }

    if (mode === 'voice') {
        renderVoiceVisualiser();
        return;
    }
}

// === UI ===
function wireModeButtons() {
    ui.btnModeCaptcha = select('#btnModeCaptcha');
    ui.btnModeVisual = select('#btnModeVisual');
    ui.btnModeVoice = select('#btnModeVoice');

    ui.panelCaptcha = select('#panelCaptcha');
    ui.panelVisual = select('#panelVisual');
    ui.panelVoice = select('#panelVoice');

    ui.btnModeCaptcha.mousePressed(() => setMode('captcha'));
    ui.btnModeVisual.mousePressed(() => setMode('visual'));
    ui.btnModeVoice.mousePressed(() => setMode('voice'));
}

function setMode(next) {
    mode = next;
    
    // Show exercise panel based on mode
    ui.panelCaptcha.style('display', mode === 'captcha' ? 'block' : 'none');
    ui.panelVisual.style('display', mode === 'visual' ? 'block' : 'none');
    ui.panelVoice.style('display', mode === 'voice' ? 'block' : 'none');

    // Transfer canvas to the active panel
    const targetParentId = (mode === 'captcha') 
    ? 'captchaViz' 
    : (mode === 'visual')  
        ? 'visualViz'  
        : 'voiceViz';
    attachCanvasTo(targetParentId);

    // Stop other panel
    if (mode === 'visual') {
        stopCaptchaPlayback();
        // Stop voice controls
    }

    if (mode === 'captcha') {
        stopVisualiser();
        // Stop voice controls
    }

    if (mode === 'voice') {
        stopCaptchaPlayback();
        stopVisualiser();
    }
}

function wireCaptchaUI() {
    // Buttons
    ui.btnCaptchaNew = select('#btnCaptchaNew');
    ui.btnCaptchaPlay = select('#btnCaptchaPlay');
    ui.btnCaptchaStop = select('#btnCaptchaStop');
    ui.btnCaptchaSubmit = select('#btnCaptchaSubmit');
    ui.btnCaptchaClear = select('#btnCaptchaClear');

    // Input and result
    ui.captchaInput = select('#captchaInput');
    ui.captchaResult = select('#captchaResult');

    ui.vizLabel = select('#vizLabel')

    // Handlers
    ui.btnCaptchaNew.mousePressed(async () => {
        await userStartAudio();

        assetsLoaded = areDigitAssetsLoaded();

        // Guard clause
        if (!assetsLoaded) {
            captchaReady = false;
            ui.btnCaptchaPlay.attribute('disabled', '');
            ui.btnCaptchaStop.attribute('disabled', '');
            ui.captchaResult.html('<b>[Result]</b> Missing digit audio assets (0.wav…9.wav).');
            ui.vizLabel.html('—');
            setStatus('Status: Cannot generate captcha (sound assets missing).');
            setDebug('Error: Add assets/digits/0.wav … 9.wav');
            return;
        }

        // Stop already playing one
        stopCaptchaPlayback();

        // Generate captcha
        captchaToken = generateCaptchaDigits(5);
        captchaReady = true;

        // Enable controls
        ui.btnCaptchaPlay.removeAttribute('disabled');
        ui.btnCaptchaStop.removeAttribute('disabled');

        // Reset UI fields
        ui.captchaInput.value('');
        ui.captchaResult.html('<b>[Result]</b> Status message —');
        ui.vizLabel.html('Ready');

        setStatus(`Status: New captcha generated. (${captchaToken.length} digits)`);
        setDebug(`Captcha token (for dev): ${captchaToken}`);

        // Play it our
        await playCaptchaScrambled();
    });

    ui.btnCaptchaPlay.mousePressed(async () => {
        await userStartAudio();

        if (!captchaReady) {
            ui.captchaResult.html('<b>[Result]</b> Please generate captcha first (clikc "New captcha").');
            setStatus('Status: Play blocked (no captcha).');
            return;
        }

        await playCaptchaScrambled();
    });

    ui.btnCaptchaStop.mousePressed(async () => {
        await userStartAudio();

        stopCaptchaPlayback();

        ui.vizLabel.html('Stopped');
        setStatus('Status: Stop captcha.');
    });

    ui.btnCaptchaSubmit.mousePressed(() => {
        const val = (ui.captchaInput.value() || '').trim();

        // Guard clause
        if (!val) {
            ui.captchaResult.html('<b>[Result]</b> Please type the captcha.');
            setStatus('Status: Empty input.');
            return;
        }
    
        // Guard clause
        if (!captchaReady) {
            ui.captchaResult.html('<b>[Result]</b> Generate a captcha first.');
            setStatus('Status: No captcha generated.');
            return;
        }

        // Normalize and check
        const normalized = val.replace(/\s+/g, '');
        const correct = normalized === captchaToken;

        // Handle user input
        if (correct) {
            ui.captchaResult.html('<b>[Result]</b> Correct.');
            setStatus('Status: Captcha solved.');
        } else {
            ui.captchaResult.html('<b>[Result]</b> Incorrect. Try again or generate a new captcha.');
            setStatus('Status: Incorrect captcha.');
        }
    });

    ui.btnCaptchaClear.mousePressed(() => {
        ui.captchaInput.value('');
        ui.captchaResult.html('<b>[Result]</b> Status message —');

        setStatus('Status: Cleared input.');
    });
}

function wireVisualUI() {
    // Selectors
    ui.btnVisPlay = select('#btnVisPlay');
    ui.btnVisStop = select('#btnVisStop');

    ui.btnSound1 = select('#btnSound1');
    ui.btnSound2 = select('#btnSound2');
    ui.btnSound3 = select('#btnSound3');

    ui.visLabel = select('#visLabel');
    ui.soundPathLabel = select('#soundPathLabel');
    ui.featureReadout = select('#featureReadout');

    // Enable buttons, they should be loaded in the preload fase
    ui.btnVisPlay.removeAttribute('disabled');
    ui.btnVisStop.removeAttribute('disabled');

    // Btn handlers
    ui.btnSound1.mousePressed(() => selectVisualSound('sound1'));
    ui.btnSound2.mousePressed(() => selectVisualSound('sound2'));
    ui.btnSound3.mousePressed(() => selectVisualSound('sound3'));

    ui.btnVisPlay.mousePressed(async () => {
        await userStartAudio();
        playVisualiser();
    });

    ui.btnVisStop.mousePressed(async () => {
        stopVisualiser();
    });

    // Update UI
    updateVisualSoundLabel();
    ui.visLabel.html('Ready');
    ui.featureReadout.html('—');
}

function wireVoiceUI() {
    ui.btnVoiceStart = select('#btnVoiceStart');
    ui.btnVoiceStop = select('#btnVoiceStop');

    ui.voiceLabel = select('#voiceLabel');
    ui.voiceHeard = select('#voiceHeard');
    ui.voiceAction = select('#voiceAction');
    ui.voiceTrackLabel = select('#voiceTrackLabel');

    ui.voiceLabel.html('Ready');
    ui.voiceHeard.html('Heard: —');
    ui.voiceAction.html('Action: —');

    // Btn handlers
    ui.btnVoiceStart.mousePressed(async () => {
        await userStartAudio();
        await startVoiceMode();
    });

    ui.btnVoiceStop.mousePressed(() => stopVoiceMode());
}

function setStatus(text) {
    const status = select('#appStatus')
    status.html(text);
}

function setDebug(text) {
    const debug = select('#debugBox')
    debug.html(text);
}

function setupVizualizer() {
    const parentEl = document.getElementById('captchaViz');

    // Create a temporary canvas; resize after layout stabilizes
    viz.canvas = createCanvas(10, 10);
    viz.canvas.parent('captchaViz');

    viz.fft = new p5.FFT(0.85, 1024);

    // Wait for layout to settle (often needs 2 frames)
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const rect = parentEl.getBoundingClientRect();
            resizeCanvas(Math.floor(rect.width), Math.floor(rect.height));
        });
    });
}

function renderWaveform() {
    // Only render waveform if we audio running
    if (getAudioContext().state !== 'running') {
        drawCenteredText('Click New captcha / Play to enable audio.');
        return;
    }

    // Waveform
    const wave = viz.fft.waveform();

    // Drawing setup
    noFill();
    stroke(20);
    strokeWeight(2);
    beginShape();
    const multiplier = 5;

    // Draw waveform
    for (let i = 0; i < wave.length; i++) {
        const x = map(i, 0, wave.length - 1, 0, width);
        const amplified = constrain(wave[i] * multiplier, -1, 1);
        const y = map(amplified, -1, 1, height - 10, 10);
        vertex(x, y);
    }

    endShape();

    // Show small text
    noStroke();
    fill(120);
    textSize(12);
    textAlign(LEFT, BOTTOM);
    text(captchaIsPlaying ? 'Playing...' : 'Idle', 10, height - 8);
}

function drawCenteredText(msg) {
    noStroke();
    fill(120);
    textSize(12);
    textAlign(CENTER, CENTER);
    text(msg, width / 2, height / 2);
}

function windowResized() {
    const parentId = (mode === 'captcha') 
    ? 'captchaViz' 
    : (mode === 'visual')  
        ? 'visualViz'  
        : 'voiceViz';

    const parentEl = document.getElementById(parentId);
    const rect = parentEl.getBoundingClientRect();
    resizeCanvas(Math.floor(rect.width), Math.floor(rect.height));
}

function attachCanvasTo(parentId) {
    // Attach canva to the new container
    viz.canvas.parent(parentId);

    // Resize it appropriatley
    const parentEl = document.getElementById(parentId);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const rect = parentEl.getBoundingClientRect();
            resizeCanvas(Math.floor(rect.width), Math.floor(rect.height));
        });
    });
}

function selectVisualSound(key) {
    if (visualiserState.isPlaying) stopVisualiser();
    visualiserState.selectedSoundKey = key;
    updateVisualSoundLabel();
    setStatus(`Status: Selected ${key.toUpperCase()}.`);
    ui.featureReadout.html('—');
}

function updateVisualSoundLabel() {
  const map = {
    sound1: 'assets/visualize/Ex2_sound1.wav',
    sound2: 'assets/visualize/Ex2_sound2.wav',
    sound3: 'assets/visualize/Ex2_sound3.wav',
  };

  if (ui.soundPathLabel) ui.soundPathLabel.html(map[visualiserState.selectedSoundKey]);
}

// === CAPTCHA GENERATION ===
function generateCaptchaDigits(num_digits) {
    let result = '';

    // Just generate simple combination of numbers of specified size
    for (let i = 0; i < num_digits; i++) {
        result += String(floor(random(0, 10)));
    }

    return result;
}

function areDigitAssetsLoaded() {
    for (let digit = 0; digit <= 9; digit++) {
        // Chek that digit sounds has a value for the key
        const sound = digitSounds[String(digit)];
        // Each sound should be p5.SoundFile, already loaded in preload step
        if (!sound || typeof sound.isLoaded !== 'function' || !sound.isLoaded()) {
            return false;
        }
    }

    return true;
}

// === EFFECT CHAIN + PLAYBACK ===
function buildCaptchaEffectsChain() {
    // MAin bus, later used in visualisation
    captchaBus = new p5.Gain();
    captchaBus.connect();

    // Scrambling effects (distort, but still make captcha human distinguishable)
    captchaEffects.bp = new p5.BandPass();
    captchaEffects.lp = new p5.LowPass();
    captchaEffects.hp = new p5.HighPass();
    captchaEffects.dist = new p5.Distortion(0.15);
    captchaEffects.gain = new p5.Gain();

    // Add noise to obscure original sound
    captchaEffects.noise = new p5.Noise('white');
    captchaEffects.noiseAmp = new p5.Gain();

    // Disconnect to prevent overlapping sound
    captchaEffects.bp.disconnect();
    captchaEffects.lp.disconnect();
    captchaEffects.hp.disconnect();
    captchaEffects.dist.disconnect();
    captchaEffects.gain.disconnect();
    captchaEffects.noise.disconnect();
    captchaEffects.noiseAmp.disconnect();

    // Connect effect chain (LowPass by default, but can be randomised)
    captchaEffects.bp.connect(captchaEffects.lp);
    captchaEffects.lp.connect(captchaEffects.dist);
    captchaEffects.dist.connect(captchaEffects.gain);
    captchaEffects.gain.connect(captchaBus);

    // Connect noise layer
    captchaEffects.noise.connect(captchaEffects.noiseAmp);
    captchaEffects.noiseAmp.connect(captchaBus);

    // Start noise generator (silent at first)
    captchaEffects.noise.start();
    captchaEffects.noiseAmp.amp(0);

    // Connect FFT analyzer to the main bus
    viz.fft.setInput(captchaBus);
}

async function playCaptchaScrambled() {
    // Stop active playback
    stopCaptchaPlayback();

    // Randomise scrambling params to add robustness
    randomiseCaptchaScrambleParams();

    // Raise flag and setup status
    captchaIsPlaying = true;
    ui.vizLabel.html('Playing');
    setStatus('Status: Playing captcha.');

    /*
        Configure audio "sequence playback" params
        Instead of playing sounds in direct sequence using p5 sound 'onEnded'
        We will small random gaps and rate changes to make captcha more resistant to machine solving
    */
    const digitGap = random(0.02, 0.08);
    const digitRate = random(0.92, 1.06);
    const digitAmp = 1;

    // Time variables
    let timestamp = 0;
    const now = getAudioContext().currentTime;

    // Store references to async operations (playbacks/status updates), so we can stop them on demand
    captchaSchedule = [];

    // Create captcha sequence playback from different sounds
    for (let i = 0; i < captchaToken.length; i++) {
        // Next digit and associated sound
        const digitStr = captchaToken[i];
        const sound = digitSounds[digitStr];

        // Disconnect from master node
        try { sound.disconnect(); } catch (e) {}
        // Route this sound through effect chain instead
        sound.connect(captchaEffects.bp);

        // Schedule digit sound play
        const startAt = now + timestamp;

        // Calculate delay for each digit playback
        const delayMs = max(0, floor((startAt - now) * 1000));

        // Set delayed playback for the digit sound
        const handle = setTimeout(
            () => {
                // Guard clause: async operation shouldn't start playback if playback was stopped
                if (!captchaIsPlaying) return;

                // Update playback rate (slightly randomised) and amp
                sound.rate(digitRate);
                sound.amp(digitAmp);

                // Playback digit sound
                sound.play();
            }, 
            delayMs
        );

        // Store handler for manual stop if we need
        captchaSchedule.push({ sound, handle });

        // Estimate duration: use buffer duration if available, otherwise fallback (I manually cliped each wav to 1 sec)
        const duration = (sound.duration && sound.duration() > 0) ? sound.duration() : 1;
        timestamp += duration + digitGap;
    }

    // Add a stop timer so UI returns to idle after sequence playback ends
    const stopMs = floor(timestamp * 1000 + 150);
    // UI reset handler
    const endHandle = setTimeout(
        () => {
            captchaIsPlaying = false;
            ui.vizLabel.html('Idle');
            // Stop noise generator
            captchaEffects.noiseAmp.amp(0, 0.06);
        }, 
        stopMs
    );

    captchaSchedule.push({ endHandle });
}

function stopCaptchaPlayback() {
    // Raise flag
    captchaIsPlaying = false;
    
    // Stop all scheduled timeouts and currently playing sounds
    if (captchaSchedule && Array.isArray(captchaSchedule)) {
        for (const item of captchaSchedule) {
            // Clear scheduled playback
            if (item.handle) clearTimeout(item.handle);
            // Clear scheduled UI reset
            if (item.endHandle) clearTimeout(item.endHandle);
            // Stop playing sound
            if (item.sound) {
                try { item.sound.stop(); } catch (e) {}
            }
        }
    }

    // Clear schedule
    captchaSchedule = null;

    // Silence effect chain (small fade)
    if (captchaEffects.noiseAmp) captchaEffects.noiseAmp.amp(0, 0.03);
}

function randomiseCaptchaScrambleParams() {
    /* 
        Randomise Band-pass around speech region 
        (https://iver56.github.io/audiomentations/waveform_transforms/band_pass_filter/#:~:text=Here%20we%20input,and%20~3400%20Hz.)
    */

    // Frequency and resonance
    const bpFreq = random(300, 3400);
    const bpRes = random(6, 18);
    captchaEffects.bp.freq(bpFreq);
    captchaEffects.bp.res(bpRes);

    // We randomise low/pass filter to "emulate" notch
    const useHP = random() < 0.5;
    // Prepare variables for pass filter
    let passLabel = '';
    let passFreq = 0;

    // First disconnect all pass filters
    captchaEffects.bp.disconnect();
    captchaEffects.lp.disconnect();
    captchaEffects.hp.disconnect();

    // Re-wire correct filter based on random
    if (useHP) {
        passLabel = 'HP';
        passFreq = random(600, 1200);

        captchaEffects.bp.connect(captchaEffects.hp);
        captchaEffects.hp.connect(captchaEffects.dist);
        captchaEffects.hp.freq(passFreq);
    } else {
        passLabel = 'LP';
        passFreq = random(1200, 3000);

        captchaEffects.bp.connect(captchaEffects.lp);
        captchaEffects.lp.connect(captchaEffects.dist);
        captchaEffects.lp.freq(passFreq);
    }

    // Add small distortion (with 2x oversample for smoothing)
    const distortion = random(0.1, 0.2);
    captchaEffects.dist.set(distortion, '2x');

    // Overall gain
    captchaEffects.gain.amp(1);

    // Add some small noise on top to make it harder for achine
    const noiseLevel = random(0.1, 0.3);
    captchaEffects.noiseAmp.amp(noiseLevel, 0.02);

    setDebug(
        `scramble: bp=${bpFreq.toFixed(0)}Hz res=${bpRes.toFixed(1)}, ` +
        `${passLabel}=${passFreq.toFixed(0)}Hz, ` +
        `dist=${distortion.toFixed(2)}, noise=${noiseLevel.toFixed(3)}`
    );
}

// TASK 2.2
function playVisualiser() {
    // Guard clause to ensure Meyda exists
    if (!window.Meyda) {
        setDebug('Error: Meyda not loaded! Ensure library loaded.');
        setStatus('Status: Meyda missing.');
        return;
    }

    const soundFile = visualiserState.sounds[visualiserState.selectedSoundKey];

    // Guard clause
    if (!soundFile || !soundFile.isLoaded || !soundFile.isLoaded()) {
        setStatus('Status: Sound not loaded yet.');
        setDebug('Warning: Selected sound not loaded');
        return;
    }

    // Clear previous visualiser
    stopVisualiser();

    const audioContext = getAudioContext();
    const buffer = soundFile.buffer;

    // Setup sound nodes
    visualiserState.sourceNode = audioContext.createBufferSource();
    visualiserState.sourceNode.buffer = buffer;

    visualiserState.gainNode = audioContext.createGain();
    visualiserState.gainNode.gain.value = 1.0;

    // Connect nodes to output
    visualiserState.sourceNode.connect(visualiserState.gainNode);
    visualiserState.gainNode.connect(audioContext.destination);

    // Create Meyda analyzer
    visualiserState.analyzer = Meyda.createMeydaAnalyzer({
        audioContext: audioContext,
        source: visualiserState.gainNode,
        bufferSize: 512,
        featureExtractors: [
            'rms',
            'zcr',
            'spectralCentroid',
            'spectralFlatness',
            'spectralRolloff',
        ],
        // Store meyda results and update UI
        callback: (features) => {
            if (!features) return;

            // Meyda features to global statte
            if (typeof features.rms === 'number') visualiserState.features.rms = features.rms;
            if (typeof features.zcr === 'number') visualiserState.features.zcr = features.zcr;
            if (typeof features.spectralCentroid === 'number') visualiserState.features.spectralCentroid = features.spectralCentroid;
            if (typeof features.spectralFlatness === 'number') visualiserState.features.spectralFlatness = features.spectralFlatness;
            if (typeof features.spectralRolloff === 'number') visualiserState.features.spectralRolloff = features.spectralRolloff;

            // Update UI
            if (ui.featureReadout) {
                ui.featureReadout.html(
                    `rms=${visualiserState.features.rms.toFixed(4)}\n` +
                    `zcr=${visualiserState.features.zcr.toFixed(1)}\n` +
                    `centroid=${visualiserState.features.spectralCentroid.toFixed(0)}\n` +
                    `flatness=${visualiserState.features.spectralFlatness.toFixed(3)}\n` +
                    `rolloff=${visualiserState.features.spectralRolloff.toFixed(0)}\n`
                );
            }
        }
    });

    // Start visualiser
    visualiserState.analyzer.start();
    visualiserState.sourceNode.start();
    // Raise flag
    visualiserState.isPlaying = true;

    // Update UI
    ui.visLabel.html('Playing');
    setStatus('Status: Playing visualiser sound.');
    // Handle playback end
    visualiserState.sourceNode.onended = () => {
        stopVisualiser();
        ui.visLabel.html('Idle');
        setStatus('Status: Visualiser playback ended.');
    };
}

function stopVisualiser() {
    // Lower flag
    visualiserState.isPlaying = false;

    // Stop and clear analyzer
    if (visualiserState.analyzer) {
        try { visualiserState.analyzer.stop(); } catch (e) {}
        visualiserState.analyzer = null;
    }

    // Stop and clear playback
    if (visualiserState.sourceNode) {
        try { visualiserState.sourceNode.stop(); } catch (e) {}
        try { visualiserState.sourceNode.disconnect(); } catch (e) {}
        visualiserState.sourceNode = null;
    }

    // Mute and clear gain node
    if (visualiserState.gainNode) {
        try { visualiserState.gainNode.disconnect(); } catch (e) {}
        visualiserState.gainNode = null;
    }

    // Reset state features
    for (const feature of Object.keys(visualiserState.features)) visualiserState.features[feature] = 0;
}

function renderMeydaVisualiser() {
    // No visualisation when not playing
    if (!visualiserState.isPlaying) {
        background(245);
        drawCenteredText('Idle - click Play');
        return;
    }

    // Read Meyda feature values
    const rms = visualiserState.features.rms;
    const centroid = visualiserState.features.spectralCentroid;
    const rolloff = visualiserState.features.spectralRolloff;
    const flatness = visualiserState.features.spectralFlatness;
    const zcr = visualiserState.features.zcr;

    /*
        Meyda features visual mapping:
        - rms -> alpha + value + pulse magnitude (energy -> brighter + stronger size)
        - zcr -> stroke weight (noisy/high-freq -> thicker outlines)
        - spectralRolloff -> background hue value and shift (higher freq => deeper background + hue drift)
        - spectralFlatness -> vertical jitter + rotation speed (more noisy sound -> unstable motion)
        - spectralCentroid -> primary hue shift ("brighter" sound -> vibrant colors)
    */

    // Normalised values
    const normEnergy = constrain(map(rms, 0, 0.12, 0, 1), 0, 1);
    const normBright = constrain(map(centroid, 200, 6000, 0, 1), 0, 1);
    const normRolloff = constrain(map(rolloff, 500, 14000, 0, 1), 0, 1);
    const normNoise = constrain(flatness, 0, 1);
    const normZcr = constrain(map(zcr, 0, 140, 0, 1), 0, 1);

    // Use HSB for powerfull color changes
    colorMode(HSB, 360, 100, 100, 255);

    // Background params
    const bgHue = (200 + normRolloff * 140 + frameCount * 0.15) % 360;
    const bgSat = 25 + normNoise * 35;
    const bgVal = 95 - normRolloff * 20 - normNoise * 15;
    background(bgHue, bgSat, bgVal);

    // Number of squares
    const shapeCount = floor(lerp(6, 20, normEnergy));

    // Base size - centroid dependent
    const baseSize = lerp(height * 0.25, height * 0.9, normBright);

    // Vertical jitter
    const jitter = lerp(10, 100, normNoise);

    // Stroke weight - zcr dependant
    const strokeW = lerp(1, 10, normZcr);
    strokeWeight(strokeW);

    // Color intensity - energy dependant
    const alpha = lerp(70, 230, normEnergy);
    // Brightness
    const colValue = lerp(25, 225, normEnergy);

    // Rotation, driven by noise + brightness
    const rotSpeed = 0.5 + normNoise * 0.15 + normBright * 0.05;

    // Pulse is boosted by energy
    const pulseAmt = lerp(0.25, 0.5, normEnergy);

    rectMode(CENTER);

    push();
    translate(width / 2, height / 2);

    // Small horizontal border offset
    const margin = 15;
    for (let i = 0; i < shapeCount; i++) {
        // Interpolation (spread squares around )
        const interplt = (shapeCount <= 1) ? 0.5 : i / (shapeCount - 1);

        // Coordinates (with jitter around y-axis)
        const x = lerp(-width / 2 + margin, width / 2 - margin, interplt);
        const y = random(-jitter, jitter);

        // Rotation
        const phase = i * 2 + interplt * 5;
        const rot = sin(frameCount * rotSpeed + phase);

        // Pulsing
        const pulse = 1.0 + sin(frameCount * 0.15 + i * 0.8) * pulseAmt;

        // Hue and saturation
        const hue = (normBright * 320 + interplt * 90 + frameCount * 0.35) % 360;
        const saturtn = 35 + normNoise * 60;

        // Set colors
        stroke((hue + 180) % 360, 80, 95, 230);
        fill(hue, saturtn, colValue, alpha);

        // Rectside
        const side = baseSize * pulse;

        push();
        translate(x, y);
        rotate(rot);
        rect(0, 0, side, side);
        pop();
    }

    pop();

    // Reset color mode for UI text
    colorMode(RGB, 255);
    noStroke();
    // UI text
    fill(90);
    textSize(12);
    textAlign(LEFT, BOTTOM);
    text('Playing (Meyda)', 10, height - 8);
}

// VOICE CONTROLELR
async function startVoiceMode() {
    // Init speech recognition
    if (!voiceState.speechRec) {
        voiceState.speechRec = new p5.SpeechRec('en-US', onSpeechResult);
        voiceState.speechRec.continuous = true;
        voiceState.speechRec.interimResults = false;

        // Debug logs
        voiceState.speechRec.onStart = () => console.log('SpeechRec started');
        voiceState.speechRec.onEnd = () => console.log('SpeechRec stopped');
        voiceState.speechRec.onError = (e) => console.error('SpeechRec error', e);
    }

    // Mic permissions
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
        const msg = 'Mic permission failed';

        console.error(msg, e);

        // UI update
        setDebug(msg);
        voiceState.lastAction = 'Mic permission denied/blocked';
        ui.voiceAction.html(`Action: ${voiceState.lastAction}`);
        return;
    }

    // Start speech recognition
    try {
        voiceState.speechRec.start();
        voiceState.isListening = true;
    } catch (e) {
        console.error(e);
    }

    // Update UI
    voiceState.lastAction = 'Listening...';
    ui.voiceLabel.html('Listening');
    ui.voiceAction.html(`Action: ${voiceState.lastAction}`);

    // Autoplay on load
    if (voiceState.sound && voiceState.sound.isLoaded() && !voiceState.sound.isPlaying()) {
        voiceState.sound.loop();
        voiceState.isPlaying = true;
    }
}

function stopVoiceMode() {
    // Stop recognition
    if (voiceState.speechRec && voiceState.isListening) {
        try { voiceState.speechRec.stop(); } catch (e) {}
    }
    voiceState.isListening = false;

    // Stop playback
    if (voiceState.sound && voiceState.sound.isPlaying()) {
        voiceState.sound.stop();
    }
    voiceState.isPlaying = false;

    // Update UI
    voiceState.lastAction = 'Stopped';
    ui.voiceLabel.html('Ready');
    ui.voiceAction.html(`Action: ${voiceState.lastAction}`);
}

function onSpeechResult() {
    // Recognition string
    const raw = (voiceState.speechRec.resultString || '').trim();
    if (!raw) return;

    // Register heard string
    voiceState.lastHeard = raw;
    ui.voiceHeard.html(`Heard: ${raw}`);

    // 2 Lists of existing options
    const colors = ['black', 'white', 'red', 'blue', 'green'];
    const shapes = ['square', 'triangle', 'circle', 'pentagon'];

    // Prepare normalized str and action falg
    const said = raw.toLowerCase();
    let didSomething = false;

    // Check if color command was recognized
    for (const color of colors) {
        if (said.includes(color)) {
            voiceState.bg = color;
            voiceState.lastAction = `Background -> ${color}`;
            didSomething = true;
            break;
        }
    }

    // Check if shape command was recognized
    for (const shape of shapes) {
        if (said.includes(shape)) {
            voiceState.shape = shape;
            voiceState.lastAction = `Shape -> ${shape}`;
            didSomething = true;
            break;
        }
    }

    // Log unrecognized string
    if (!didSomething) {
        voiceState.lastAction = 'No command matched';
    }

    // UpdateUI
    ui.voiceAction.html(`Action: ${voiceState.lastAction}`);
}

function renderVoiceVisualiser() {
    // Guard clasue
    if (!voiceState.isPlaying && !voiceState.isListening) {
        background(245);
        drawCenteredText('Idle - click Start Listening');
        return;
    }

    // Background/foreground map based on the state
    const bgMap = {
        black: { bg: [0, 0, 0], fg: [240, 240, 240] },
        white: { bg: [255, 255, 255], fg: [20, 20, 20] },
        red:   { bg: [220, 40, 40], fg: [255, 235, 235] },
        blue:  { bg: [40, 90, 220], fg: [235, 240, 255] },
        green: { bg: [40, 180, 90], fg: [235, 255, 240] },
    };

    // Select color scheme
    const scheme = bgMap[voiceState.bg] || bgMap.black;

    // Background
    background(scheme.bg[0], scheme.bg[1], scheme.bg[2]);

    // Shape colours
    stroke(scheme.fg[0], scheme.fg[1], scheme.fg[2]);
    fill(scheme.fg[0], scheme.fg[1], scheme.fg[2], 160);
    strokeWeight(2);

    // PLACEHOLDER, later use audio energy to animate 
    let energy = 0.2;
    if (getAudioContext().state === 'running' && voiceState.sound && voiceState.sound.isPlaying()) {
        energy = 0.6;
    }

    // Simple darw setup: fixed amount of shapes with small x offset, in the middle of steh screen
    const count = 12;
    const margin = 10;
    const y = height / 2;

    // Draw these shapes
    for (let i = 0; i < count; i++) {
        // Simple interpolation
        const interplt = i / (count - 1);
        // Center X coordinate (y is same for all)
        const x = lerp(margin, width - margin, interplt);

        // Simple rotation and size setup
        const rot = sin(frameCount * 0.03 + i) * 0.6;
        const size = lerp(height * 0.15, height * 0.75, 0.5 + 0.5 * sin(frameCount * 0.05 + i));

        push();
        // Rotate and fraw
        translate(x, y);
        rotate(rot);

        drawShape(voiceState.shape, size);
        pop();
    }

    // UI update
    fill(255);
    noStroke();
    textSize(12);
    textAlign(LEFT, BOTTOM);
    text(`bg=${voiceState.bg}, shape=${voiceState.shape}`, 10, height - 8);
}

function drawShape(shape, size) {
    if (shape === 'square') {
        rectMode(CENTER);
        rect(0, 0, size, size);
        return;
    }

    if (shape === 'circle') {
        ellipse(0, 0, size, size);
        return;
    }

    // Number of sides, based on command
    const sides = (shape === 'triangle') ? 3 : (shape === 'pentagon') ? 5 : 4;

    // Draw shape using vertexrs
    beginShape();
    const r = size / 2;

    for (let i = 0; i < sides; i++) {
        // Find angle between vertices
        const a = -HALF_PI + i * TWO_PI / sides;
        // Draw vertex using cartesian converseion
        vertex(cos(a) * r, sin(a) * r);
    }

    endShape(CLOSE);
}