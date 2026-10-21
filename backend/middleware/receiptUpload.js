import multer from 'multer';

const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
export default multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(req, file, done) {
    if (!allowedTypes.has(file.mimetype)) return done(Object.assign(new Error('Use a PNG, JPG or WebP receipt.'), { status: 400 }));
    done(null, true);
  },
});

export function receiptImage(file) {
  if (!file) return null;
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}
