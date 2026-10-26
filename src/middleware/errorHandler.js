const multer = require('multer');

function errorHandler(err, req, res, next) {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Profile photo must be 5 MB or smaller.' });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }

  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error(err);

  res.status(500).json({ error: 'Internal server error' });
}

module.exports = errorHandler;
