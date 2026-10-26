const multer = require('multer');

const uploadProfilePhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!supportedTypes.includes(file.mimetype)) {
      const error = new Error('Profile photo must be a JPEG, PNG, or WebP image.');
      error.status = 400;
      callback(error);
      return;
    }
    callback(null, true);
  },
});

module.exports = uploadProfilePhoto;
