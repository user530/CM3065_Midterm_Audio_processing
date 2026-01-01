from config import ASSETS_DIR, MODELS_DIR
from dsp.utils import find_any_wav, log_audio_meta
from dsp.audio import load_audio, ensure_mono
from asr.vosk_asr import load_model

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
        audio, samplerate = load_audio(lang_wav)

        # Transform to mono
        mono_audio = ensure_mono(audio)

        # Log metadata
        log_audio_meta(lang_wav, mono_audio, samplerate)

        # Load model
        print(f'Trying to load model for {lang.upper()} language...')

        model = load_model(lang)

        print(f'Model {lang.upper()} loaded - OK.')


    print('\nAudio files loaded. Models loaded. Application is ready for work!')

if __name__ == '__main__':
    main()