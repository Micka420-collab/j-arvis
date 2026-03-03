/**
 * Module Voice — Export principal
 * Système vocal complet pour Jarvis : capture micro, STT Mistral, TTS
 */

export { MistralSTTClient, createMistralSTTClient } from "./mistral-stt-client.js";
export type {
  MistralSTTConfig,
  TranscriptionResult,
  TranscriptionError,
  TranscriptionResponse,
} from "./mistral-stt-client.js";

export { AudioCapture, detectAudioTool, listAudioDevices } from "./audio-capture.js";
export type {
  AudioCaptureConfig,
  CaptureResult,
  CaptureError,
  CaptureResponse,
} from "./audio-capture.js";

export { VoicePipeline } from "./voice-pipeline.js";
export type {
  VoicePipelineConfig,
  VoicePipelineMode,
  VoicePipelineState,
  TranscriptionContext,
} from "./voice-pipeline.js";

export { VoiceDaemon, createVoiceDaemon } from "./voice-daemon.js";
export type { VoiceDaemonConfig, VoiceDaemonStatus } from "./voice-daemon.js";
