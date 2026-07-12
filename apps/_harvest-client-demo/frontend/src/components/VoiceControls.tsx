import { useRef, useState } from 'react';
import { Button, TextArea, InlineLoading, InlineNotification } from '@carbon/react';
import { Microphone, StopFilled, DocumentAudio, Send } from '@carbon/icons-react';
import { api } from '../services/api';
import './VoiceControls.scss';

interface VoiceControlsProps {
  /** Called with the transcript once audio is transcribed (or a transcript is pasted). */
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

// Azure Speech STT REST API only reliably handles PCM WAV. Instead of letting
// MediaRecorder produce webm/opus (which Azure silently fails to decode), we use
// AudioContext + ScriptProcessor to capture raw 16kHz mono PCM and encode it as
// a standard WAV file ourselves.
const STT_SAMPLE_RATE = 16000;

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    pcm[i] = Math.max(-32768, Math.min(32767, samples[i] * 32768));
  }
  const dataLen = pcm.byteLength;
  const buf = new ArrayBuffer(44 + dataLen);
  const v = new DataView(buf);
  const le = true;
  // RIFF header
  v.setUint32(0, 0x52494646, false); // 'RIFF'
  v.setUint32(4, 36 + dataLen, le);
  v.setUint32(8, 0x57415645, false); // 'WAVE'
  // fmt chunk
  v.setUint32(12, 0x666d7420, false); // 'fmt '
  v.setUint32(16, 16, le);           // chunk size
  v.setUint16(20, 1, le);            // PCM
  v.setUint16(22, 1, le);            // mono
  v.setUint32(24, sampleRate, le);
  v.setUint32(28, sampleRate * 2, le); // byte rate
  v.setUint16(32, 2, le);              // block align
  v.setUint16(34, 16, le);             // bits per sample
  // data chunk
  v.setUint32(36, 0x64617461, false); // 'data'
  v.setUint32(40, dataLen, le);
  new Int16Array(buf, 44).set(pcm);
  return new Blob([buf], { type: 'audio/wav' });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Voice input controls for the web intake Test Chat. Supports three paths, all of
 * which transcribe via the /voice/transcribe endpoint:
 *  - live mic capture — captured as 16kHz PCM WAV via AudioContext
 *  - uploading a recorded voice note (the no-mic, testable seam)
 *  - pasting a transcript directly (fallback when mic/STT is unavailable)
 */
export const VoiceControls = ({ onTranscript, disabled }: VoiceControlsProps) => {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const transcribeBlob = async (blob: Blob, mimeType: string) => {
    setBusy(true);
    setError(null);
    try {
      if (blob.size < 200) {
        setError('Recording was too short — no audio captured. Speak for at least 1–2 seconds.');
        return;
      }
      const audioBase64 = await blobToBase64(blob);
      const result = await api.transcribeVoice(audioBase64, mimeType);
      if (result.text?.trim()) {
        onTranscript(result.text.trim());
      } else {
        setError('No speech was detected. Make sure your microphone is not muted and speak clearly.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setBusy(false);
    }
  };

  const startRecording = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone not available. Upload a voice note or paste a transcript instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      pcmChunksRef.current = [];

      // Create AudioContext at target sample rate; browser will resample if needed.
      const ctx = new AudioContext({ sampleRate: STT_SAMPLE_RATE });
      const source = ctx.createMediaStreamSource(stream);
      // 4096-sample buffer, 1 input channel, 1 output channel
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        const buf = e.inputBuffer.getChannelData(0);
        pcmChunksRef.current.push(new Float32Array(buf));
      };
      source.connect(processor);
      processor.connect(ctx.destination);

      audioCtxRef.current = ctx;
      processorRef.current = processor;
      sourceRef.current = source;
      setRecording(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not access the microphone: ${err.message}`
          : 'Could not access the microphone.',
      );
    }
  };

  const stopRecording = () => {
    setRecording(false);

    // Disconnect the audio graph before closing the context
    sourceRef.current?.disconnect();
    processorRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());

    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    sourceRef.current = null;
    processorRef.current = null;
    streamRef.current = null;

    // Merge all PCM chunks into a single Float32Array and encode as WAV
    const chunks = pcmChunksRef.current;
    pcmChunksRef.current = [];
    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const c of chunks) { merged.set(c, offset); offset += c.length; }

    const wavBlob = encodeWav(merged, STT_SAMPLE_RATE);
    void transcribeBlob(wavBlob, 'audio/wav');
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await transcribeBlob(file, file.type || 'audio/wav');
  };

  const submitPaste = () => {
    if (!pasteText.trim()) return;
    onTranscript(pasteText.trim());
    setPasteText('');
    setShowPaste(false);
  };

  return (
    <div className="voice-controls">
      <div className="voice-controls-row">
        {recording ? (
          <Button
            size="sm"
            kind="danger"
            renderIcon={StopFilled}
            onClick={stopRecording}
            disabled={disabled || busy}
          >
            Stop & transcribe
          </Button>
        ) : (
          <Button
            size="sm"
            kind="tertiary"
            renderIcon={Microphone}
            onClick={startRecording}
            disabled={disabled || busy}
          >
            Record
          </Button>
        )}

        <Button
          size="sm"
          kind="ghost"
          renderIcon={DocumentAudio}
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || busy || recording}
        >
          Upload voice note
        </Button>

        <Button
          size="sm"
          kind="ghost"
          onClick={() => setShowPaste((s) => !s)}
          disabled={disabled || busy || recording}
        >
          Paste transcript
        </Button>

        {busy && <InlineLoading description="Transcribing..." />}
        {recording && <span className="voice-recording-indicator">● Recording…</span>}

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
      </div>

      {showPaste && (
        <div className="voice-paste">
          <TextArea
            id="voice-paste-text"
            labelText="Voice note transcript"
            placeholder="Paste or type what the voice note says…"
            value={pasteText}
            rows={2}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <Button size="sm" renderIcon={Send} onClick={submitPaste} disabled={!pasteText.trim()}>
            Use transcript
          </Button>
        </div>
      )}

      {error && (
        <InlineNotification
          kind="warning"
          title="Voice"
          subtitle={error}
          lowContrast
          onCloseButtonClick={() => setError(null)}
        />
      )}
    </div>
  );
};

export default VoiceControls;
