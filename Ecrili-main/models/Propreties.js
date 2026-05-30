const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["apartment", "villa", "studio", "house"],
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

    
    specifications: {
      bedrooms: {
        type: Number,
        default: 0,
        description: "Number of bedrooms"
      },
      bathrooms: {
        type: Number,
        default: 0,
        description: "Number of bathrooms"
      },
      area: {
        type: Number,
        default: 0,
        description: "Area in square meters"
      },
      builtIn: {
        type: Number,
        default: null,
        description: "Year built (e.g., 2019)"
      },
      parking: {
        type: Boolean,
        default: false,
        description: "Has parking/garage"
      },
      internet: {
        type: Boolean,
        default: false,
        description: "Has fiber optic internet"
      },
      available: {
        type: String,
        default: "Immediately",
        enum: ["Immediately", "Within a week", "Within a month", "Custom date"],
        description: "Availability status"
      },
      security: {
        type: Boolean,
        default: false,
        description: "Has 24/7 security/CCTV"
      },
      furnished: {
        type: Boolean,
        default: false,
        description: "Is furnished"
      },
      petFriendly: {
        type: Boolean,
        default: false,
        description: "Pets allowed"
      },
      smookingAllowed: {
        type: Boolean,
        default: false,
        description: "Smoking allowed"
      },
      heating: {
        type: Boolean,
        default: false,
        description: "Has heating system"
      },
      cooling: {
        type: Boolean,
        default: false,
        description: "Has air conditioning"
      },
      washer: {
        type: Boolean,
        default: false,
        description: "Has washing machine"
      },
      dryer: {
        type: Boolean,
        default: false,
        description: "Has dryer"
      },
      dishwasher: {
        type: Boolean,
        default: false,
        description: "Has dishwasher"
      },
      balcony: {
        type: Boolean,
        default: false,
        description: "Has balcony"
      },
      garden: {
        type: Boolean,
        default: false,
        description: "Has garden"
      },
      pool: {
        type: Boolean,
        default: false,
        description: "Has swimming pool"
      },
      gym: {
        type: Boolean,
        default: false,
        description: "Has gym"
      },
      elevator: {
        type: Boolean,
        default: false,
        description: "Has elevator"
      },
      wheelchairAccess: {
        type: Boolean,
        default: false,
        description: "Wheelchair accessible"
      }
    },

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
      enum: ["long_term", "short_term", "flexible"],
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
      enum: ["pending_review", "available", "rented", "unavailable"],
      default: "pending_review"
    },

    ratingsAverage: {
      type: Number,
      default: 0
    },

    ratingsQuantity: {
      type: Number,
      default: 0
    },

    views: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Property", propertySchema);