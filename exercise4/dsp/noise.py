import numpy as np
from scipy.signal import butter, lfilter


def _apply_bandpass_filter(
    audio: np.ndarray,
    freq: int,
    lowcut: float = 100.0,
    highcut: float = 7500.0,
    order: int = 4
) -> np.ndarray:
    '''
    Butterworth band-pass filter.

    It should keep most speech energy and reduce:
    - very low frequencies: mic rumble, wind, mic handling noise
    - very high frequencies: hiss and some background noise
    '''
    # Calculate low-high range based on maximal available(Nyquist) frequency and low-/high- cut frequencies
    nyq_freq = 0.5 * freq
    low = lowcut / nyq_freq
    high = highcut / nyq_freq

    # Clamp frequencies (guard against invalid cutoffs)
    low = max(min(low, 0.99), 1e-5)
    high = max(min(high, 0.99), low + 1e-5)

    # Butterworth transfer functions
    b, a = butter(order, [low, high], btype='band')

    # Apply them and return filtered audio
    filtered_audio = lfilter(b, a, audio).astype(np.float32)

    return filtered_audio


def _apply_noise_gate(
    audio: np.ndarray,
    freq: int,
    frame_ms: float = 20.0,
    gate_db: float = -35.0,
    attenuation_mult: float = 0.2
) -> np.ndarray:
    '''
    Simple noise gate (reduce noise beloow threshold) using per-frame root mean square (RMS).
    This function:
    - Splits audio into short frames (~20 ms)
    - Compute RMS per frame
    - Estimate 'noise floor' from the lower percentile RMS
    - If frame RMS is close to noise floor, reduce it (but not reduce to zero)

    gate_db:
        a fixed minimum threshold in dB relative to full scale (1.0 ~ 0 dBfreq)
    attenuation_mult:
        frames below threshold get multiplied by this value (reduction)
    '''
    # Calculate padded length, required for 
    frame_len = max(int(freq * (frame_ms / 1000.0)), 1)
    n_frames = int(np.ceil(len(audio) / frame_len))
    padded_len = n_frames * frame_len

    # Pad audio and split it into frames
    xp = np.pad(audio, (0, padded_len - len(audio)))
    frames = xp.reshape(n_frames, frame_len)

    # Calculate RMS for each frame
    rms = np.sqrt(np.mean(frames**2, axis=1) + 1e-12)

    # Estimate noise floor as a low percentile
    noise_floor = np.percentile(rms, 20)

    # Convert gate in decibele relative threshold (dBFS) into linear value
    gate_lin = 10 ** (gate_db / 20.0)

    # Calculate conservative threshold using noise floor + fixed gate
    threshold = max(noise_floor * 1.5, gate_lin)

    # Prepare gains and reduce ones that bellow RMS
    gains = np.ones_like(rms, dtype=np.float32)
    gains[rms < threshold] = attenuation_mult

    # Apply gains per frame and clip it before return
    gated = (frames.T * gains).T.reshape(-1)

    return gated[:len(audio)].astype(np.float32)


def denoise_pipeline(
    audio: np.ndarray,
    freq: int,
    use_bandpass: bool = True,
    use_gate: bool = True
) -> np.ndarray:
    '''
    Main denoising pipeline, allows simple customization.
    '''
    # Raw audio
    res = audio.astype(np.float32, copy=False)

    # Apply butterworth filter if applicable
    if use_bandpass:
        res = _apply_bandpass_filter(res, freq=freq)

    # Apply noise gae if applicable
    if use_gate:
        res = _apply_noise_gate(res, freq=freq)

    return res