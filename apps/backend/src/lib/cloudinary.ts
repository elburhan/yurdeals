import { UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import { env } from '../config';
import { AppError } from '../middleware/errorHandler';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface UploadedImageResult {
  url: string;
  publicId: string;
}

export async function uploadProductImage(buffer: Buffer): Promise<UploadedImageResult> {
  assertCloudinaryConfigured();

  const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'yurdeals/products',
        resource_type: 'image',
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary upload failed'));
          return;
        }

        resolve(result);
      },
    );

    stream.end(buffer);
  });

  return {
    url: uploadResult.secure_url,
    publicId: uploadResult.public_id,
  };
}

function assertCloudinaryConfigured(): void {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new AppError('Cloudinary image uploads are not configured', 503, 'CLOUDINARY_NOT_CONFIGURED');
  }
}
