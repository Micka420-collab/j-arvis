/**
 * JARVIS AUDIO NODE - Arduino Mega + ESP8266/ESP32
 * 
 * Ce sketch permet de :
 * - Capturer l'audio depuis un micro connecté à l'Arduino
 * - Streamer l'audio vers le serveur Jarvis via WiFi
 * - Recevoir la réponse audio de Jarvis et la jouer sur un haut-parleur
 * - Gérer la connexion TCP persistante
 * 
 * Matériel requis :
 * - Arduino Mega 2560
 * - Module WiFi ESP8266 (ESP-01) ou ESP32
 * - Microphone MAX4466 ou SPW2430
 * - Amplificateur audio PAM8403 + Haut-parleur
 * - Alimentation 5V stable
 */

#include <SoftwareSerial.h>
#include <WiFiEsp.h>
#include <WiFiEspClient.h>

// ============================================================================
// CONFIGURATION - À MODIFIER SELON VOTRE RÉSEAU
// ============================================================================

// WiFi
const char* WIFI_SSID = "VOTRE_SSID_WIFI";
const char* WIFI_PASSWORD = "VOTRE_MOT_DE_PASSE_WIFI";

// Serveur Jarvis
const char* JARVIS_HOST = "192.168.1.100";  // IP de votre VM OpenClaw
const int JARVIS_PORT = 7777;               // Port audio TCP

// Configuration du nœud
const char* NODE_ID = "salon";              // Identifiant unique (salon, chambre, cuisine...)
const char* NODE_NAME = "Salon Principal";   // Nom d'affichage
const int NODE_ROOM_ID = 1;                  // ID de la pièce

// Pins
const int MIC_PIN = A0;                      // Entrée micro (analogique)
const int SPEAKER_PIN = 9;                   // Sortie PWM haut-parleur
const int STATUS_LED = 13;                   // LED de statut
const int BUTTON_PIN = 2;                    // Bouton poussoir (interrupteur)

// Audio
const int SAMPLE_RATE = 8000;                // Hz (8kHz suffisant pour la voix)
const int BUFFER_SIZE = 512;                 // Taille buffer envoi
const int TCP_TIMEOUT = 5000;                // ms

// ============================================================================
// VARIABLES GLOBALES
// ============================================================================

WiFiEspClient client;
SoftwareSerial espSerial(10, 11);  // RX, TX pour ESP8266

uint8_t audioBuffer[BUFFER_SIZE];
bool isRecording = false;
bool isConnected = false;
bool isPlaying = false;

unsigned long lastHeartbeat = 0;
unsigned long lastReconnectAttempt = 0;
const unsigned long HEARTBEAT_INTERVAL = 30000;  // 30s
const unsigned long RECONNECT_INTERVAL = 5000;   // 5s

// Statistiques
unsigned long packetsSent = 0;
unsigned long packetsReceived = 0;
unsigned long connectionStartTime = 0;

// ============================================================================
// SETUP
// ============================================================================

void setup() {
  // Initialisation série
  Serial.begin(115200);
  espSerial.begin(9600);
  
  Serial.println(F("\n========================================"));
  Serial.println(F("  JARVIS AUDIO NODE - Démarrage"));
  Serial.println(F("========================================\n"));
  
  // Configuration pins
  pinMode(STATUS_LED, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(SPEAKER_PIN, OUTPUT);
  
  // LED off au départ
  digitalWrite(STATUS_LED, LOW);
  
  // Initialisation WiFi
  setupWiFi();
  
  // Connexion au serveur
  connectToServer();
  
  Serial.println(F("\n✅ Setup terminé. En attente...\n"));
}

// ============================================================================
// LOOP PRINCIPAL
// ============================================================================

void loop() {
  // Vérifier connexion
  if (!client.connected()) {
    handleDisconnection();
    return;
  }
  
  // Heartbeat périodique
  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
    sendHeartbeat();
  }
  
  // Lire bouton (activation manuelle)
  if (digitalRead(BUTTON_PIN) == LOW && !isRecording) {
    delay(50);  // Anti-rebond
    if (digitalRead(BUTTON_PIN) == LOW) {
      startRecording();
    }
  }
  
  // Recevoir commandes du serveur
  if (client.available()) {
    processServerCommand();
  }
  
  // Stream audio si enregistrement actif
  if (isRecording) {
    streamAudio();
  }
  
  // Petit délai pour stabilité
  delay(1);
}

// ============================================================================
// WIFI
// ============================================================================

void setupWiFi() {
  Serial.print(F("📶 Connexion WiFi à "));
  Serial.println(WIFI_SSID);
  
  // Initialiser le module ESP
  WiFi.init(&espSerial);
  
  // Vérifier présence du module
  if (WiFi.status() == WL_NO_SHIELD) {
    Serial.println(F("❌ Module WiFi non détecté !"));
    while (true) {
      blinkLED(3, 500);  // Clignotement erreur
    }
  }
  
  // Connexion
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(F("."));
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    delay(5000);
  }
  
  Serial.println(F("\n✅ WiFi connecté !"));
  Serial.print(F("📡 IP locale: "));
  Serial.println(WiFi.localIP());
  Serial.print(F("📶 Force signal: "));
  Serial.print(WiFi.RSSI());
  Serial.println(F(" dBm"));
}

// ============================================================================
// CONNEXION SERVEUR
// ============================================================================

void connectToServer() {
  if (isConnected) return;
  
  Serial.print(F("\n🔌 Connexion à Jarvis "));
  Serial.print(JARVIS_HOST);
  Serial.print(F(":"));
  Serial.println(JARVIS_PORT);
  
  if (client.connect(JARVIS_HOST, JARVIS_PORT)) {
    Serial.println(F("✅ Connecté au serveur !"));
    isConnected = true;
    connectionStartTime = millis();
    
    // Envoyer infos du nœud
    sendNodeInfo();
    
    // LED statut connecté
    digitalWrite(STATUS_LED, HIGH);
  } else {
    Serial.println(F("❌ Échec connexion"));
    isConnected = false;
    blinkLED(2, 200);
  }
}

void handleDisconnection() {
  if (isConnected) {
    Serial.println(F("\n⚠️ Déconnexion du serveur"));
    isConnected = false;
    isRecording = false;
    client.stop();
    digitalWrite(STATUS_LED, LOW);
  }
  
  // Tentative reconnexion
  if (millis() - lastReconnectAttempt > RECONNECT_INTERVAL) {
    lastReconnectAttempt = millis();
    Serial.println(F("🔄 Tentative reconnexion..."));
    connectToServer();
  }
}

// ============================================================================
// PROTOCOLE DE COMMUNICATION
// ============================================================================

void sendNodeInfo() {
  // Format JSON simple
  String json = "{";
  json += "\"type\":\"node_info\",";
  json += "\"node_id\":\"" + String(NODE_ID) + "\",";
  json += "\"node_name\":\"" + String(NODE_NAME) + "\",";
  json += "\"room_id\":" + String(NODE_ROOM_ID) + ",";
  json += "\"capabilities\":[\"microphone\",\"speaker\"],";
  json += "\"sample_rate\":" + String(SAMPLE_RATE) + ",";
  json += "\"buffer_size\":" + String(BUFFER_SIZE);
  json += "}";
  
  client.println(json);
  Serial.println(F("📤 Info nœud envoyée"));
}

void sendHeartbeat() {
  lastHeartbeat = millis();
  
  String json = "{";
  json += "\"type\":\"heartbeat\",";
  json += "\"uptime\":" + String(millis() / 1000) + ",";
  json += "\"packets_sent\":" + String(packetsSent) + ",";
  json += "\"packets_received\":" + String(packetsReceived) + ",";
  json += "\"rssi\":" + String(WiFi.RSSI());
  json += "}";
  
  client.println(json);
}

void processServerCommand() {
  String command = client.readStringUntil('\n');
  command.trim();
  
  if (command.length() == 0) return;
  
  Serial.print(F("📥 Commande reçue: "));
  Serial.println(command);
  
  // Parsing simple des commandes
  if (command.indexOf("\"type\":\"start_recording\"") >= 0) {
    startRecording();
  }
  else if (command.indexOf("\"type\":\"stop_recording\"") >= 0) {
    stopRecording();
  }
  else if (command.indexOf("\"type\":\"audio_data\"") >= 0) {
    // Réception audio de Jarvis à jouer
    playAudioFromServer();
  }
  else if (command.indexOf("\"type\":\"ping\"") >= 0) {
    client.println("{\"type\":\"pong\"}");
  }
}

// ============================================================================
// ENREGISTREMENT AUDIO
// ============================================================================

void startRecording() {
  if (isRecording) return;
  
  Serial.println(F("\n🔴 DÉBUT ENREGISTREMENT"));
  isRecording = true;
  packetsSent = 0;
  
  // Notifier le serveur
  client.println("{\"type\":\"recording_started\"}");
  
  // Feedback visuel
  digitalWrite(STATUS_LED, HIGH);
}

void stopRecording() {
  if (!isRecording) return;
  
  Serial.println(F("\n⏹️ FIN ENREGISTREMENT"));
  isRecording = false;
  
  // Notifier le serveur
  client.println("{\"type\":\"recording_stopped\",\"packets_sent\":" + String(packetsSent) + "}");
  
  Serial.print(F("📦 Packets envoyés: "));
  Serial.println(packetsSent);
}

void streamAudio() {
  // Remplir le buffer avec des échantillons audio
  for (int i = 0; i < BUFFER_SIZE; i++) {
    // Lecture ADC (0-1023) → conversion en byte (0-255)
    int sample = analogRead(MIC_PIN);
    audioBuffer[i] = map(sample, 0, 1023, 0, 255);
    
    // Délai pour respecter le sample rate
    delayMicroseconds(125);  // 8000 Hz = 125µs entre échantillons
  }
  
  // Envoyer le buffer
  if (client.connected()) {
    size_t sent = client.write(audioBuffer, BUFFER_SIZE);
    if (sent == BUFFER_SIZE) {
      packetsSent++;
    }
  }
}

// ============================================================================
// LECTURE AUDIO (Haut-parleur)
// ============================================================================

void playAudioFromServer() {
  Serial.println(F("🔊 Lecture audio incoming..."));
  isPlaying = true;
  
  // Lire la taille des données audio
  while (client.available() < 2) { delay(1); }
  uint16_t audioSize = (client.read() << 8) | client.read();
  
  Serial.print(F("📦 Taille audio: "));
  Serial.println(audioSize);
  
  // Lire et jouer l'audio
  for (int i = 0; i < audioSize; i++) {
    while (!client.available()) { delayMicroseconds(100); }
    
    uint8_t sample = client.read();
    
    // Jouer sur haut-parleur (PWM)
    analogWrite(SPEAKER_PIN, sample);
    
    // Timing pour 8kHz
    delayMicroseconds(125);
  }
  
  // Arrêter le son
  analogWrite(SPEAKER_PIN, 0);
  isPlaying = false;
  packetsReceived++;
  
  Serial.println(F("✅ Lecture terminée"));
}

// ============================================================================
// UTILITAIRES
// ============================================================================

void blinkLED(int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(STATUS_LED, HIGH);
    delay(delayMs);
    digitalWrite(STATUS_LED, LOW);
    delay(delayMs);
  }
}

// ============================================================================
// DEBUG
// ============================================================================

void printDebugInfo() {
  Serial.println(F("\n=== DEBUG INFO ==="));
  Serial.print(F("WiFi status: "));
  Serial.println(WiFi.status());
  Serial.print(F("Client connected: "));
  Serial.println(client.connected() ? "OUI" : "NON");
  Serial.print(F("Is recording: "));
  Serial.println(isRecording ? "OUI" : "NON");
  Serial.print(F("Packets sent: "));
  Serial.println(packetsSent);
  Serial.println(F("==================\n"));
}
