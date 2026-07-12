import { useRef, useState } from 'react';
import { Button, TextInput } from '@carbon/react';
import { Microphone, StopFilled, Send } from '@carbon/icons-react';
import { api } from '../../services/api';
import './FNOLComposer.scss';

interface Props {
  onSend: (text: string, rawTranscript?: string) => void;
  onInteract?: () => void;  // called when user starts typing or hits mic — stops TTS
  disabled?: boolean;
  voiceEnabled?: boolean;
  placeholder?: string;
}

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
  v.setUint32(0, 0x52494646, false);
  v.setUint32(4, 36 + dataLen, le);
  v.setUint32(8, 0x57415645, false);
  v.setUint32(12, 0x666d7420, false);
  v.setUint32(16, 16, le);
  v.setUint16(20, 1, le);
  v.setUint16(22, 1, le);
  v.setUint32(24, sampleRate, le);
  v.setUint32(28, sampleRate * 2, le);
  v.setUint16(32, 2, le);
  v.setUint16(34, 16, le);
  v.setUint32(36, 0x64617461, false);
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
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export const FNOLComposer = ({ onSend, onInteract, disabled, voiceEnabled, placeholder }: Props) => {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startRecording = async () => {
    onInteract?.();  // stop TTS before starting to record
    setMicError(null);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: STT_SAMPLE_RATE });
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      processor.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(data));
      };
      source.connect(processor);
      processor.connect(ctx.destination);
      setRecording(true);
    } catch (err) {
      setMicError('Microphone access denied');
    }
  };

  const stopRecording = async () => {
    setRecording(false);
    setTranscribing(true);

    processorRef.current?.disconnect();
    audioCtxRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());

    const totalLen = chunksRef.current.reduce((n, c) => n + c.length, 0);
    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const chunk of chunksRef.current) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    try {
      const wav = encodeWav(merged, STT_SAMPLE_RATE);
      const audioBase64 = await blobToBase64(wav);
      const result = await api.transcribeVoice(audioBase64, 'audio/wav');
      if (result.text?.trim()) {
        onSend(result.text.trim(), result.text.trim());
      } else {
        setMicError('No speech detected — please try again or type your message');
      }
    } catch {
      setMicError('Transcription failed — please type your message');
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <div className="fnol-composer">
      {micError && (
        <p className="fnol-composer__error" role="alert">{micError}</p>
      )}
      <div className="fnol-composer__row">
        <TextInput
          id="fnol-composer-input"
          labelText=""
          hideLabel
          placeholder={placeholder ?? 'Type a message…'}
          value={text}
          onChange={(e) => { onInteract?.(); setText(e.target.value); }}
          onKeyDown={handleKey}
          disabled={disabled || recording || transcribing}
          size="lg"
        />

        {voiceEnabled && (
          <Button
            kind={recording ? 'danger' : 'ghost'}
            size="lg"
            renderIcon={recording ? StopFilled : Microphone}
            iconDescription={recording ? 'Stop recording' : 'Start recording'}
            hasIconOnly
            onClick={recording ? stopRecording : startRecording}
            disabled={disabled || transcribing}
            aria-label={recording ? 'Stop recording' : 'Start voice input'}
          />
        )}

        <Button
          kind="primary"
          size="lg"
          renderIcon={Send}
          iconDescription="Send"
          hasIconOnly
          onClick={handleSend}
          disabled={disabled || !text.trim() || recording || transcribing}
          aria-label="Send message"
        />
      </div>
      {transcribing && (
        <p className="fnol-composer__hint" aria-live="polite">Transcribing…</p>
      )}
      {recording && (
        <p className="fnol-composer__hint fnol-composer__hint--recording" aria-live="polite">
          Recording — tap stop when done
        </p>
      )}
    </div>
  );
};
