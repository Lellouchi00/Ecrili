const router = require("express").Router();
const Property = require("../models/Propreties");
const Review = require("../models/review");
const Notification = require("../models/notification");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");
const cloudinary = require("../config/cloudinary");
const upload = require("../middleware/upload");

//---------------------------
// Get All Properties
//---------------------------
router.get("/all", async (req, res) => {
  try {
    const properties = await Property.find();
    res.json({ success: true, data: properties });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//---------------------------
// Get Properties By Owner
//---------------------------
router.get('/allByOwner', auth, async (req, res) => {
  try {
    const userProperties = await Property.find({ owner: req.user.id });
    res.json({ success: true, data: userProperties });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//---------------------------
// Get Properties Stats Overview
//---------------------------
router.get("/stats/overview", async (req, res) => {
  try {
    const stats = await Property.aggregate([
      {
        $match: {
          status: "available",
          "location.city": { $ne: null }
        }
      },
      {
        $facet: {
          general: [
            {
              $group: {
                _id: null,
                totalProperties: { $sum: 1 },
                avgPrice: { $avg: "$price" },
                avgRating: { $avg: "$ratingsAverage" },
                totalViews: { $sum: "$views" },
                maxPrice: { $max: "$price" },
                minPrice: { $min: "$price" }
              }
            }
          ],
          byCity: [
            {
              $group: {
                _id: "$location.city",
                count: { $sum: 1 },
                avgPrice: { $avg: "$price" }
              }
            },
            { $sort: { count: -1 } }
          ]
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        general: stats[0].general[0] || {},
        byCity: stats[0].byCity
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//---------------------------
// Search Properties With Filters
//---------------------------
router.get("/", async (req, res) => {
  try {
    const { location, room_type, min_price, max_price, page, limit, sort } = req.query;

    if (!location || !room_type || !min_price || !max_price || !page || !limit) {
      return res.status(400).json({ success: false, error: "VALIDATION_ERROR" });
    }

    if (isNaN(Number(min_price)) || isNaN(Number(max_price)) || isNaN(Number(page)) || isNaN(Number(limit))) {
      return res.status(400).json({ success: false, error: "INVALID_NUMBERS" });
    }

    if (Number(min_price) > Number(max_price)) {
      return res.status(400).json({ success: false, error: "INVALID_PRICE_RANGE" });
    }

    const query = {
      "location.city": location,
      type: room_type,
      price: { $gte: Number(min_price), $lte: Number(max_price) },
      status: "available"
    };

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    const sortOptions = {
      latest: { createdAt: -1 },
      best_price: { price: 1 },
      popular: { views: -1 },
      trending: { views: -1 }
    };

    const properties = await Property.find(query)
      .sort(sortOptions[sort] || {})
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate("owner", "name avatar rating");

    const total = await Property.countDocuments(query);

    res.json({
      success: true,
      data: {
        properties,
        pagination: {
          current_page: pageNumber,
          total_pages: Math.ceil(total / limitNumber),
          total_items: total
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//---------------------------
// Get Single Property By ID
//---------------------------
router.get("/:id", async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).populate("owner");

    if (!property) {
      return res.status(404).json({ success: false, error: "PROPERTY_NOT_FOUND" });
    }

    await Property.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

    res.json({ success: true, data: property });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", auth, upload.array("images", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: "VALIDATION_ERROR" });
    }

    const requiredFields = ['title', 'type', 'city', 'price'];
  

    const uploadedImages = [];
    for (const file of req.files) {
      const result = await cloudinary.uploader.upload(
        `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
        { folder: "properties" }
      );
      uploadedImages.push(result.secure_url);
    }

    const property = new Property({
      title: req.body.title,
      type: req.body.type,
      description: req.body.description || "",
      area: req.body.area || 0,
      rooms: req.body.rooms || 0,
      bathrooms: req.body.bathrooms || 0,
      floor: req.body.floor || 0,
      amenities: req.body.amenities || [],
      location: {
        address: req.body.address || "",
        city: req.body.city,
        state: req.body.state || "",
        country: req.body.country || "Algeria"
      },
      price: req.body.price,
      deposit: req.body.deposit || 0,
      availability_date: req.body.availability_date || null,
      rental_duration: req.body.rental_duration || "flexible",
      contact: {
        owner_name: req.body.owner_name || "",
        phone: req.body.phone || "",
        second_phone: req.body.second_phone || "",
        show_phone: req.body.show_phone === true || req.body.show_phone === "true"
      },
      images: uploadedImages,
      owner: req.user.id,
      status: "pending_review",
      specifications: {
        bedrooms: req.body.specifications?.bedrooms || req.body.rooms || 0,
        bathrooms: req.body.specifications?.bathrooms || req.body.bathrooms || 0,
        area: req.body.specifications?.area || req.body.area || 0,
        builtIn: req.body.specifications?.builtIn || null,
        parking: req.body.specifications?.parking === true || req.body.specifications?.parking === "true",
        internet: req.body.specifications?.internet === true || req.body.specifications?.internet === "true",
        available: req.body.specifications?.available || "Immediately",
        security: req.body.specifications?.security === true || req.body.specifications?.security === "true",
        furnished: req.body.specifications?.furnished === true || req.body.specifications?.furnished === "true",
        petFriendly: req.body.specifications?.petFriendly === true || req.body.specifications?.petFriendly === "true",
        smookingAllowed: req.body.specifications?.smookingAllowed === true || req.body.specifications?.smookingAllowed === "true",
        heating: req.body.specifications?.heating === true || req.body.specifications?.heating === "true",
        cooling: req.body.specifications?.cooling === true || req.body.specifications?.cooling === "true",
        washer: req.body.specifications?.washer === true || req.body.specifications?.washer === "true",
        dryer: req.body.specifications?.dryer === true || req.body.specifications?.dryer === "true",
        dishwasher: req.body.specifications?.dishwasher === true || req.body.specifications?.dishwasher === "true",
        balcony: req.body.specifications?.balcony === true || req.body.specifications?.balcony === "true",
        garden: req.body.specifications?.garden === true || req.body.specifications?.garden === "true",
        pool: req.body.specifications?.pool === true || req.body.specifications?.pool === "true",
        gym: req.body.specifications?.gym === true || req.body.specifications?.gym === "true",
        elevator: req.body.specifications?.elevator === true || req.body.specifications?.elevator === "true",
        wheelchairAccess: req.body.specifications?.wheelchairAccess === true || req.body.specifications?.wheelchairAccess === "true"
      }
    });

    await property.save();

    await Notification.create({
      user: property.owner,
      title: "New Property",
      message: "Property created",
      type: "review"
    });

    res.status(201).json({ success: true, data: property });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
//---------------------------
// Add To Favorites
//---------------------------
router.post("/add_to_favoris", auth, async (req, res) => {
  const { postId } = req.body;

  if (!postId) {
    return res.status(400).json({ success: false });
  }

  try {
    const user = await User.findById(req.user.id);
    const property = await Property.findById(postId);

    if (!user || !property) {
      return res.status(404).json({ success: false });
    }

    if (user.favoris.includes(postId)) {
      return res.status(400).json({ success: false });
    }

    user.favoris.push(postId);
    await user.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;