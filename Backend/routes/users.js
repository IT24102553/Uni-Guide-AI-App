const express = require("express");
const userController = require("../controllers/userController");
const { requireAuth, requireRoles, requireSelfOrRoles } = require("../middleware/auth");
const { profilePhotoUpload } = require("../utils/profilePhotoUpload");

const router = express.Router();

router.use(requireAuth);

function uploadProfilePhoto(req, res, next) {
  profilePhotoUpload.single("photo")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Profile photo must be 3MB or smaller."
        : error.code === "LIMIT_FILE_COUNT"
          ? "Only one profile photo can be uploaded at a time."
          : error.message || "Unable to upload the profile photo.";

    res.status(400).json({ message });
  });
}

router.post("/", requireRoles("admin"), userController.createUser);
router.get("/", requireRoles("admin"), userController.getUsers);
router.get("/profile-photos/:fileId", userController.downloadProfilePhoto);
router.post("/:id/profile-photo", requireSelfOrRoles("admin"), uploadProfilePhoto, userController.uploadProfilePhoto);
router.get("/:id/profile", requireSelfOrRoles("admin"), userController.getUserProfile);
router.put("/:id/profile", requireSelfOrRoles("admin"), userController.updateUserProfile);
router.get("/:id", requireSelfOrRoles("admin"), userController.getUserById);
router.put("/:id", requireRoles("admin"), userController.updateUser);
router.patch("/:id/status", requireRoles("admin"), userController.updateUserStatus);
router.delete("/:id", requireRoles("admin"), userController.deleteUser);

module.exports = router;
