import os
from config import LANG_FOLDERS, MODELS_DIR
from vosk import Model, KaldiRecognizer
import json

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


def transcribe_int16_wav(model, int16_bytes: bytes, samplerate: int) -> str:
    '''
    Feed 16 bit audio bytes (instead of streaming) into Vosk recognizer and return transcribed text.
    '''
    recognizer = KaldiRecognizer(model, samplerate)

    # "Emulate" streaming  by chunking audio bytes (4kb)
    CHUNK_SIZE = 4 * 1024
    for i in range(0, len(int16_bytes), CHUNK_SIZE):
        recognizer.AcceptWaveform(int16_bytes[i:i + CHUNK_SIZE])

    # Read result and extract text content (transcription)
    result = json.loads(recognizer.FinalResult())

    return result.get('text', '').strip()