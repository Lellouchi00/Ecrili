const mongoose = require("mongoose");

// Create schema for password reset
const PasswordResetSchema = new mongoose.Schema({
  userId: String, // ID of the user requesting reset
  resetString: String, // Hashed reset string
  createdAt: Date, // Creation time
  expiresAt: Date, // Expiration time
});

// Export model
module.exports = mongoose.model("PasswordReset", PasswordResetSchema);