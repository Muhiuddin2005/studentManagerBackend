import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { supabase, isSupabaseConfigured } from '../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../uploads');

// Ensure local uploads directory exists (safely skipped in serverless read-only filesystems)
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch {
  // Ignored in read-only serverless environments where Supabase is used
}

// Multer memory storage
const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (allowedMime.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WEBP, GIF) and PDFs are allowed.'));
    }
  }
});

export interface UploadResult {
  fileUrl: string | null;
  fileName: string | null;
}

let isBucketVerifiedPublic = false;

/**
 * Ensures the Supabase storage bucket exists and is set to public
 */
export async function ensureBucketPublic(): Promise<void> {
  if (isBucketVerifiedPublic || !isSupabaseConfigured || !supabase) return;
  try {
    const bucketName = process.env.STORAGE_BUCKET || 'problem-screenshots';
    const { data: buckets } = await supabase.storage.listBuckets();
    const existing = buckets?.find(b => b.name === bucketName || b.id === bucketName);

    if (!existing) {
      const { error } = await supabase.storage.createBucket(bucketName, { public: true });
      if (!error) {
        console.log(`✅ Supabase bucket '${bucketName}' created with public: true`);
        isBucketVerifiedPublic = true;
      }
    } else if (!existing.public) {
      const { error } = await supabase.storage.updateBucket(bucketName, { public: true });
      if (!error) {
        console.log(`✅ Supabase bucket '${bucketName}' updated to public: true`);
        isBucketVerifiedPublic = true;
      }
    } else {
      isBucketVerifiedPublic = true;
    }
  } catch (err: any) {
    console.warn('⚠️ Bucket verification warning:', err?.message);
  }
}

// Check bucket on module load
ensureBucketPublic();

/**
 * Uploads file to Supabase Storage or local disk fallback
 */
export async function saveAttachmentFile(
  file: Express.Multer.File | undefined, 
  taskId?: string
): Promise<UploadResult> {
  if (!file) return { fileUrl: null, fileName: null };

  await ensureBucketPublic();

  const timestamp = Date.now();
  const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `${taskId || 'general'}_${timestamp}_${sanitizedName}`;

  if (isSupabaseConfigured && supabase) {
    try {
      const bucketName = process.env.STORAGE_BUCKET || 'problem-screenshots';
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(fileName);

        return {
          fileUrl: publicUrlData.publicUrl,
          fileName: file.originalname
        };
      }
      console.warn('⚠️ Supabase Storage error, falling back to local storage:', error?.message);
    } catch (err: any) {
      console.warn('⚠️ Supabase Storage exception, using local storage:', err.message);
    }
  }

  // Fallback: save to local disk if writable
  try {
    const localFilePath = path.join(uploadsDir, fileName);
    await fs.promises.writeFile(localFilePath, file.buffer);

    return {
      fileUrl: `/uploads/${fileName}`,
      fileName: file.originalname
    };
  } catch (err: any) {
    console.warn('⚠️ Local filesystem write skipped (serverless environment):', err?.message);
    return {
      fileUrl: null,
      fileName: file.originalname
    };
  }
}
