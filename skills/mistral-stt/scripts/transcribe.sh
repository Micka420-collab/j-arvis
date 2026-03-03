#!/usr/bin/env bash
# Transcrit un fichier audio via l'API Mistral STT
# Usage: transcribe.sh <fichier.wav> [--language fr] [--model mistral-stt]

set -euo pipefail

AUDIO_FILE="${1:-}"
LANGUAGE="${MISTRAL_STT_LANGUAGE:-fr}"
MODEL="${MISTRAL_STT_MODEL:-mistral-stt}"
OUTPUT_FILE=""

# Parser les arguments
shift 2>/dev/null || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --language|-l) LANGUAGE="$2"; shift 2 ;;
    --model|-m)    MODEL="$2"; shift 2 ;;
    --out|-o)      OUTPUT_FILE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [ -z "$AUDIO_FILE" ]; then
  echo "Usage: $0 <fichier.wav> [--language fr] [--model mistral-stt] [--out result.txt]"
  exit 1
fi

if [ ! -f "$AUDIO_FILE" ]; then
  echo "❌ Fichier introuvable: $AUDIO_FILE"
  exit 1
fi

# Charger la clé API
if [ -z "${MISTRAL_API_KEY:-}" ] && [ -f "$HOME/.openclaw/.env" ]; then
  source "$HOME/.openclaw/.env"
fi

if [ -z "${MISTRAL_API_KEY:-}" ]; then
  echo "❌ MISTRAL_API_KEY non configurée"
  exit 1
fi

# Déterminer le type MIME
EXT="${AUDIO_FILE##*.}"
case "$EXT" in
  wav)  MIME="audio/wav" ;;
  mp3)  MIME="audio/mpeg" ;;
  m4a)  MIME="audio/mp4" ;;
  ogg)  MIME="audio/ogg" ;;
  flac) MIME="audio/flac" ;;
  webm) MIME="audio/webm" ;;
  *)    MIME="audio/wav" ;;
esac

# Appel API
RESPONSE=$(curl -s -X POST \
  "https://api.mistral.ai/v1/audio/transcriptions" \
  -H "Authorization: Bearer ${MISTRAL_API_KEY}" \
  -F "file=@${AUDIO_FILE};type=${MIME}" \
  -F "model=${MODEL}" \
  -F "language=${LANGUAGE}" \
  -F "response_format=json")

# Parser et afficher
TEXT=$(echo "$RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('text',''))" 2>/dev/null || \
       echo "$RESPONSE" | grep -o '"text":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TEXT" ]; then
  if [ -n "$OUTPUT_FILE" ]; then
    echo "$TEXT" > "$OUTPUT_FILE"
    echo "✅ Transcription sauvegardée: $OUTPUT_FILE"
  else
    echo "$TEXT"
  fi
else
  echo "❌ Transcription échouée: $RESPONSE" >&2
  exit 1
fi
