from config import LANG_FOLDERS, ASSETS_DIR
import os
import glob

def find_any_wav(lang_key: str) -> str:
    '''
    Fetch one WAV file from the assets/<LANG_FOLDER> for specified folder.
    Raises exception if folder doesnt contain no wavs.
    '''
    folder = LANG_FOLDERS[lang_key]
    wav_dir = os.path.join(ASSETS_DIR, folder)
    wav_files = glob.glob(os.path.join(wav_dir, '*.wav'))
    wavs = sorted(wav_files)

    # Guard clause
    if not wavs:
        raise FileNotFoundError(f'No WAV files found in: {wav_dir}')

    return wavs[0]


def log_audio_meta(label: str, audio, samplerate: int):
    '''
    Print basic meta information about loaded audio file (audio, samplerate).
    '''
    duration_sec = len(audio) / float(samplerate) if samplerate > 0 else 0.0

    print(f'Audio file: {label}')
    print(f'   sample rate: {samplerate} Hz')
    print(f'   shape: {audio.shape}')
    print(f'   duration: {duration_sec:.2f} s')