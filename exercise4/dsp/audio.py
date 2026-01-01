import numpy as np
import soundfile as sf
import numpy as np

def load_audio(file_path: str) -> tuple[np.ndarray, int]:
    '''
    Load asset audio file.

    Returns:
        - audio - np.ndarray - either mono (N, ) or multi-channel (N, C);
        - samplerate - int - sample rate.
    '''
    audio, samplerate = sf.read(file_path, always_2d=False)

    # Convert to float32 for uniform data and smoother processing next
    audio = np.asarray(audio, dtype=np.float32)

    return audio, samplerate


def ensure_mono(audio: np.ndarray) -> np.ndarray:
    '''
    Convert audio to mono (average channels).
    '''
    # Skip audio fole that is already mono
    if audio.ndim == 1:
        return audio

    # Transform multi channel audio to mono
    mono = np.mean(audio, axis=1, dtype=np.float32)

    return mono


def _resample_linear(audio: np.ndarray, original_sr: int, target_sr: int) -> np.ndarray:
    '''
    Simple helper to resample audio using linear interpolation.
    '''
    # Skip if already required samplerate
    if original_sr == target_sr:
        return audio.astype(np.float32, copy=False)

    # Calculate required number of samples
    duration = len(audio) / float(original_sr)
    n_samples = int(round(duration * target_sr))

    # Time axes for original and target audio
    t_origal = np.linspace(0.0, duration, num=len(audio), endpoint=False)
    t_target = np.linspace(0.0, duration, num=n_samples, endpoint=False)

    # Interpolate original to target
    y = np.interp(t_target, t_origal, audio).astype(np.float32)

    return y


def _normalize_peak(audio: np.ndarray, target_peak: float = 0.99) -> np.ndarray:
    '''
    Normalize audio around target peak to prevent very quite/loud files affecting performance
    '''
    # Original peak
    peak = float(np.max(np.abs(audio)) + 1e-9)

    return (target_peak * (audio / peak)).astype(np.float32)


def preprocess_audio(file_path: str, target_sr: int, normalize: bool = True) -> tuple[np.ndarray, int]:
    '''
    Full audio preprocess pipeline:
    1) Load audio;
    2) Ensure mono;
    3) Resample to target samplerate;
    4) Optional peak normalization.

    Returns:
        samples (mono float32), sample_rate (target_sr)
    '''
    # Load
    audio, samplerate = load_audio(file_path)
    # Transform to mono
    mono = ensure_mono(audio)
    # Resample
    resampled = _resample_linear(mono, samplerate, target_sr)

    # Optional normalizaiton
    if normalize:
        resampled = _normalize_peak(resampled)

    return resampled, target_sr