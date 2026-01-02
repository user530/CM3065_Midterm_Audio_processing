import os
import csv


def load_transcriptions(csv_path: str) -> dict[tuple[str, str], str]:
    '''
    Helper function to load transcriptions file to compare WER results to original messages.
    We use both language AND filename as the key, so wavs with same name didnt clash.

    Returns:
        dict keyed by (language, file_name) -> transcript
    '''
    # File existance guard clause
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f'Manifest file not found: `{csv_path}`.\n')
    
    # Type guard clause
    if not os.path.isfile(csv_path):
        raise FileNotFoundError(f'Manifest path is not a file: `{csv_path}`')
    
    transcript_map: dict[tuple[str, str], str] = {}

    # Read CSV file
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)

            # Header guard clause
            if reader.fieldnames is None:
                raise ValueError(f'Manifest `{csv_path}` does not appear to have a header row.')

            # Validate expected columns
            expected = {'language', 'file_name', 'transcript'}

            # Columns guard clause
            if not expected.issubset(set(reader.fieldnames or [])):
                raise ValueError(f'transcriptions.csv must contain columns {sorted(expected)}, found {reader.fieldnames}')

            # If columns fine, parse rows
            for row in reader:
                lang = (row['language'] or '').strip().lower()
                file_name = (row['file_name'] or '').strip()
                transcript = (row['transcript'] or '').strip()

                # Skip invalid row values
                if not lang or not file_name:
                    continue

                # Map lang/filename to transcript
                transcript_map[(lang, file_name)] = transcript

    except Exception as err:
        raise TypeError(f'CSV parsing error reading `{csv_path}`.\nDetails: {err}')

    return transcript_map