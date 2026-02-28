const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const propertySchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    images: [
      {
        url: String,
        public_id: String
      }
    ],

    category: {
      type: String,
    },

    characteristics: {
      type: String,
    },

    price: {
      type: Number,
      required: true,
    },

    rating: {
      type: Number,
      default: 0,
    },

    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    isEmpty: {
      type: Boolean,
      default: true,
    },

    numberOfRooms: {
      type: Number,
      required: true,
    },

    location: {
      type: String,
      required: true,
    },

    locationGoogle: {
      type: String,
    },
    status: {
      type: String,
      enum: ["available", "rented", "hidden"],
      default: "available"
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Property", propertySchema);