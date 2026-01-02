from config import ASSETS_DIR, MODELS_DIR, VOSK_SR
from dsp.utils import find_any_wav, log_audio_meta
from dsp.audio import load_audio, ensure_mono, preprocess_audio, to_int16_wav_bytes
from asr.vosk_asr import load_model, transcribe_int16_wav
from dsp.noise import denoise_pipeline

def main():
    print('=== Exercise 4 checks ===')
    print(f'Assets folder: {ASSETS_DIR}')
    print(f'Models folder: {MODELS_DIR}')

    # Check all languages
    for lang in ['en', 'it', 'es']:
        print(f'\n=== Language: {lang.upper()} ===')

        # Check wavs for the language
        lang_wav = find_any_wav(lang)

        print(f'{lang.upper()} example wav: {lang_wav}')

        # Load sample wav
        raw_audio, raw_sr = load_audio(lang_wav)

        # Transform to mono
        raw_mono = ensure_mono(raw_audio)

        # Log raw file metadata
        log_audio_meta(lang_wav, raw_mono, raw_sr)

        # Preprocess audio
        prcsd_audio, prcsd_sr = preprocess_audio(lang_wav, target_sr=VOSK_SR, normalize=True)

        # Log processed file metadata
        prcsd_label = lang_wav + f'(preprocessed @ ${VOSK_SR})'
        log_audio_meta(prcsd_label, prcsd_audio, prcsd_sr)

        # Load model
        print(f'Trying to load model for {lang.upper()} language...')
        model = load_model(lang)
        print(f'Model {lang.upper()} loaded - OK.')

        # Apply noise handling
        USE_DENOISE = True
        if USE_DENOISE:
            prcsd_audio = denoise_pipeline(prcsd_audio, freq=prcsd_sr, use_bandpass=True, use_gate=True)

        # Cast float to int16 byte stream
        int16_wav = to_int16_wav_bytes(prcsd_audio)

        # Get transcription
        transcription = transcribe_int16_wav(model, int16_wav, prcsd_sr)

        print(f'ASR transcription for {lang_wav}: {transcription}')


    print('\nAudio files loaded. Models loaded. Test ASR completed. Application is ready for work!')

if __name__ == '__main__':
    main()