# Bhaswara AI Service

This service provides pronunciation scoring and language metadata for the Bhaswara learning platform.

## Endpoints

- `GET /health`
- `GET /languages`
- `POST /score`

## Score payload

```json
{
  "target": "halo",
  "spoken": "halo",
  "language": "sunda"
}
```

## Local run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

## Future production roadmap

- integrate Whisper or custom regional language models
- add true audio waveform analysis and confidence scoring
- store score history for longitudinal progress tracking
- add model versioning and A/B experiments
