# 🔌 Code Arduino pour Jarvis Audio Nodes

Ce dossier contient le code pour les micros distants Arduino.

## 📁 Structure

```
arduino/
├── jarvis_audio_node/
│   └── jarvis_audio_node.ino    # Sketch principal
└── README.md                     # Ce fichier
```

## 🚀 Quick Start

1. **Ouvrir** `jarvis_audio_node/jarvis_audio_node.ino` dans Arduino IDE
2. **Configurer** les constantes WiFi et IP serveur
3. **Connecter** l'Arduino Mega selon le schéma
4. **Téléverser** le code
5. **Ouvrir** le moniteur série (115200 bauds)

## 📋 Configuration Minimale

Modifier uniquement ces lignes:

```cpp
// WiFi
const char* WIFI_SSID = "VotreWiFi";
const char* WIFI_PASSWORD = "VotreMotDePasse";

// Serveur Jarvis (IP de votre VM)
const char* JARVIS_HOST = "192.168.1.100";
const int JARVIS_PORT = 7777;

// Identifiant unique (par pièce)
const char* NODE_ID = "salon";        // ou "chambre", "cuisine", etc.
const char* NODE_NAME = "Salon";      // Nom d'affichage
```

## 🔧 Dépannage

### Problème: "Module WiFi non détecté"
- Vérifier câblage TX/RX
- Vérifier alimentation 3.3V (pas 5V!)
- Réinitialiser l'ESP8266 (bouton RST)

### Problème: "Échec connexion"
- Vérifier IP du serveur Jarvis
- Vérifier port 7777 ouvert
- Tester ping: `ping 192.168.1.100`

## 📚 Documentation Complète

Voir `../ARDUINO_AUDIO_SETUP.md` pour:
- Schémas de câblage détaillés
- Liste de matériel
- Guide pas à pas
- Dépannage avancé
