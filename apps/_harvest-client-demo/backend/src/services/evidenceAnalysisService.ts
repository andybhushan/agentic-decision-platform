/**
 * Evidence Image Analysis Service
 *
 * Uses Azure AI Foundry vision to generate text descriptions of evidence photos.
 * This path intentionally does not invent fallback descriptions when the AI call
 * is unavailable or returns unusable output.
 */

import type { EvidenceCategory } from '../routes/evidenceUploadRoutes';

function getFoundryBaseEndpoint(): string | null {
  const endpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
  if (!endpoint) return null;
  return endpoint.replace(/\/$/, '').split('/api/projects/')[0];
}

function getVisionDeployment(): string | null {
  const deployment = process.env.FOUNDRY_VISION_DEPLOYMENT?.trim();
  return deployment || null;
}

/**
 * Analyze an evidence image and return a text description suitable for
 * vector indexing by the Digital Steward.
 */
export async function analyzeEvidenceImage(
  imageBuffer: Buffer,
  mimeType: string,
  category: EvidenceCategory
): Promise<string> {
  const endpoint = getFoundryBaseEndpoint();
  const apiKey = process.env.FOUNDRY_API_KEY;
  const deployment = getVisionDeployment();

  if (!endpoint || !apiKey || !deployment) {
    throw new Error(
      'Evidence image analysis requires FOUNDRY_PROJECT_ENDPOINT, FOUNDRY_API_KEY, and FOUNDRY_VISION_DEPLOYMENT in .env.'
    );
  }

  try {
    const base64Image = imageBuffer.toString('base64');
    const dataUri = `data:${mimeType};base64,${base64Image}`;

    const categoryPrompt = getCategoryPrompt(category);

    const response = await fetch(`${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-12-01-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a claims evidence analyst. Describe the damage visible in this insurance claim photo in 1-2 concise sentences. Focus on: vehicle make/colour if visible, damage location, severity, and any notable details (paint transfer, airbag deployment, fluid leaks).',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: categoryPrompt },
              { type: 'image_url', image_url: { url: dataUri, detail: 'low' } },
            ],
          },
        ],
        max_tokens: 150,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vision API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json() as any;
    const description = data.choices?.[0]?.message?.content?.trim();
    if (!description) {
      throw new Error('Vision API returned no description for the uploaded evidence image.');
    }
    return description;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Vision API call failed:', message);
    throw new Error(`Evidence image analysis failed: ${message}`);
  }
}

function getCategoryPrompt(category: EvidenceCategory): string {
  switch (category) {
    case 'own_vehicle':
      return 'This is a photo of the policyholder\'s own vehicle damage from a motor claim. Describe the visible damage.';
    case 'third_party':
      return 'This is a photo of the third-party vehicle damage from a motor claim. Describe the visible damage.';
    case 'scene':
      return 'This is a photo of the accident scene from a motor claim. Describe what is visible (road conditions, debris, surroundings).';
    default:
      return 'This is an evidence photo from an insurance claim. Describe what you see.';
  }
}
