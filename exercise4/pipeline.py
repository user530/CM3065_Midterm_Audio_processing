from dsp.audio import preprocess_audio, to_int16_wav_bytes
from dsp.noise import denoise_pipeline
from asr.vosk_asr import transcribe_int16_wav


def transcribe_wav_path(
    wav_path: str,
    model,
    *,
    target_sr: int,
    use_denoise: bool = True,
) -> str:
    '''
    Full processing pipeline for a single wav file:
    preprocess -> optional denoise -> int16 bytes -> Vosk transcribe
    '''
    audio, samplerate = preprocess_audio(wav_path, target_sr=target_sr, normalize=True)

    # Optional noise processing
    if use_denoise:
        audio = denoise_pipeline(audio, freq=samplerate, use_bandpass=True, use_gate=True)

    # Cast to bytes and pass to the ASR
    int16_bytes = to_int16_wav_bytes(audio)

    return transcribe_int16_wav(model, int16_bytes, samplerate)