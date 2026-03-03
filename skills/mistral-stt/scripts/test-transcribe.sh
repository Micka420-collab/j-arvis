#!/usr/bin/env bash
# Test rapide du module Mistral STT
# Enregistre 5 secondes depuis le micro par défaut et transcrit via Mistral

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_FILE="/tmp/jarvis-stt-test-$(date +%s).wav"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🎙️  Jarvis STT — Test de transcription${NC}"
echo "─────────────────────────────────────"

# Vérifier la clé API
if [ -z "${MISTRAL_API_KEY:-}" ]; then
  # Essayer de charger depuis ~/.openclaw/.env
  if [ -f "$HOME/.openclaw/.env" ]; then
    source "$HOME/.openclaw/.env"
  fi
fi

if [ -z "${MISTRAL_API_KEY:-}" ]; then
  echo -e "${RED}❌ MISTRAL_API_KEY non configurée${NC}"
  echo "   Ajoutez MISTRAL_API_KEY dans ~/.openclaw/.env"
  exit 1
fi

# Vérifier sox
if ! command -v sox &>/dev/null; then
  echo -e "${RED}❌ sox non installé${NC}"
  echo "   macOS: brew install sox"
  echo "   Linux: sudo apt install sox"
  exit 1
fi

echo -e "${YELLOW}⏺  Enregistrement en cours (5 secondes)...${NC}"
echo "   Parlez maintenant !"
echo ""

# Enregistrer avec VAD (arrêt sur silence ou 10 secondes max)
sox -d -r 16000 -c 1 -b 16 "$TMP_FILE" \
  silence 1 0.1 35d 1 1.5 35d \
  trim 0 10 2>/dev/null || \
sox -d -r 16000 -c 1 -b 16 "$TMP_FILE" trim 0 5 2>/dev/null || {
  echo -e "${RED}❌ Impossible d'enregistrer depuis le micro${NC}"
  exit 1
}

# Vérifier que le fichier n'est pas vide
FILE_SIZE=$(stat -f%z "$TMP_FILE" 2>/dev/null || stat -c%s "$TMP_FILE" 2>/dev/null || echo 0)
if [ "$FILE_SIZE" -lt 1000 ]; then
  echo -e "${RED}❌ Fichier audio trop petit (${FILE_SIZE} octets) — aucun son détecté${NC}"
  rm -f "$TMP_FILE"
  exit 1
fi

echo -e "${BLUE}📤 Envoi à Mistral STT...${NC}"

# Appel API Mistral
RESPONSE=$(curl -s -X POST \
  "https://api.mistral.ai/v1/audio/transcriptions" \
  -H "Authorization: Bearer ${MISTRAL_API_KEY}" \
  -F "file=@${TMP_FILE};type=audio/wav" \
  -F "model=${MISTRAL_STT_MODEL:-mistral-stt}" \
  -F "language=${MISTRAL_STT_LANGUAGE:-fr}" \
  -F "response_format=json")

# Nettoyage
rm -f "$TMP_FILE"

# Parser la réponse
if echo "$RESPONSE" | grep -q '"text"'; then
  TEXT=$(echo "$RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('text',''))" 2>/dev/null || \
         echo "$RESPONSE" | grep -o '"text":"[^"]*"' | cut -d'"' -f4)

  echo ""
  echo -e "${GREEN}✅ Transcription réussie :${NC}"
  echo -e "   \"${TEXT}\""
  echo ""
  echo -e "${GREEN}Jarvis a bien entendu votre commande !${NC}"
else
  echo -e "${RED}❌ Erreur API Mistral :${NC}"
  echo "$RESPONSE" | python3 -c "import json,sys; data=json.load(sys.stdin); print(data.get('message', data.get('error', str(data))))" 2>/dev/null || echo "$RESPONSE"
  exit 1
fi
