/**
 * Evidence Upload Routes
 * 
 * Handles actual file upload for FNOL evidence (photos, documents).
 * Files are stored in Azure Blob Storage and optionally analyzed via GPT-4V.
 * Analysis text is indexed into the Digital Steward's claim chunks.
 */

import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { getSession, addEvidence } from '../services/fnolSessionService';
import { BlobStorageFactory, BlobStorageServiceInterface } from '../services/blobStorageService';
import { analyzeEvidenceImage } from '../services/evidenceAnalysisService';
import type { EvidenceItem } from '../types/fnolSession';

const router = Router();
const blobStorage: BlobStorageServiceInterface = BlobStorageFactory.create();

function isImageMime(mimeType: string): boolean {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(mimeType);
}

// Multer config: memory storage, max 10 files, 10MB each, images + common documents
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/rtf',
      'text/markdown',
      'text/x-markdown',
    ];
    const allowedExtensions = ['.md', '.markdown'];
    const fileExtension = extname(file.originalname).toLowerCase();
    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Accepted types are images, PDF, Word, Markdown, RTF, and text documents.`));
    }
  },
});

export type EvidenceCategory =
  | 'own_vehicle'
  | 'third_party'
  | 'scene'
  | 'medical_record'
  | 'witness_statement'
  | 'police_report'
  | 'other';

/**
 * POST /api/v1/fnol/sessions/:id/evidence/upload
 * 
 * Accepts multipart/form-data with:
 *   - files[]: one or more image or document files
 *   - category: 'own_vehicle' | 'third_party' | 'scene' | 'medical_record' | 'witness_statement' | 'police_report' | 'other'
 *   - idempotencyKey: string
 * 
 * Returns: EvidenceItem[] with blobName, analysisText, category
 */
router.post('/:id/evidence/upload', upload.array('files', 10), async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const session = await getSession(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'No files provided' } });
    }

    const category = (req.body.category as EvidenceCategory) || 'other';
    const idempotencyKey = req.body.idempotencyKey || randomUUID();

    // Check idempotency
    if (session.idempotencyLog[idempotencyKey]) {
      return res.json({ success: true, data: session.idempotencyLog[idempotencyKey] });
    }

    const results: EvidenceItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const evidenceId = randomUUID();

      // Upload to blob storage
      const blobResult = await blobStorage.uploadFile(
        sessionId,
        evidenceId,
        file.buffer,
        file.mimetype,
        file.originalname
      );

      const recordType: EvidenceItem['type'] = isImageMime(file.mimetype) ? 'photo' : 'document';
      let analysisText = '';
      if (recordType === 'photo') {
        try {
          analysisText = await analyzeEvidenceImage(file.buffer, file.mimetype, category);
        } catch (err) {
          console.warn(`Image analysis failed for ${file.originalname}:`, err);
        }
      }

      // Record evidence in session
      const item = await addEvidence(sessionId, {
        type: recordType,
        filename: file.originalname,
        mimeType: file.mimetype,
        idempotencyKey: `${idempotencyKey}-${i}`,
        // Extended fields stored via the session service
        blobName: blobResult.blobName,
        containerName: blobResult.containerName,
        category,
        analysisText,
      });

      results.push(item);
    }

    res.status(201).json({ success: true, data: results });
  } catch (error: any) {
    if (error.message?.includes('Unsupported file type')) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: error.message } });
    }
    next(error);
  }
});

/**
 * GET /api/v1/fnol/evidence-files/:sessionId/:filename
 * 
 * Proxy endpoint to retrieve uploaded evidence files.
 * Generates short-lived access without exposing blob URLs.
 */
router.get('/evidence-files/:sessionId/:filename', async (req, res, next) => {
  try {
    const blobName = `${req.params.sessionId}/${req.params.filename}`;
    const buffer = await blobStorage.getFileBuffer('fnol-evidence', blobName);

    // Determine content type from extension
    const ext = req.params.filename.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      heic: 'image/heic',
      heif: 'image/heif',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain',
      rtf: 'application/rtf',
      md: 'text/markdown',
      markdown: 'text/markdown',
    };

    res.set('Content-Type', mimeMap[ext || ''] || 'application/octet-stream');
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
    }
    next(error);
  }
});

export default router;
