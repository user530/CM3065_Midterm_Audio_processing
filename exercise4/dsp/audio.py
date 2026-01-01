import numpy as np
import soundfile as sf

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