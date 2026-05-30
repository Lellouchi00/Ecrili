const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema({

  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Property",
    required: true
  },

  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },

  comment: {
    type: String,
    required: true
  }

}, { timestamps: true });

module.exports = mongoose.model("Review", ReviewSchema);