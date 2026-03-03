#!/usr/bin/env bash
# Liste les dispositifs audio disponibles pour la capture microphone

echo "🎙️  Dispositifs audio disponibles"
echo "──────────────────────────────────"

if command -v arecord &>/dev/null; then
  echo ""
  echo "📋 ALSA (arecord -l) :"
  arecord -l 2>/dev/null || echo "  (aucun)"
fi

if command -v sox &>/dev/null; then
  echo ""
  echo "📋 Sox — dispositif par défaut :"
  sox --version 2>&1 | head -1
  echo "  sox -d (micro système par défaut)"
fi

if command -v ffmpeg &>/dev/null; then
  echo ""
  echo "📋 FFmpeg — dispositifs disponibles :"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    ffmpeg -f avfoundation -list_devices true -i "" 2>&1 | grep "AVFoundation\|audio" | head -20
  else
    ffmpeg -f alsa -list_devices true -i "" 2>&1 | head -20 || true
  fi
fi

echo ""
echo "📌 Configuration dans openclaw.json :"
echo '   "capture": { "device": "hw:1,0" }   ← Linux ALSA (remplacez par votre device)'
echo '   "capture": { "device": ":1" }        ← macOS AVFoundation (index audio)'
echo '   "capture": {}                         ← Micro système par défaut (recommandé)'
