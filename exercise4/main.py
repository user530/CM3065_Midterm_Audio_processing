from config import ASSETS_DIR, MODELS_DIR, TRANSCRIPT_CSV_PATH
from asr.vosk_asr import load_model
from eval.manifest import load_transcriptions
from eval.wer import (
    build_hypotheses_from_assets_vosk,
    evaluate_transcriptions,
    aggregate_corpus,
    aggregate_by_lang,
)


def main():
    print('=== Exercise 4 checks ===')
    print(f'Assets folder: {ASSETS_DIR}')
    print(f'Models folder: {MODELS_DIR}')

    print(TRANSCRIPT_CSV_PATH)

    # Load references
    references = load_transcriptions(TRANSCRIPT_CSV_PATH)

    # Load models once
    models = {lang: load_model(lang) for lang in ['en', 'it', 'es']}

    # Build hypotheses dict by running ASR over assets
    hypotheses = build_hypotheses_from_assets_vosk(models, use_denoise=False)

    # 4) Compare ASR output to transcriptions
    rows = evaluate_transcriptions(hypotheses, references)

    # 5) Agregate results across across all languages and grouping by language
    overall = aggregate_corpus(rows)
    by_lang = aggregate_by_lang(rows)

    # Print general aggregation
    print('\n=== Summary ===')
    print(f'Overall WER: {overall['wer']:.4f}  (S={overall['S']}, D={overall['D']}, I={overall['I']}, N={overall['N']})')

    # Print language specific agregation
    for lang, s in sorted(by_lang.items()):
        print(f'{lang.upper()} WER: {s['wer']:.4f}  (S={s['S']}, D={s['D']}, I={s['I']}, N={s['N']})')

    print(f'\nScored samples: {len(rows)}')
    print('Done.')



if __name__ == '__main__':
    main()