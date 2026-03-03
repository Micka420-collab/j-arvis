# 🎙️ Système Audio Arduino - Guide Complet

Ce guide explique comment configurer des **micros distants** avec Arduino Mega + ESP8266/ESP32 pour Jarvis.

## 📋 Matériel Requis

### Par nœud audio (par pièce)

| Composant | Quantité | Prix estimé | Lien exemple |
|-----------|----------|-------------|--------------|
| Arduino Mega 2560 | 1 | ~15€ | Amazon, AliExpress |
| ESP8266 (ESP-01) ou ESP32 | 1 | ~3-5€ | AliExpress |
| Microphone MAX4466 | 1 | ~2€ | Adafruit, Amazon |
| Amplificateur PAM8403 | 1 | ~2€ | AliExpress |
| Haut-parleur 3W 4Ω | 1 | ~3€ | Amazon |
| Breadboard + fils | 1 | ~5€ | Kit électronique |
| Alimentation 5V 2A | 1 | ~8€ | Amazon |

**Total par nœud: ~35-40€**

---

## 🔌 Schéma de Connexion

```
Arduino Mega 2560
├── ESP8266 (WiFi)
│   ├── VCC → 3.3V
│   ├── GND → GND
│   ├── TX → Pin 10 (SoftwareSerial RX)
│   └── RX → Pin 11 (SoftwareSerial TX) [avec diviseur 3.3V]
│
├── Microphone MAX4466
│   ├── VCC → 5V
│   ├── GND → GND
│   └── OUT → A0 (Analogique)
│
├── Amplificateur PAM8403
│   ├── VCC → 5V
│   ├── GND → GND
│   ├── L/R → Pin 9 (PWM)
│   └── Haut-parleur → Sortie amplificateur
│
├── LED Status → Pin 13 (built-in)
│
└── Bouton Poussoir → Pin 2 (avec pull-up interne)
```

### Diviseur de tension pour ESP8266 RX

L'ESP8266 fonctionne en 3.3V, l'Arduino en 5V. Il faut un diviseur:

```
Arduino Pin 11 ───[1kΩ]───┬───[2kΩ]─── GND
                          │
                     ESP8266 RX
```

---

## 🚀 Installation

### 1. Configurer l'Arduino IDE

1. Télécharger [Arduino IDE](https://www.arduino.cc/en/software)
2. Ajouter le support ESP8266:
   - Fichier → Préférences → URLs de gestionnaire de cartes
   - Ajouter: `http://arduino.esp8266.com/stable/package_esp8266com_index.json`
3. Outils → Type de carte → ESP8266 Boards → Generic ESP8266 Module

### 2. Installer les librairies

Dans l'Arduino IDE: Croquis → Inclure une bibliothèque → Gérer les bibliothèques

Rechercher et installer:
- `WiFiEsp` by bportaluri
- `SoftwareSerial` (inclus par défaut)

### 3. Téléverser le sketch

1. Ouvrir `arduino/jarvis_audio_node/jarvis_audio_node.ino`
2. Modifier la configuration WiFi:
   ```cpp
   const char* WIFI_SSID = "VotreWiFi";
   const char* WIFI_PASSWORD = "VotreMotDePasse";
   const char* JARVIS_HOST = "192.168.1.100"; // IP VM OpenClaw
   ```
3. Configurer le nœud:
   ```cpp
   const char* NODE_ID = "salon";      // Unique!
   const char* NODE_NAME = "Salon";     // Nom d'affichage
   const int NODE_ROOM_ID = 1;          // Numéro pièce
   ```
4. Sélectionner le port COM de l'Arduino Mega
5. Cliquer sur "Téléverser"

---

## 🎯 Utilisation

### Allumage

1. Brancher l'alimentation 5V
2. La LED clignote rapidement = connexion WiFi
3. LED fixe = connecté au serveur Jarvis

### Modes d'activation

| Méthode | Description |
|---------|-------------|
| **Bouton physique** | Appuyer sur le bouton pour parler |
| **Commande vocale** | "Jarvis, écoute [pièce]" depuis le dashboard |
| **Automatique** | Détection de parole continue (configurable) |

### LED Status

| Pattern | Signification |
|---------|---------------|
| Éteinte | Hors tension |
| Clignote rapide | Connexion WiFi en cours |
| Fixe | Connecté, en attente |
| Clignote lent | Enregistrement audio |
| Clignote 3x | Erreur |

---

## 🔧 Configuration Avancée

### Modifier le sample rate

Dans le sketch Arduino:
```cpp
const int SAMPLE_RATE = 8000;  // 8kHz suffisant pour la voix
// Ou 16000 pour meilleure qualité (plus de données)
```

### Ajuster la sensibilité du micro

Le MAX4466 a un potentiomètre. Tourner pour ajuster:
- Vers GND = moins sensible
- Vers VCC = plus sensible

### Portée WiFi

- En intérieur: ~20-30m
- Extérieur: ~50-100m
- Utiliser un ESP8266 avec antenne externe pour plus de portée

---

## 🖥️ Dashboard

Accéder au dashboard des micros:
```
http://votre-vm:3000/autonomy/audio
```

Fonctionnalités:
- 📡 Voir tous les nœuds connectés
- 📊 Statistiques temps réel (packets, signal WiFi)
- 🔴 Démarrer/arrêter l'enregistrement
- 🔊 Envoyer des messages TTS vers une pièce
- 🗺️ Visualisation des pièces

---

## 🐛 Dépannage

### L'Arduino ne se connecte pas au WiFi

```
[Vérifier]
├── SSID et mot de passe corrects ?
├── Réseau 2.4GHz (pas 5GHz) ?
├── Force du signal > -70 dBm ?
└── Firewall ouvert sur port 7777 ?
```

### Pas d'audio reçu par Jarvis

```
[Vérifier]
├── IP du serveur Jarvis correcte ?
├── Port 7777 accessible ?
├── Microphone bien connecté à A0 ?
└── Microphone alimenté en 5V ?
```

### Qualité audio mauvaise

```
[Solutions]
├── Réduire le sample rate à 8000 Hz
├── Vérifier les connexions (surtout masse)
├── Éloigner des sources d'interférence
└── Ajouter un condensateur 100µF sur l'alim
```

---

## 🔌 Architecture Réseau

```
┌─────────────────────────────────────────────────────────┐
│                        RÉSEAU WIFI                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐      ┌──────────────┐                │
│  │  Arduino     │      │  Arduino     │                │
│  │  Salon       │      │  Chambre     │                │
│  │  (Node 1)    │      │  (Node 2)    │                │
│  └──────┬───────┘      └──────┬───────┘                │
│         │                      │                        │
│         └──────────┬───────────┘                        │
│                    │                                     │
│              ┌─────┴─────┐                              │
│              │ Routeur   │                              │
│              │ WiFi      │                              │
│              └─────┬─────┘                              │
│                    │                                     │
│         ┌─────────┴──────────┐                         │
│         │                    │                         │
│  ┌──────┴──────┐    ┌────────┴─────┐                  │
│  │ VM Jarvis   │    │ Dashboard    │                  │
│  │ Port 7777   │    │ Web          │                  │
│  └─────────────┘    └──────────────┘                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Spécifications Techniques

### Protocole TCP

- **Port**: 7777
- **Format**: JSON + données binaires
- **Heartbeat**: Toutes les 30 secondes
- **Buffer audio**: 512 bytes
- **Sample rate**: 8000 Hz (8-bit unsigned)

### Messages JSON

**Enregistrement du nœud:**
```json
{
  "type": "node_info",
  "node_id": "salon",
  "node_name": "Salon Principal",
  "room_id": 1,
  "capabilities": ["microphone", "speaker"],
  "sample_rate": 8000,
  "buffer_size": 512
}
```

**Heartbeat:**
```json
{
  "type": "heartbeat",
  "uptime": 3600,
  "packets_sent": 1250,
  "packets_received": 45,
  "rssi": -65
}
```

**Commandes serveur → Arduino:**
```json
{ "type": "start_recording" }
{ "type": "stop_recording" }
{ "type": "audio_data" }  // Suivi de données binaires
```

---

## 🎓 Exemples d'Utilisation

### Scénario 1: Commande vocale multi-pièces

```
Mick (Salon): "Jarvis, allume la lumière de la chambre"
→ Jarvis identifie Mick via VoiceIdentifier
→ Comprend la commande via IntelligenceCoordinator
→ Envoie commande au nœud "chambre"
→ Lumière de la chambre s'allume
```

### Scénario 2: Réponse localisée

```
Mick (Salon): "Jarvis, quelle heure est-il ?"
→ Jarvis répond via le haut-parleur du Salon uniquement
→ Sarah (Chambre) n'est pas dérangée
```

### Scénario 3: Broadcast

```
Jarvis: "Alerte, il est 23h00"
→ Message TTS envoyé à tous les nœuds
→ Entendu dans toutes les pièces
```

---

## 🔒 Sécurité

### Recommandations

1. **Réseau WiFi isolé** (VLAN IoT)
2. **Firewall**: Ouvrir uniquement le port 7777
3. **Authentification**: Ajouter un token dans les messages (à implémenter)
4. **Chiffrement**: Utiliser ESP32 pour TLS (à implémenter)

---

## 📈 Évolutions Futures

- [ ] Support ESP32-CAM (audio + vidéo)
- [ ] Détection de direction (micro array)
- [ ] Réduction de bruit (RN sur Arduino)
- [ ] Chiffrement TLS
- [ ] Mesh networking entre nœuds

---

## 📞 Support

- 📖 Documentation: `docs/audio/`
- 🐛 Issues: GitHub Issues
- 💬 Forum: Discussions GitHub

---

**Votre maison devient intelligente, pièce par pièce !** 🏠🎙️
