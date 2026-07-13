// Evidence (damage photos) client. Uploads happen from the member wizard BEFORE the
// subject id exists; the server returns a groupId that rides on the intake record as
// evidenceGroupId, and PostIntake links it to the assigned subject. Read side resolves
// photos by subject id. Shapes mirror Functions/Evidence.cs.

import { resolveApiBase } from "./config";

export interface EvidenceUpload {
  contentType: string;
  dataBase64: string;
}

export interface EvidenceFileInfo {
  name: string;
  contentType: string;
  size: number;
}

export interface EvidenceGroup {
  groupId: string;
  files: EvidenceFileInfo[];
}

export async function uploadEvidence(images: EvidenceUpload[]): Promise<EvidenceGroup> {
  const base = resolveApiBase();
  const res = await fetch(`${base}/evidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ images }),
  });
  if (!res.ok) throw new Error(`uploadEvidence: HTTP ${res.status} ${res.statusText}`);
  const body = (await res.json()) as { groupId: string; files: string[] };
  return {
    groupId: body.groupId,
    files: body.files.map((name) => ({ name, contentType: "image/jpeg", size: 0 })),
  };
}

export async function fetchEvidenceForSubject(subjectId: string): Promise<EvidenceGroup | null> {
  const base = resolveApiBase();
  const res = await fetch(`${base}/evidence/subject/${encodeURIComponent(subjectId)}`, {
    headers: { Accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchEvidenceForSubject: HTTP ${res.status} ${res.statusText}`);
  return (await res.json()) as EvidenceGroup;
}

export function evidenceFileUrl(groupId: string, name: string): string {
  return `${resolveApiBase()}/evidence/file/${encodeURIComponent(groupId)}/${encodeURIComponent(name)}`;
}

// Reads a picked document (PDF) as base64, no resize; server cap is 5MB.
export async function prepareDocument(file: File): Promise<EvidenceUpload & { fileName: string }> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return { contentType: "application/pdf", dataBase64: btoa(binary), fileName: file.name };
}

// Browser-side downscale: reads a picked File, draws it onto a canvas capped at maxEdge,
// and returns a JPEG base64 payload sized for the 2.5MB server cap plus a preview URL.
export async function prepareImage(file: File, maxEdge = 1024): Promise<EvidenceUpload & { previewUrl: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return {
    contentType: "image/jpeg",
    dataBase64: dataUrl.slice(dataUrl.indexOf(",") + 1),
    previewUrl: dataUrl,
  };
}
