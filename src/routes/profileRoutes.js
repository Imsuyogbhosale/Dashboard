const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const uploadProfilePhoto = require('../middleware/profileUpload');
const {
  getOwnProfile,
  createOwnProfile,
  updateOwnProfile,
  uploadOwnPhoto,
} = require('../controllers/profileController');

const router = express.Router();

router.use(authenticate);
router.get('/', getOwnProfile);
router.post('/', createOwnProfile);
router.patch('/', updateOwnProfile);
router.post('/photo', uploadProfilePhoto.single('photo'), uploadOwnPhoto);

module.exports = router;
