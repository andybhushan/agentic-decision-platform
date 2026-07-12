import { Router } from 'express';
import { VoiceProviderFactory } from '../services/voice/voiceProvider';

const router = Router();

/**
 * Voice layer endpoints that sit on top of the web intake agent.
 *
 * These are intentionally two small endpoints rather than one monolith: the agent
 * turn itself reuses the existing /api/v1/agents/:id/chat path. A typical voice
 * flow is: transcribe -> chat -> synthesize.
 */

// POST /api/v1/voice/transcribe  { audioBase64, mimeType, language? } -> { text, provider }
router.post('/transcribe', async (req, res, next) => {
  try {
    const { audioBase64, mimeType, language } = req.body ?? {};
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'audioBase64 (string) is required' },
      });
    }

    const provider = VoiceProviderFactory.create();
    const result = await provider.transcribe({
      audioBase64,
      mimeType: typeof mimeType === 'string' ? mimeType : 'audio/webm',
      language: typeof language === 'string' ? language : undefined,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/voice/synthesize  { text, voice? } -> { audioBase64, mimeType, provider }
router.post('/synthesize', async (req, res, next) => {
  try {
    const { text, voice } = req.body ?? {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'text (string) is required' },
      });
    }

    const provider = VoiceProviderFactory.create();
    const result = await provider.synthesize({
      text,
      voice: typeof voice === 'string' ? voice : undefined,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
