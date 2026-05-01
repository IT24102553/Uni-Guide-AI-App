const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 10;
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

function isPasswordHash(value) {
  return BCRYPT_HASH_PATTERN.test(String(value || ""));
}

async function hashPassword(password) {
  return bcrypt.hash(String(password || ""), SALT_ROUNDS);
}

async function verifyPasswordAndUpgrade(user, password) {
  const candidatePassword = String(password || "");
  const storedPassword = String(user?.password || "");

  if (!storedPassword) {
    return false;
  }

  if (isPasswordHash(storedPassword)) {
    return bcrypt.compare(candidatePassword, storedPassword);
  }

  if (storedPassword !== candidatePassword) {
    return false;
  }

  user.password = await hashPassword(candidatePassword);
  await user.save();
  return true;
}

module.exports = {
  isPasswordHash,
  hashPassword,
  verifyPasswordAndUpgrade,
};
