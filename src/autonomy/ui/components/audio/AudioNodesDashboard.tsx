/**
 * Audio Nodes Dashboard - Gestion des micros distants Arduino
 * 
 * Composant React pour le dashboard qui permet de :
 * - Voir tous les nœuds audio connectés (Arduino)
 * - Visualiser l'état de chaque micro (enregistrement, connexion)
 * - Contrôler à distance (start/stop recording)
 * - Envoyer de l'audio (TTS) vers un nœud spécifique
 * - Voir les statistiques (packets, signal WiFi)
 */

import React, { useState, useEffect, useCallback } from "react";
import type { AudioNode, AudioServer } from "../../../audio/audio-server.js";

interface AudioNodesDashboardProps {
  audioServer: AudioServer;
}

interface NodeWithVU extends AudioNode {
  vuLevel: number;
  lastActivity: Date;
}

export const AudioNodesDashboard: React.FC<AudioNodesDashboardProps> = ({
  audioServer,
}) => {
  const [nodes, setNodes] = useState<NodeWithVU[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [serverStats, setServerStats] = useState({
    totalNodes: 0,
    connectedNodes: 0,
    recordingNodes: 0,
    totalPacketsReceived: 0,
    totalPacketsSent: 0,
  });
  const [ttsText, setTtsText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Rafraîchir les données
  const refreshData = useCallback(() => {
    const currentNodes = audioServer.getNodes();
    const stats = audioServer.getStats();

    setNodes(
      currentNodes.map((node) => ({
        ...node,
        vuLevel: Math.random() * 100, // TODO: Vraie donnée VU du serveur
        lastActivity: node.stats.lastHeartbeat,
      }))
    );

    setServerStats(stats);
  }, [audioServer]);

  // Écouter les événements
  useEffect(() => {
    refreshData();

    const interval = setInterval(refreshData, 1000);

    audioServer.on("nodeConnected", refreshData);
    audioServer.on("nodeDisconnected", refreshData);
    audioServer.on("recordingStarted", refreshData);
    audioServer.on("recordingStopped", refreshData);

    return () => {
      clearInterval(interval);
      audioServer.off("nodeConnected", refreshData);
      audioServer.off("nodeDisconnected", refreshData);
      audioServer.off("recordingStarted", refreshData);
      audioServer.off("recordingStopped", refreshData);
    };
  }, [audioServer, refreshData]);

  // Contrôles
  const handleStartRecording = (nodeId: string) => {
    audioServer.startRecording(nodeId);
  };

  const handleStopRecording = (nodeId: string) => {
    audioServer.stopRecording(nodeId);
  };

  const handleSendTTS = async () => {
    if (!selectedNode || !ttsText.trim()) return;

    setIsLoading(true);
    try {
      // TODO: Appeler le service TTS pour convertir le texte en audio
      // const audioBuffer = await textToSpeech(ttsText);
      // await audioServer.sendAudioToNode(selectedNode, audioBuffer);
      
      console.log(`TTS envoyé à ${selectedNode}: ${ttsText}`);
      setTtsText("");
    } catch (error) {
      console.error("Erreur TTS:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Rendu
  return (
    <div className="audio-nodes-dashboard">
      <style>{`
        .audio-nodes-dashboard {
          padding: 20px;
          background: #1a1a2e;
          color: #eee;
          min-height: 100vh;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #16213e;
        }

        .dashboard-title {
          font-size: 28px;
          font-weight: bold;
          color: #00d4ff;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .server-stats {
          display: flex;
          gap: 20px;
        }

        .stat-card {
          background: #16213e;
          padding: 15px 20px;
          border-radius: 10px;
          text-align: center;
          min-width: 120px;
        }

        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #00d4ff;
        }

        .stat-label {
          font-size: 12px;
          color: #888;
          text-transform: uppercase;
        }

        .nodes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .node-card {
          background: #16213e;
          border-radius: 15px;
          padding: 20px;
          border: 2px solid transparent;
          transition: all 0.3s ease;
        }

        .node-card:hover {
          border-color: #00d4ff;
          transform: translateY(-2px);
        }

        .node-card.selected {
          border-color: #00d4ff;
          box-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
        }

        .node-card.disconnected {
          opacity: 0.5;
        }

        .node-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .node-name {
          font-size: 18px;
          font-weight: bold;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #e74c3c;
        }

        .status-indicator.connected {
          background: #2ecc71;
          box-shadow: 0 0 10px #2ecc71;
        }

        .status-indicator.recording {
          background: #e74c3c;
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .node-badges {
          display: flex;
          gap: 5px;
        }

        .badge {
          font-size: 10px;
          padding: 3px 8px;
          border-radius: 12px;
          text-transform: uppercase;
        }

        .badge-room {
          background: #8e44ad;
        }

        .badge-capability {
          background: #16a085;
        }

        .vu-meter {
          height: 30px;
          background: #0f0f23;
          border-radius: 15px;
          overflow: hidden;
          margin: 15px 0;
          position: relative;
        }

        .vu-level {
          height: 100%;
          background: linear-gradient(90deg, #2ecc71 0%, #f1c40f 70%, #e74c3c 100%);
          transition: width 0.1s ease;
          border-radius: 15px;
        }

        .node-stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin: 15px 0;
          font-size: 12px;
          color: #888;
        }

        .node-stat {
          display: flex;
          justify-content: space-between;
        }

        .node-stat-value {
          color: #00d4ff;
          font-weight: bold;
        }

        .node-controls {
          display: flex;
          gap: 10px;
          margin-top: 15px;
        }

        .btn {
          flex: 1;
          padding: 10px 15px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-record {
          background: #e74c3c;
          color: white;
        }

        .btn-record:hover:not(:disabled) {
          background: #c0392b;
        }

        .btn-stop {
          background: #95a5a6;
          color: white;
        }

        .btn-stop:hover:not(:disabled) {
          background: #7f8c8d;
        }

        .btn-select {
          background: #3498db;
          color: white;
        }

        .btn-select:hover:not(:disabled) {
          background: #2980b9;
        }

        .btn-select.active {
          background: #00d4ff;
          color: #1a1a2e;
        }

        .tts-section {
          background: #16213e;
          border-radius: 15px;
          padding: 20px;
        }

        .tts-title {
          font-size: 18px;
          margin-bottom: 15px;
          color: #00d4ff;
        }

        .tts-input-group {
          display: flex;
          gap: 10px;
        }

        .tts-input {
          flex: 1;
          padding: 12px 15px;
          border: 2px solid #0f0f23;
          border-radius: 8px;
          background: #0f0f23;
          color: #eee;
          font-size: 14px;
        }

        .tts-input:focus {
          outline: none;
          border-color: #00d4ff;
        }

        .tts-input::placeholder {
          color: #666;
        }

        .btn-send {
          background: #00d4ff;
          color: #1a1a2e;
          padding: 12px 25px;
        }

        .btn-send:hover:not(:disabled) {
          background: #00a8cc;
        }

        .selected-node-info {
          margin-top: 15px;
          padding: 15px;
          background: #0f0f23;
          border-radius: 8px;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #666;
        }

        .empty-state-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }

        .connection-help {
          background: #16213e;
          border-radius: 15px;
          padding: 20px;
          margin-top: 20px;
        }

        .connection-help h3 {
          color: #00d4ff;
          margin-bottom: 15px;
        }

        .connection-help code {
          background: #0f0f23;
          padding: 15px;
          border-radius: 8px;
          display: block;
          font-family: monospace;
          font-size: 12px;
          overflow-x: auto;
          color: #2ecc71;
        }
      `}</style>

      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-title">
          🎙️ Micros Distants Arduino
        </div>
        <div className="server-stats">
          <div className="stat-card">
            <div className="stat-value">{serverStats.connectedNodes}</div>
            <div className="stat-label">Connectés</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{serverStats.recordingNodes}</div>
            <div className="stat-label">Enregistrement</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {serverStats.totalPacketsReceived.toLocaleString()}
            </div>
            <div className="stat-label">Packets RX</div>
          </div>
        </div>
      </div>

      {/* Grille des nœuds */}
      {nodes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📡</div>
          <h3>Aucun nœud audio connecté</h3>
          <p>Les micros Arduino apparaîtront ici quand ils se connecteront.</p>
        </div>
      ) : (
        <div className="nodes-grid">
          {nodes.map((node) => (
            <div
              key={node.id}
              className={`node-card ${!node.isConnected ? "disconnected" : ""} ${
                selectedNode === node.id ? "selected" : ""
              }`}
            >
              {/* Header */}
              <div className="node-header">
                <div className="node-name">
                  <div
                    className={`status-indicator ${
                      node.isRecording
                        ? "recording"
                        : node.isConnected
                        ? "connected"
                        : ""
                    }`}
                  />
                  {node.name}
                </div>
                <div className="node-badges">
                  <span className="badge badge-room">Pièce {node.roomId}</span>
                  {node.capabilities.map((cap) => (
                    <span key={cap} className="badge badge-capability">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>

              {/* VU Meter */}
              {node.isRecording && (
                <div className="vu-meter">
                  <div
                    className="vu-level"
                    style={{ width: `${node.vuLevel}%` }}
                  />
                </div>
              )}

              {/* Stats */}
              <div className="node-stats">
                <div className="node-stat">
                  <span>Packets reçus</span>
                  <span className="node-stat-value">
                    {node.stats.packetsReceived.toLocaleString()}
                  </span>
                </div>
                <div className="node-stat">
                  <span>Packets envoyés</span>
                  <span className="node-stat-value">
                    {node.stats.packetsSent.toLocaleString()}
                  </span>
                </div>
                <div className="node-stat">
                  <span>Signal WiFi</span>
                  <span className="node-stat-value">
                    {node.stats.rssi ? `${node.stats.rssi} dBm` : "N/A"}
                  </span>
                </div>
                <div className="node-stat">
                  <span>Sample Rate</span>
                  <span className="node-stat-value">{node.sampleRate} Hz</span>
                </div>
              </div>

              {/* Controls */}
              <div className="node-controls">
                {node.isRecording ? (
                  <button
                    className="btn btn-stop"
                    onClick={() => handleStopRecording(node.id)}
                    disabled={!node.isConnected}
                  >
                    ⏹️ Arrêter
                  </button>
                ) : (
                  <button
                    className="btn btn-record"
                    onClick={() => handleStartRecording(node.id)}
                    disabled={!node.isConnected}
                  >
                    🔴 Enregistrer
                  </button>
                )}
                <button
                  className={`btn btn-select ${
                    selectedNode === node.id ? "active" : ""
                  }`}
                  onClick={() =>
                    setSelectedNode(selectedNode === node.id ? null : node.id)
                  }
                >
                  {selectedNode === node.id ? "✓ Sélectionné" : "Sélectionner"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Section TTS */}
      <div className="tts-section">
        <h3 className="tts-title">🔊 Envoyer un message vocal (TTS)</h3>
        <div className="tts-input-group">
          <input
            type="text"
            className="tts-input"
            placeholder={
              selectedNode
                ? `Message pour ${
                    nodes.find((n) => n.id === selectedNode)?.name
                  }...`
                : "Sélectionnez un nœud d'abord..."
            }
            value={ttsText}
            onChange={(e) => setTtsText(e.target.value)}
            disabled={!selectedNode || isLoading}
          />
          <button
            className="btn btn-send"
            onClick={handleSendTTS}
            disabled={!selectedNode || !ttsText.trim() || isLoading}
          >
            {isLoading ? "⏳ Envoi..." : "📤 Envoyer"}
          </button>
        </div>

        {selectedNode && (
          <div className="selected-node-info">
            <strong>Nœud sélectionné:</strong>{" "}
            {nodes.find((n) => n.id === selectedNode)?.name}
            <br />
            <small>
              L'audio sera joué sur l'enceinte connectée à ce nœud Arduino.
            </small>
          </div>
        )}
      </div>

      {/* Aide connexion */}
      <div className="connection-help">
        <h3>🔧 Configuration Arduino</h3>
        <p>Configurez votre Arduino Mega + ESP8266 avec ce sketch:</p>
        <code>
          {`// Configurer dans le sketch:
const char* WIFI_SSID = "VotreWiFi";
const char* WIFI_PASSWORD = "VotreMotDePasse";
const char* JARVIS_HOST = "${window.location.hostname}";
const int JARVIS_PORT = 7777;
const char* NODE_ID = "salon";  // Unique par pièce`}
        </code>
      </div>
    </div>
  );
};

export default AudioNodesDashboard;
