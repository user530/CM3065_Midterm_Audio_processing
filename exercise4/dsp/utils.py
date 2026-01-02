from config import LANG_FOLDERS, ASSETS_DIR, REPORT_CSV_PATH, LANG_DISPLAY
import os
import glob
from pathlib import Path
import csv

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


def list_lang_wavs(lang_key: str) -> list[str]:
    '''
    Return all WAV files for a language key in specifid assets/<LANG_FOLDER>.
    '''
    lang_folder = LANG_FOLDERS[lang_key]
    wav_dir = os.path.join(ASSETS_DIR, lang_folder)
    wav_files = glob.glob(os.path.join(wav_dir, '*.wav'))
    wavs = sorted(wav_files)

    # Guard clause
    if not wavs:
        raise FileNotFoundError(f'No WAV files found in: {wav_dir}')

    return wavs



def write_results_table(rows: list[dict]) -> None:
    '''
    Writes report table with columns: Language, File, WER (%)
    '''
    out = Path(REPORT_CSV_PATH)
    out.parent.mkdir(parents=True, exist_ok=True)

    table_rows = []
    
    # Iterate over each result row
    for row in rows:
        # Store report data
        lang_key = row['lang']
        table_rows.append({
            'Language': LANG_DISPLAY.get(lang_key, lang_key),
            'File': row['filename'],
            'WER': f"{row['wer'] * 100:.1f}%",
            'Reference': row['ref'],
            'Hypothesis': row['hyp'],
        })

    # Write to file
    with out.open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['Language', 'File', 'WER', 'Reference', 'Hypothesis'])
        writer.writeheader()
        writer.writerows(table_rows)