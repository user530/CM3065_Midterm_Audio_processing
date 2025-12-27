let ui = {};
let mode = 'captcha';
let captchaIsPlaying = false;
let viz = { canvas: null, fft: null };

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
}

function setup() {
    setupVizualizer();
    
    wireModeButtons();
    wireCaptchaUI();
    
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
    background(255);

    if(mode !== 'captcha') return;
    renderWaveform();
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
}

function setMode(next) {
    mode = next;
    
    // Show exercise panel based on mode
    ui.panelCaptcha.style('display', mode === 'captcha' ? 'block' : 'none');
    ui.panelVisual.style('display', mode === 'visual' ? 'block' : 'none');
    ui.panelVoice.style('display', mode === 'voice' ? 'block' : 'none');
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
    const parentEl = document.getElementById('captchaViz');
    const rect = parentEl.getBoundingClientRect();
    resizeCanvas(Math.floor(rect.width), Math.floor(rect.height));
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