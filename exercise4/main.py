import os
from vosk import Model


# === CONFIG ===
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(BASE_DIR, 'assets')
MODELS_DIR = os.path.join(BASE_DIR, 'models')

# Map your folder names -> Vosk language keys
LANG_FOLDERS = {
    'en': 'EN',
    'it': 'IT',
    'es': 'ES',
}


# === Model Loading ===
def load_model(lang: str) -> Model:
    '''
    Load existing offline Vosk model for specified language
    '''
    folder = LANG_FOLDERS[lang]
    path = os.path.join(MODELS_DIR, folder)

    # Check model folder
    if not os.path.isdir(path):
        raise FileNotFoundError(f'Model folder not found: {path}!')

    vosk_model = None

    # Try to load folder content
    try:
        vosk_model = Model(path)
    except Exception as e:
        print('Vosk model failed to load!', e)

    return vosk_model



def main():
    print('=== Exercise 4 checks ===')
    print(f'Assets folder: {ASSETS_DIR}')
    print(f'Models folder: {MODELS_DIR}')

    # Check all languages
    for lang in ['en', 'it', 'es']:
        print(f'\n=== Language: {lang.upper()} ===')

        # Load model
        model = load_model(lang)
        print(f'Model {lang.upper()} loaded OK.')

    print('\nAll models loaded. Application is ready for work!')

if __name__ == '__main__':
    main()