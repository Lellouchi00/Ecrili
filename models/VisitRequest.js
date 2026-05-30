const mongoose = require("mongoose");

const visitRequestSchema = new mongoose.Schema({
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Property"
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  visitDate: {
    type: Date
  },
  message: {
    type: String
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: "pending" // <--- Added default value here
  }
}, { timestamps: true }); // Adding timestamps is highly recommended for sorting!

module.exports = mongoose.model("VisitRequest", visitRequestSchema);