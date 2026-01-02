from dataclasses import dataclass
import jiwer
from config import ASSETS_DIR, LANG_FOLDERS, VOSK_SR
import os
from pipeline import transcribe_wav_path
from collections import defaultdict


# Setup jiwer to normalize texts by lovercasing, trmming, removing punctuation and slitting text into word tokens.
DEFAULT_TRANSFORM = jiwer.Compose([
    jiwer.ToLowerCase(),
    jiwer.RemovePunctuation(),
    jiwer.RemoveMultipleSpaces(),
    jiwer.Strip(),
    jiwer.ReduceToListOfListOfWords(),
])


@dataclass
class WERResult:
    '''
    Simple dataclass for the result of the WER: S - substitutions, D - deletions, I - insterts, N - num of words
    '''
    S: int
    D: int
    I: int
    N: int
    wer: float


def wer_details(reference_text: str = '', hypothesis_text: str = '') -> WERResult:
    '''
    Simple wrapper around jiwer to calculate WER between ASR output (hypotheises) and original transcript (reference)
    '''
    # Calculate word error rate between 2 strings
    res = jiwer.process_words(
        reference_text, 
        hypothesis_text,
        reference_transform=DEFAULT_TRANSFORM,
        hypothesis_transform=DEFAULT_TRANSFORM,
    )

    # JIWER returns detailed information as: hits/subs/dels/ins
    S = res.substitutions
    D = res.deletions
    I = res.insertions
    N = res.hits + res.substitutions + res.deletions

    return WERResult(S=S, D=D, I=I, N=N, wer=res.wer)


# Transcript key in form of (language, filename)
Transcript_Key = tuple[str, str]


def evaluate_transcriptions(
    hypotheses: dict[Transcript_Key, str],
    references: dict[Transcript_Key, str],
) -> list[dict]:
    '''
    Function to compare ASR outputs for wav files (hypotheses) and their original transcripts (references)
    returns: list of per-sample result dicts
    '''
    rows = []

    # Find files that has both wav/ASR result and transcription
    common_keys = sorted(set(references.keys()) & set(hypotheses.keys()))

    # For each common key
    for key in common_keys:
        # Extract language/filename
        lang, filename = key
        # Get reference nad hypothesis texts
        ref = references[key]
        hyp = hypotheses[key]

        # Calculate WERResult for the file ASR pipeline
        res = wer_details(ref, hyp)

        # Store result statistic for the file
        rows.append({
            'lang': lang,
            'filename': filename,
            'ref': ref,
            'hyp': hyp,
            'S': res.S,
            'D': res.D,
            'I': res.I,
            'N': res.N,
            'wer': res.wer,
        })

    # Log audio files missing transcripts in CSV file
    missing_ref = sorted(set(hypotheses.keys()) - set(references.keys()))
    if missing_ref:
        print(f'Evaluation Warning: {len(missing_ref)} files missing reference transcriptions. Example: {missing_ref[:3]}')

    # Log transcripts in CSV files that doesnt have associated wav
    missing_hyp = sorted(set(references.keys()) - set(hypotheses.keys()))
    if missing_hyp:
        print(f'Evaluation Warning: {len(missing_hyp)} reference transcriptions have no wav fiels. Example: {missing_hyp[:3]}')

    return rows


def build_hypotheses_from_assets_vosk(
    models: dict[str, object],
    *,
    assets_dir: str = ASSETS_DIR,
    target_sr: int = VOSK_SR,
    use_denoise: bool = True,
) -> dict[Transcript_Key, str]:
    '''
    Build hypotheses dict by scanning lang assets dir and transcribing all wavs inside.
    Smae key format as transcriptions.csv: (lang, file_name).
    '''
    hypotheses: dict[Transcript_Key, str] = {}

    # Iterate over each supported language
    for lang in models.keys():
        # Get folder name
        folder = LANG_FOLDERS[lang]
        # Construct directory for the said language
        lang_dir = os.path.join(assets_dir, folder)

        # Soft guard clause - just log warning message and skip
        if not os.path.isdir(lang_dir):
            print(f'Warning: assets dir missing for {lang}: {lang_dir}')
            continue

        # Loop over all files
        for name in sorted(os.listdir(lang_dir)):
            # Skip not wav files
            if not name.lower().endswith('.wav'):
                continue

            # Path to the wav file
            wav_path = os.path.join(lang_dir, name)
            # Construct hypothesis dict key
            key = (lang, name)

            # Pick model for the selected language
            model = models[lang]

            # Process wav file through transformation/processing/ASR pipiline 
            hypothesis = transcribe_wav_path(
                wav_path,
                model,
                target_sr=target_sr,
                use_denoise=use_denoise,
            ) or ''

            hypotheses[key] = hypothesis.strip()

    return hypotheses


def aggregate_corpus(rows: list[dict]) -> dict:
    S = sum(r['S'] for r in rows)
    D = sum(r['D'] for r in rows)
    I = sum(r['I'] for r in rows)
    N = sum(r['N'] for r in rows) or 1

    return {'S': S, 'D': D, 'I': I, 'N': N, 'wer': (S + D + I) / N}


def aggregate_by_lang(rows: list[dict]) -> dict[str, dict]:
    buckets = defaultdict(list)

    for r in rows:
        buckets[r['lang']].append(r)

    return {lang: aggregate_corpus(items) for lang, items in buckets.items()}