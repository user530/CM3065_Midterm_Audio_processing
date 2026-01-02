from config import ASSETS_DIR, MODELS_DIR, TRANSCRIPT_CSV_PATH, LANG_FOLDERS
from asr.vosk_asr import load_model
from eval.manifest import load_transcriptions
from eval.wer import (
    build_hypotheses_from_assets_vosk,
    evaluate_transcriptions,
    aggregate_corpus,
    aggregate_by_lang,
    print_sample_debug,
)
import argparse
import vosk


def parse_args():
    parser = argparse.ArgumentParser(description='Exercise 4 ASR system + WER evaluation')

    # A list of languages to experiment
    parser.add_argument(
        '--langs',
        nargs='+',
        default=['en', 'it', 'es'],
        help=f'Languages to test (choices: {list(LANG_FOLDERS.keys())})',
    )

    # Toggle sound processing feature
    parser.add_argument(
        '--useDenoise',
        action='store_true',
        help='Enable denoise pipeline (bandpass + noise gate)',
    )

    # Toggle extended log
    parser.add_argument(
        '--debugASR',
        action='store_true',
        help='Print reference and hypothesis for each evaluated audio file',
    )

    # Toggle extended VOSK log
    parser.add_argument(
        '--debugVosk',
        action='store_true',
        help='Print verbose VOSK log',
    )

    return parser.parse_args()


def main():
    args = parse_args()

    # Setup Vosk log level (default silent)
    vosk.SetLogLevel(1 if args.debugVosk else -1)

    # Validate langs
    langs = [lang.strip().lower() for lang in args.langs]
    invalid = [lang for lang in langs if lang not in LANG_FOLDERS]

    # Guard clause for supported langueges
    if invalid:
        raise ValueError(f'Unknown languages: {invalid}. Allowed: {list(LANG_FOLDERS.keys())}')

    print('=== Exercise 4 checks ===')
    print(f'Assets folder: {ASSETS_DIR}')
    print(f'Models folder: {MODELS_DIR}')
    print(f'Languages: {langs}')
    print(f'Denoise usage: {args.useDenoise}')
    print(f'Log ASR per sample: {args.debugASR}')
    print(f'Log VoskApi messages: {args.debugVosk}')

    # Load references
    references = load_transcriptions(TRANSCRIPT_CSV_PATH)

    # Load models once
    models = {lang: load_model(lang) for lang in langs}

    # Build hypotheses dict by running ASR over assets
    hypotheses = build_hypotheses_from_assets_vosk(models, use_denoise=args.useDenoise)

    # 4) Compare ASR output to transcriptions
    rows = evaluate_transcriptions(hypotheses, references)

    # Print debug per sample
    if args.debugASR:
        print_sample_debug(rows)

    # 5) Agregate results across across all languages and grouping by language
    overall = aggregate_corpus(rows)
    by_lang = aggregate_by_lang(rows)

    # Print general aggregation
    print('\n=== Summary ===')
    print(f"Overall WER: {overall['wer']:.4f}  (S={overall['S']}, D={overall['D']}, I={overall['I']}, N={overall['N']})")

    # Print language specific agregation
    for lang, s in sorted(by_lang.items()):
        print(f"{lang.upper()} WER: {s['wer']:.4f}  (S={s['S']}, D={s['D']}, I={s['I']}, N={s['N']})")

    print(f'\nScored samples: {len(rows)}')
    print('Done.')



if __name__ == '__main__':
    main()