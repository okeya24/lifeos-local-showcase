import { useCallback, useEffect, useRef, useState } from "react";
import { transcribeAudio } from "../api";

export type VoicePhase =
  | "off"
  | "requesting"
  | "listening"
  | "hearing"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

interface VoiceConversationOptions {
  onTranscript: (text: string) => Promise<void>;
  onBargeIn: () => void;
}

const IDLE_THRESHOLD = 0.035;
const BUSY_THRESHOLD = 0.095;
const SPEECH_HOLD_MS = 180;
const END_SILENCE_MS = 720;

export function useVoiceConversation({
  onTranscript,
  onBargeIn
}: VoiceConversationOptions) {
  const [enabled, setEnabled] = useState(false);
  const [phase, setPhase] = useState<VoicePhase>("off");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");
  const [previewText, setPreviewText] = useState("");

  const enabledRef = useRef(false);
  const phaseRef = useRef<VoicePhase>("off");
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animationRef = useRef<number | null>(null);
  const candidateSinceRef = useRef(0);
  const lastVoiceAtRef = useRef(0);
  const lastLevelUpdateRef = useRef(0);
  const recordStartedAtRef = useRef(0);
  const agentBusyRef = useRef(false);
  const transcribingRef = useRef(false);
  const previewBusyRef = useRef(false);
  const previewIntervalRef = useRef<number | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onBargeInRef = useRef(onBargeIn);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onBargeInRef.current = onBargeIn;
  }, [onBargeIn, onTranscript]);

  const updatePhase = useCallback((next: VoicePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const releaseAudio = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    if (previewIntervalRef.current !== null) {
      clearInterval(previewIntervalRef.current);
      previewIntervalRef.current = null;
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    analyserRef.current = null;
    chunksRef.current = [];
    setLevel(0);
    setPreviewText("");
  }, []);

  const updatePreview = useCallback(async (blob: Blob) => {
    if (previewBusyRef.current || blob.size < 600) return;
    previewBusyRef.current = true;
    try {
      const result = await transcribeAudio(blob);
      const text = result.text.trim();
      setPreviewText(text);
    } catch {
      // The final recording still has a chance to transcribe successfully.
    } finally {
      previewBusyRef.current = false;
    }
  }, []);

  const transcribe = useCallback(
    async (blob: Blob) => {
      if (transcribingRef.current) return;
      transcribingRef.current = true;
      updatePhase("transcribing");
      try {
        const result = await transcribeAudio(blob);
        const text = result.text.trim();
        if (text) {
          updatePhase("thinking");
          await onTranscriptRef.current(text);
        }
        if (enabledRef.current) {
          updatePhase(
            globalThis.speechSynthesis?.speaking ||
              globalThis.speechSynthesis?.pending
              ? "speaking"
              : "listening"
          );
        }
      } catch (nextError) {
        setError(
          nextError instanceof Error ? nextError.message : "语音识别失败。"
        );
        updatePhase("error");
      } finally {
        transcribingRef.current = false;
      }
    },
    [updatePhase]
  );

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.stop();
  }, []);

  const beginRecording = useCallback(() => {
    if (!streamRef.current || recorderRef.current) return;
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    chunksRef.current = [];
    recordStartedAtRef.current = performance.now();
    lastVoiceAtRef.current = performance.now();
    updatePhase("hearing");

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    });
    recorder.addEventListener("stop", () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      if (previewIntervalRef.current !== null) {
        clearInterval(previewIntervalRef.current);
        previewIntervalRef.current = null;
      }
      recorderRef.current = null;
      chunksRef.current = [];
      if (!enabledRef.current) return;
      if (blob.size > 600) void transcribe(blob);
      else if (enabledRef.current) updatePhase("listening");
    });
    recorder.start(100);
    recorderRef.current = recorder;
    setPreviewText("");
    previewIntervalRef.current = window.setInterval(() => {
      if (chunksRef.current.length > 0) {
        void updatePreview(new Blob(chunksRef.current, { type: recorder.mimeType }));
      }
    }, 1400);
  }, [transcribe, updatePhase, updatePreview]);

  const monitor = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || !enabledRef.current) return;

    const samples = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) {
      const normalized = (sample - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / samples.length);
    const now = performance.now();
    if (now - lastLevelUpdateRef.current > 80) {
      lastLevelUpdateRef.current = now;
      setLevel((current) => current + (Math.min(rms * 5, 1) - current) * 0.32);
    }

    const threshold = agentBusyRef.current ? BUSY_THRESHOLD : IDLE_THRESHOLD;
    const speaking = rms >= threshold;
    if (speaking) {
      lastVoiceAtRef.current = now;
      if (!candidateSinceRef.current) candidateSinceRef.current = now;
    } else {
      candidateSinceRef.current = 0;
    }

    const sustained = speaking && now - candidateSinceRef.current >= SPEECH_HOLD_MS;
    if (
      sustained &&
      !transcribingRef.current &&
      !recorderRef.current &&
      ["listening", "thinking", "speaking"].includes(phaseRef.current)
    ) {
      if (agentBusyRef.current) onBargeInRef.current();
      beginRecording();
    }

    if (
      recorderRef.current?.state === "recording" &&
      now - recordStartedAtRef.current > 350 &&
      now - lastVoiceAtRef.current > END_SILENCE_MS
    ) {
      stopRecording();
    }

    animationRef.current = requestAnimationFrame(monitor);
  }, [beginRecording, stopRecording]);

  const startVoice = useCallback(async () => {
    if (enabledRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) {
      setError("当前浏览器不支持连续语音采集，请使用最新版 Chrome 或 Safari。");
      updatePhase("error");
      return;
    }

    setError("");
      setPreviewText("");
    updatePhase("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });
      const audioContext = new AudioContext();
      await audioContext.resume();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      enabledRef.current = true;
      setEnabled(true);
      updatePhase("listening");
      animationRef.current = requestAnimationFrame(monitor);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "无法打开麦克风，请检查系统权限。"
      );
      updatePhase("error");
    }
  }, [monitor, updatePhase]);

  const stopVoice = useCallback(() => {
    enabledRef.current = false;
    setEnabled(false);
    releaseAudio();
    updatePhase("off");
  }, [releaseAudio, updatePhase]);

  const toggleVoice = useCallback(() => {
    if (enabledRef.current) stopVoice();
    else void startVoice();
  }, [startVoice, stopVoice]);

  const setAgentBusy = useCallback((busy: boolean) => {
    agentBusyRef.current = busy;
    if (!enabledRef.current) return;
    if (busy && !recorderRef.current) updatePhase("thinking");
    if (!busy && phaseRef.current !== "transcribing" && !recorderRef.current) {
      updatePhase("listening");
    }
  }, [updatePhase]);

  const setAgentSpeaking = useCallback((speaking: boolean) => {
    if (!enabledRef.current) return;
    if (speaking) updatePhase("speaking");
    else if (!agentBusyRef.current && !recorderRef.current) updatePhase("listening");
  }, [updatePhase]);

  useEffect(
    () => () => {
      enabledRef.current = false;
      releaseAudio();
      globalThis.speechSynthesis?.cancel();
    },
    [releaseAudio]
  );

  return {
    enabled,
    phase,
    level,
    error,
    previewText,
    toggleVoice,
    stopVoice,
    setAgentBusy,
    setAgentSpeaking
  };
}
