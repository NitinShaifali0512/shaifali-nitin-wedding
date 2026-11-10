/**
 * Prepares a photograph for upload: it is scaled down to a sensible size and
 * re-encoded, so a 12 MB phone photo becomes a few hundred kilobytes and the
 * invitation stays fast on mobile data.
 */

export interface PreparedImage {
  blob: Blob;
  extension: string;
  contentType: string;
  width: number;
  height: number;
}

const MAX_EDGE = 2000;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This file could not be read as a picture. Please choose a JPG or PNG photograph.'));
    };
    image.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareImage(file: File, maxEdge = MAX_EDGE): Promise<PreparedImage> {
  // Animated GIFs are uploaded untouched so they keep moving.
  if (file.type === 'image/gif') {
    return { blob: file, extension: 'gif', contentType: 'image/gif', width: 0, height: 0 };
  }

  const image = await loadImage(file);
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not process the picture.');
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  // Pictures that may have see-through areas (logos, monograms) keep them.
  const mayBeTransparent = file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/avif';
  if (mayBeTransparent) {
    const webp = await toBlob(canvas, 'image/webp', 0.9);
    if (webp && webp.type === 'image/webp') return { blob: webp, extension: 'webp', contentType: 'image/webp', width, height };
    const png = await toBlob(canvas, 'image/png', 1);
    if (png) return { blob: png, extension: 'png', contentType: 'image/png', width, height };
  }

  const jpeg = await toBlob(canvas, 'image/jpeg', 0.86);
  if (!jpeg) throw new Error('This browser could not process the picture.');
  return { blob: jpeg, extension: 'jpg', contentType: 'image/jpeg', width, height };
}

export const AUDIO_TYPES: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
};

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** Works out the type of an audio file, also when the browser does not report one. */
export function audioTypeOf(file: File): { contentType: string; extension: string } | null {
  if (AUDIO_TYPES[file.type]) return { contentType: file.type === 'audio/mp3' ? 'audio/mpeg' : file.type, extension: AUDIO_TYPES[file.type] };
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const byExtension: Record<string, string> = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', wav: 'audio/wav' };
  return byExtension[extension] ? { contentType: byExtension[extension], extension } : null;
}
