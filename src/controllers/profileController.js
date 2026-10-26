const profileService = require('../services/profileService');

async function getOwnProfile(req, res, next) {
  try {
    res.json({ profile: await profileService.getProfile(req.user.id) });
  } catch (error) {
    next(error);
  }
}

async function updateOwnProfile(req, res, next) {
  try {
    res.json({ profile: await profileService.updateProfile(req.user.id, req.body) });
  } catch (error) {
    next(error);
  }
}

async function createOwnProfile(req, res, next) {
  try {
    const profile = await profileService.createProfile(req.user.id, req.body);
    res.status(201).json({ profile });
  } catch (error) {
    next(error);
  }
}

async function uploadOwnPhoto(req, res, next) {
  try {
    res.json({ profile: await profileService.updateProfilePhoto(req.user.id, req.file) });
  } catch (error) {
    next(error);
  }
}

async function getUserProfile(req, res, next) {
  try {
    res.json({ profile: await profileService.getProfile(req.params.userId) });
  } catch (error) {
    next(error);
  }
}

async function updateUserProfile(req, res, next) {
  try {
    res.json({ profile: await profileService.updateProfile(req.params.userId, req.body) });
  } catch (error) {
    next(error);
  }
}

async function uploadUserPhoto(req, res, next) {
  try {
    res.json({ profile: await profileService.updateProfilePhoto(req.params.userId, req.file) });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getOwnProfile,
  createOwnProfile,
  updateOwnProfile,
  uploadOwnPhoto,
  getUserProfile,
  updateUserProfile,
  uploadUserPhoto,
};
