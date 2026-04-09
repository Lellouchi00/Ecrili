const mongoose = require("mongoose");

<<<<<<< HEAD
const PropertySchema = new mongoose.Schema(
{
  title: {
    type: String,
    required: true
=======
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
    favoris: [
   {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post"
   }
],

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
>>>>>>> 62a1163 (added new feature / fixed bug)
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

module.exports = mongoose.model("Property", PropertySchema);