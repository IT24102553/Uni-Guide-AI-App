const userService = require("../services/userService");

function sendError(res, error, fallbackMessage) {
  res.status(error.statusCode || 500).json({
    message: error.message || fallbackMessage,
  });
}

async function createUser(req, res) {
  try {
    const result = await userService.createUser(req.body);

    res.status(201).json({
      message: "User created successfully",
      user: result.user,
      temporaryPassword: result.temporaryPassword,
    });
  } catch (error) {
    sendError(res, error, "Error creating user");
  }
}

async function getUsers(req, res) {
  try {
    const users = await userService.getUsers({
      role: req.query.role,
      search: req.query.search,
    });

    res.status(200).json({
      message: "Users fetched successfully",
      users,
    });
  } catch (error) {
    sendError(res, error, "Error fetching users");
  }
}

async function getUserById(req, res) {
  try {
    const user = await userService.getUserById(req.params.id);

    res.status(200).json({
      message: "User fetched successfully",
      user,
    });
  } catch (error) {
    sendError(res, error, "Error fetching user");
  }
}

async function updateUser(req, res) {
  try {
    const user = await userService.updateUser(req.params.id, req.body);

    res.status(200).json({
      message: "User updated successfully",
      user,
    });
  } catch (error) {
    sendError(res, error, "Error updating user");
  }
}

async function updateUserStatus(req, res) {
  try {
    const user = await userService.updateUserStatus(req.params.id, req.body.status);

    res.status(200).json({
      message: "User status updated successfully",
      user,
    });
  } catch (error) {
    sendError(res, error, "Error updating user status");
  }
}

async function deleteUser(req, res) {
  try {
    const user = await userService.deleteUser(req.params.id);

    res.status(200).json({
      message: "User deleted successfully",
      user,
    });
  } catch (error) {
    sendError(res, error, "Error deleting user");
  }
}

async function getUserProfile(req, res) {
  try {
    const result = await userService.getUserProfile(req.params.id);

    res.status(200).json({
      message: "Profile fetched successfully",
      user: result.user,
      profile: result.profile,
    });
  } catch (error) {
    sendError(res, error, "Error fetching profile");
  }
}

async function updateUserProfile(req, res) {
  try {
    const user = await userService.updateUserProfile(req.params.id, req.body);

    res.status(200).json({
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    sendError(res, error, "Error updating profile");
  }
}

async function uploadProfilePhoto(req, res) {
  try {
    const result = await userService.uploadUserProfilePhoto(req.params.id, req.file);

    res.status(200).json({
      message: "Profile photo uploaded successfully",
      user: result.user,
      profilePhoto: result.profilePhoto,
    });
  } catch (error) {
    sendError(res, error, "Error uploading profile photo");
  }
}

function sanitizeContentDispositionName(filename) {
  return String(filename || "profile-photo").replace(/["\r\n\\]+/g, "_");
}

async function downloadProfilePhoto(req, res) {
  try {
    const { file, stream } = await userService.getUserProfilePhotoDownload(
      req.params.fileId,
      req.user
    );
    const downloadName = sanitizeContentDispositionName(
      file.metadata?.originalName || file.filename || "profile-photo"
    );

    res.setHeader("Content-Type", file.contentType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${downloadName}"`);

    if (Number.isFinite(file.length)) {
      res.setHeader("Content-Length", String(file.length));
    }

    stream.on("error", (error) => {
      if (!res.headersSent) {
        sendError(res, error, "Error downloading profile photo");
        return;
      }

      res.destroy(error);
    });

    stream.pipe(res);
  } catch (error) {
    sendError(res, error, "Error downloading profile photo");
  }
}

module.exports = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  updateUserStatus,
  deleteUser,
  getUserProfile,
  downloadProfilePhoto,
  updateUserProfile,
  uploadProfilePhoto,
};
