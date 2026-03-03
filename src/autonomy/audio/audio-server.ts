/**
 * Audio Server - Serveur TCP pour les nœuds Arduino
 * 
 * Reçoit les connexions des micros distants (Arduino)
 * Gère le streaming audio bidirectionnel
 * Intègre avec le système d'autonomie
 */

import { createServer, Server, Socket } from "net";
import { EventEmitter } from "events";
import { createLogger } from "../intelligence/logger.js";
import type { VoiceIdentifier } from "../intelligence/voice-identifier.js";
import type { IntelligenceCoordinator } from "../intelligence/intelligence-coordinator.js";

const log = createLogger("AudioServer");

// ============================================================================
// Types
// ============================================================================

export interface AudioNode {
  id: string;
  name: string;
  roomId: number;
  socket: Socket;
  isConnected: boolean;
  isRecording: boolean;
  isPlaying: boolean;
  capabilities: string[];
  sampleRate: number;
  bufferSize: number;
  stats: {
    packetsSent: number;
    packetsReceived: number;
    connectedAt: Date;
    lastHeartbeat: Date;
    rssi?: number;  // Force signal WiFi
  };
  metadata?: {
    ip: string;
    port: number;
    firmwareVersion?: string;
  };
}

export interface AudioServerConfig {
  port: number;
  host: string;
  maxNodes: number;
  heartbeatTimeout: number;
  audioBufferSize: number;
}

export interface AudioFrame {
  nodeId: string;
  timestamp: number;
  data: Buffer;
  sampleRate: number;
}

// ============================================================================
// Audio Server
// ============================================================================

export class AudioServer extends EventEmitter {
  private server: Server | null = null;
  private nodes: Map<string, AudioNode> = new Map();
  private config: AudioServerConfig;
  private voiceIdentifier: VoiceIdentifier;
  private coordinator: IntelligenceCoordinator;
  private isRunning = false;

  /** Buffers d'accumulation par nœud (Float32Array[]) */
  private frameBuffers: Map<string, Float32Array[]> = new Map();
  /** Nombre d'échantillons cible avant d'envoyer au STT (~1 s à 16 kHz) */
  private static readonly STT_TARGET_SAMPLES = 16_000;

  constructor(
    voiceIdentifier: VoiceIdentifier,
    coordinator: IntelligenceCoordinator,
    config?: Partial<AudioServerConfig>
  ) {
    super();
    this.voiceIdentifier = voiceIdentifier;
    this.coordinator = coordinator;
    this.config = {
      port: 7777,
      host: "0.0.0.0",
      maxNodes: 10,
      heartbeatTimeout: 60000,
      audioBufferSize: 512,
      ...config,
    };
  }

  // ============================================================================
  // Démarrage / Arrêt
  // ============================================================================

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        log.warn("Serveur audio déjà démarré");
        resolve();
        return;
      }

      this.server = createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.listen(this.config.port, this.config.host, () => {
        this.isRunning = true;
        log.info(`Serveur audio démarré sur ${this.config.host}:${this.config.port}`);
        this.emit("started", { port: this.config.port, host: this.config.host });
        resolve();
      });

      this.server.on("error", (err) => {
        log.error("Erreur serveur audio", err);
        reject(err);
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isRunning || !this.server) {
        resolve();
        return;
      }

      // Déconnecter tous les nœuds
      for (const node of this.nodes.values()) {
        this.disconnectNode(node.id, "Server stopping");
      }

      this.server.close(() => {
        this.isRunning = false;
        log.info("Serveur audio arrêté");
        this.emit("stopped");
        resolve();
      });
    });
  }

  // ============================================================================
  // Gestion des Connexions
  // ============================================================================

  private handleConnection(socket: Socket): void {
    const clientInfo = `${socket.remoteAddress}:${socket.remotePort}`;
    log.info(`Nouvelle connexion: ${clientInfo}`);

    // Vérifier limite de nœuds
    if (this.nodes.size >= this.config.maxNodes) {
      log.warn(`Nombre max de nœuds atteint (${this.config.maxNodes})`);
      socket.end(JSON.stringify({ type: "error", message: "Too many nodes" }));
      return;
    }

    let buffer = "";
    let node: AudioNode | null = null;

    // Handler données
    socket.on("data", (data) => {
      buffer += data.toString();

      // Traiter lignes complètes (JSON)
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";  // Garder le reste incomplet

      for (const line of lines) {
        if (line.trim()) {
          this.handleMessage(line.trim(), socket, node);
        }
      }

      // Si enregistrement actif, traiter données audio brutes
      if (node?.isRecording) {
        this.handleAudioData(data, node);
      }
    });

    // Handler fermeture
    socket.on("close", () => {
      if (node) {
        this.disconnectNode(node.id, "Connection closed");
      }
      log.info(`Connexion fermée: ${clientInfo}`);
    });

    // Handler erreur
    socket.on("error", (err) => {
      log.error(`Erreur socket ${clientInfo}`, err);
      if (node) {
        this.disconnectNode(node.id, "Socket error");
      }
    });
  }

  private handleMessage(data: string, socket: Socket, nodeRef: AudioNode | null): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case "node_info":
          // Premier message - enregistrement du nœud
          const newNode = this.registerNode(message, socket);
          if (newNode) nodeRef = newNode;
          break;

        case "heartbeat":
          if (nodeRef) {
            this.updateHeartbeat(nodeRef, message);
          }
          break;

        case "recording_started":
          if (nodeRef) {
            nodeRef.isRecording = true;
            log.info(`Enregistrement démarré sur ${nodeRef.name}`);
            this.emit("recordingStarted", { nodeId: nodeRef.id });
          }
          break;

        case "recording_stopped":
          if (nodeRef) {
            nodeRef.isRecording = false;
            log.info(`Enregistrement arrêté sur ${nodeRef.name} (${message.packets_sent} packets)`);
            this.emit("recordingStopped", { nodeId: nodeRef.id, packets: message.packets_sent });
          }
          break;

        case "pong":
          // Réponse au ping
          break;

        default:
          log.warn(`Message inconnu: ${message.type}`);
      }
    } catch (err) {
      // Ce n'est pas du JSON - probablement des données audio binaires
      // Déjà géré par le handler 'data'
    }
  }

  // ============================================================================
  // Gestion des Nœuds
  // ============================================================================

  private registerNode(info: any, socket: Socket): AudioNode | null {
    const nodeId = info.node_id;

    // Vérifier si nœud existe déjà
    if (this.nodes.has(nodeId)) {
      log.warn(`Nœud ${nodeId} existe déjà, déconnexion ancienne`);
      this.disconnectNode(nodeId, "Replaced by new connection");
    }

    const node: AudioNode = {
      id: nodeId,
      name: info.node_name || nodeId,
      roomId: info.room_id || 0,
      socket,
      isConnected: true,
      isRecording: false,
      isPlaying: false,
      capabilities: info.capabilities || [],
      sampleRate: info.sample_rate || 8000,
      bufferSize: info.buffer_size || 512,
      stats: {
        packetsSent: 0,
        packetsReceived: 0,
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
      },
      metadata: {
        ip: socket.remoteAddress || "unknown",
        port: socket.remotePort || 0,
      },
    };

    this.nodes.set(nodeId, node);
    log.info(`Nœud enregistré: ${node.name} (${node.id})`);

    // Accusé de réception
    socket.write(JSON.stringify({ type: "registered", node_id: nodeId }) + "\n");

    this.emit("nodeConnected", { node });

    return node;
  }

  private disconnectNode(nodeId: string, reason: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    node.isConnected = false;
    node.isRecording = false;
    node.socket.end();

    this.nodes.delete(nodeId);
    this.frameBuffers.delete(nodeId); // Libérer le buffer audio
    log.info(`Nœud déconnecté: ${node.name} (${reason})`);

    this.emit("nodeDisconnected", { nodeId, reason });
  }

  private updateHeartbeat(node: AudioNode, message: any): void {
    node.stats.lastHeartbeat = new Date();
    node.stats.packetsSent = message.packets_sent || node.stats.packetsSent;
    node.stats.packetsReceived = message.packets_received || node.stats.packetsReceived;
    node.stats.rssi = message.rssi;
  }

  // ============================================================================
  // Traitement Audio
  // ============================================================================

  private async handleAudioData(data: Buffer, node: AudioNode): Promise<void> {
    // Convertir Buffer en Float32Array pour le VoiceIdentifier
    const audioData = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      // Convertir byte (0-255) en float (-1 à 1)
      audioData[i] = (data[i] - 128) / 128.0;
    }

    node.stats.packetsReceived++;

    // Émettre l'événement pour traitement externe
    this.emit("audioFrame", {
      nodeId: node.id,
      timestamp: Date.now(),
      data: audioData,
      sampleRate: node.sampleRate,
    } as AudioFrame);

    // ── Accumulation de frames pour la reconnaissance vocale ─────────────────
    const buf = this.frameBuffers.get(node.id) ?? [];
    buf.push(audioData);
    this.frameBuffers.set(node.id, buf);

    // Calculer le nombre total d'échantillons accumulés
    const totalSamples = buf.reduce((acc, f) => acc + f.length, 0);

    if (totalSamples >= AudioServer.STT_TARGET_SAMPLES) {
      // Réinitialiser immédiatement pour ne pas bloquer les prochaines frames
      this.frameBuffers.set(node.id, []);

      // Concaténer tous les fragments en un seul Float32Array
      const merged = new Float32Array(totalSamples);
      let offset = 0;
      for (const chunk of buf) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      // Émettre un événement de haut niveau — les abonnés (ex. VoicePipeline)
      // peuvent traiter ce buffer PCM directement.
      this.emit("speechReady", {
        nodeId: node.id,
        roomId: node.roomId,
        data: merged,
        sampleRate: node.sampleRate,
        durationMs: Math.round((totalSamples / node.sampleRate) * 1000),
      });

      log.debug(
        `Speech buffer ready — nœud ${node.name}: ` +
          `${totalSamples} échantillons (${Math.round((totalSamples / node.sampleRate) * 1000)} ms)`
      );
    }
  }

  // ============================================================================
  // Envoi Audio (TTS)
  // ============================================================================

  async sendAudioToNode(nodeId: string, audioData: Buffer): Promise<boolean> {
    const node = this.nodes.get(nodeId);
    if (!node || !node.isConnected) {
      log.warn(`Nœud ${nodeId} non disponible pour envoi audio`);
      return false;
    }

    try {
      // Envoyer header
      node.socket.write(JSON.stringify({ type: "audio_data" }) + "\n");

      // Envoyer taille (2 bytes)
      const sizeBuffer = Buffer.alloc(2);
      sizeBuffer.writeUInt16BE(audioData.length, 0);
      node.socket.write(sizeBuffer);

      // Envoyer données audio
      node.socket.write(audioData);

      node.stats.packetsSent++;
      log.debug(`Audio envoyé à ${node.name}: ${audioData.length} bytes`);

      return true;
    } catch (err) {
      log.error(`Erreur envoi audio à ${nodeId}`, err);
      return false;
    }
  }

  startRecording(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node || !node.isConnected) {
      log.warn(`Nœud ${nodeId} non disponible`);
      return false;
    }

    try {
      node.socket.write(JSON.stringify({ type: "start_recording" }) + "\n");
      log.info(`Commande 'start_recording' envoyée à ${node.name}`);
      return true;
    } catch (err) {
      log.error(`Erreur start recording sur ${nodeId}`, err);
      return false;
    }
  }

  stopRecording(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node || !node.isConnected) {
      return false;
    }

    try {
      node.socket.write(JSON.stringify({ type: "stop_recording" }) + "\n");
      log.info(`Commande 'stop_recording' envoyée à ${node.name}`);
      return true;
    } catch (err) {
      log.error(`Erreur stop recording sur ${nodeId}`, err);
      return false;
    }
  }

  // ============================================================================
  // Getters
  // ============================================================================

  getNodes(): AudioNode[] {
    return Array.from(this.nodes.values());
  }

  getNode(nodeId: string): AudioNode | undefined {
    return this.nodes.get(nodeId);
  }

  getConnectedNodes(): AudioNode[] {
    return this.getNodes().filter((n) => n.isConnected);
  }

  getRecordingNodes(): AudioNode[] {
    return this.getNodes().filter((n) => n.isRecording);
  }

  getStats(): {
    totalNodes: number;
    connectedNodes: number;
    recordingNodes: number;
    totalPacketsReceived: number;
    totalPacketsSent: number;
    uptime: number;
  } {
    const nodes = this.getNodes();
    return {
      totalNodes: nodes.length,
      connectedNodes: nodes.filter((n) => n.isConnected).length,
      recordingNodes: nodes.filter((n) => n.isRecording).length,
      totalPacketsReceived: nodes.reduce((sum, n) => sum + n.stats.packetsReceived, 0),
      totalPacketsSent: nodes.reduce((sum, n) => sum + n.stats.packetsSent, 0),
      uptime: this.isRunning ? Date.now() - (this.server?.listening ? Date.now() : 0) : 0,
    };
  }

  isNodeConnected(nodeId: string): boolean {
    return this.nodes.get(nodeId)?.isConnected || false;
  }
}
