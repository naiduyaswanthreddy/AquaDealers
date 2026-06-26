import imageCompression from 'browser-image-compression';
import { supabase } from '@/lib/supabase';

export async function compressImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: 0.05, // ~50KB max
    maxWidthOrHeight: 500, // 500x500 max dimensions
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.6,
  };

  try {
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.error('Error compressing image:', error);
    throw error;
  }
}

export async function deleteOldImage(bucket: string, oldUrl: string | null | undefined) {
  if (!oldUrl) return;
  try {
    const urlParts = oldUrl.split(`/${bucket}/`);
    if (urlParts.length === 2) {
      const oldFilePath = urlParts[1].split('?')[0];
      await supabase.storage.from(bucket).remove([oldFilePath]);
    }
  } catch (e) {
    console.error('Failed to delete old image', e);
  }
}
