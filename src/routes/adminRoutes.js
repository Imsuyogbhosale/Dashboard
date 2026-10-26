const express = require('express');
const { authenticate, authorizeRoles } = require('../middleware/authMiddleware');
const uploadProfilePhoto = require('../middleware/profileUpload');
const {
  getUserProfile,
  updateUserProfile,
  uploadUserPhoto,
} = require('../controllers/profileController');

const router = express.Router();

router.get('/dashboard', authenticate, authorizeRoles('admin', 'superadmin'), (req, res) => {
  res.json({ message: 'Admin access granted.', user: req.user });
});
router.get('/profiles/:userId', authenticate, authorizeRoles('admin', 'superadmin'), getUserProfile);
router.patch('/profiles/:userId', authenticate, authorizeRoles('admin', 'superadmin'), updateUserProfile);
router.post(
  '/profiles/:userId/photo',
  authenticate,
  authorizeRoles('admin', 'superadmin'),
  uploadProfilePhoto.single('photo'),
  uploadUserPhoto,
);

module.exports = router;
