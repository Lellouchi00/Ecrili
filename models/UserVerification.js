const mongoose = require("mongoose");

const UserVerificationSchema = new mongoose.Schema({
  userId: {
    type: String,
  },
  code: {
    type: String,
  },
  createdAt: {
    type: Date,
  },
  expiresAt: {
    type: Date,
  },
  isRestPassword: {
    type:Boolean
  }
});

module.exports = mongoose.model(
  "UserVerification",
  UserVerificationSchema
);