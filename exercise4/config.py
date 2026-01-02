import os

# Base directory of the exercise4 folder
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Folder for provided test files
ASSETS_DIR = os.path.join(BASE_DIR, 'assets')

# Folder for offline Vosk models
MODELS_DIR = os.path.join(BASE_DIR, 'models')

# Language folders map
LANG_FOLDERS = {
    'en': 'EN',
    'it': 'IT',
    'es': 'ES',
}

# Recommended Vosk sample rate, Hz
VOSK_SR = 16000

# Transcription file
TRANSCRIPT_CSV_PATH = os.path.join(BASE_DIR, 'transcriptions.csv')