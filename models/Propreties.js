const mongoose = require("mongoose");

const PropertySchema = new mongoose.Schema(
{
  title: {
    type: String,
    required: true
  },

  type: {
    type: String,
    enum: ["apartment","villa","studio","house"],
    
  },

  area: {
    type: Number,
    
  },

  rooms: {
    type: Number,
   
  },

  bathrooms: {
    type: Number,
    
  },

  floor: Number,

  description: {
    type: String,
   
  },

  amenities: [
    {
      type: String,
      enum: [
        "wifi",
        "parking",
        "ac",
        "elevator",
        "balcony",
        "furnished",
        "security",
        "garden"
      ]
    }
  ],

  location: {
    address: String,
    city: String,
    state: String,
    country: {
      type: String,
      default: "Algeria"
    },
    lat: Number,
    lng: Number
  },

  price: {
    type: Number,
    
  },

  deposit: {
    type: Number,
    
  },

  availability_date: {
    type: Date,
    
  },

  rental_duration: {
    type: String,
    enum: ["long_term","short_term","flexible"],
    
  },

  images: [String],

  contact: {
    owner_name: String,
    phone: String,
    second_phone: String,
    show_phone: {
      type: Boolean,
      default: true
    }
  },

  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  status: {
    type: String,
    enum: ["pending_review","available","rented","unavailable"],
    default: "pending_review"
  }

},
{ timestamps: true }
);

module.exports = mongoose.model("Property", PropertySchema);