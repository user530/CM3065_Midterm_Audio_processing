let ui = {};
let mode = 'captcha';
let captchaIsPlaying = false;
let viz = { canvas: null, fft: null };

function setup() {
    setupVizualizer();

    wireModeButtons();
    wireCaptchaUI();

    setStatus('Status: UI loaded. Click "New captcha" to begin.');
    setDebug('ready');
}

function draw() {
    renderWaveform();
}

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

    // Handlers
    ui.btnCaptchaNew.mousePressed(async () => {
        await userStartAudio();
        ui.btnCaptchaPlay.removeAttribute('disabled');
        ui.btnCaptchaStop.removeAttribute('disabled');
        ui.captchaResult.html('Result: —');
        setStatus('Status: New captcha generated.');
    });

    ui.btnCaptchaPlay.mousePressed(async () => {
        await userStartAudio();

        // Toggle flag
        captchaIsPlaying = true;

        const vizLabel = select('#vizLabel')
        vizLabel.html('playing');

        setStatus('Status: Play captcha (placeholder).');
        setStatus('Status: Play captcha.');
    });

    ui.btnCaptchaStop.mousePressed(async () => {
        await userStartAudio();

        // Toggle flag
        captchaIsPlaying = false;

        const vizLabel = select('#vizLabel')
        vizLabel.html('stopped');

        setStatus('Status: Stop captcha.');
    });

    ui.btnCaptchaSubmit.mousePressed(() => {
        const val = (ui.captchaInput.value() || '').trim();

        // Guard clause
        if (!val) {
            ui.captchaResult.html('Result: Please type the captcha.');
            setStatus('Status: Empty input.');
            return;
        }

        ui.captchaResult.html('Result: <PLACEHOLDER>');
        setStatus('Status: Submitted <PLACEHOLDER>.');
    });

    ui.btnCaptchaClear.mousePressed(() => {
        ui.captchaInput.value('');
        ui.captchaResult.html('Result: —');

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
    viz.canvas = createCanvas(700, 110);
    viz.canvas.parent('captchaViz');

    viz.fft = new p5.FFT(0.85, 1024);
}

function renderWaveform() {
    background(255);

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

    // Draw waveform
    for (let i = 0; i < wave.length; i++) {
        const x = map(i, 0, wave.length - 1, 0, width);
        const y = map(wave[i], -1, 1, height - 10, 10);
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