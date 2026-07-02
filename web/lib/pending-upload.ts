"use client";

const pendingUploads = new Map<string, File>();

export function setPendingProjectUpload(projectId: string, file: File): void {
  pendingUploads.set(projectId, file);
}

export function consumePendingProjectUpload(projectId: string): File | null {
  const file = pendingUploads.get(projectId) ?? null;
  pendingUploads.delete(projectId);
  return file;
}
