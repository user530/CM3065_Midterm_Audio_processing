import os
from config import LANG_FOLDERS, MODELS_DIR
from vosk import Model

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

