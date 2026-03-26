const router = require("express").Router();
const Property = require("../models/Propreties");
const Review = require("../models/review");
const auth = require("../middleware/authMiddleware");
const cloudinary = require("../config/cloudinary");
const upload = require("../middleware/upload");


// ===============================
// SEARCH PROPERTIES (FILTER + PAGINATION)
// ===============================
router.get("/", async (req, res) => {
  try {

    const { location, room_type, min_price, max_price, page, limit, sort } = req.query;

    if (!location || !room_type || !min_price || !max_price || !page || !limit) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR"
      });
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
          total_items: total,
          items_per_page: limitNumber,
          has_next: pageNumber * limitNumber < total,
          has_prev: pageNumber > 1
        }
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ===============================
// GET SINGLE PROPERTY
// ===============================
router.get("/:id", async (req, res) => {
  try {

    const property = await Property.findById(req.params.id)
      .populate("owner");

    if (!property)
      return res.status(404).json({
        success: false,
        error: "PROPERTY_NOT_FOUND"
      });

    res.json({
      success: true,
      data: property
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ===============================
// CREATE PROPERTY
// ===============================
router.post(
  "/",
  auth,
  upload.array("images", 10),
  async (req, res) => {

    try {

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR"
        });
      }

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
        area: req.body.area,
        rooms: req.body.rooms,
        bathrooms: req.body.bathrooms,
        floor: req.body.floor,
        description: req.body.description,
        amenities: req.body.amenities,
        location: {
          address: req.body.address,
          city: req.body.city,
          state: req.body.state,
          country: req.body.country
        },
        price: req.body.price,
        deposit: req.body.deposit,
        availability_date: req.body.availability_date,
        rental_duration: req.body.rental_duration,
        contact: req.body.contact,
        images: uploadedImages,
        owner: req.user.id,
        status: "pending_review"
      });

      await property.save();

      res.status(201).json({
        success: true,
        message: "Property created successfully",
        data: {
          id: property._id,
          status: property.status,
          images: uploadedImages
        }
      });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }

  }
);


// ===============================
// GET REVIEWS
// ===============================
router.get("/:id/reviews", async (req, res) => {

  try {

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 5;

    const reviews = await Review.find({ property: req.params.id })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("author", "name avatar");

    const total = await Review.countDocuments({ property: req.params.id });

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(total / limit),
          total_items: total,
          has_next: page * limit < total,
          has_prev: page > 1
        }
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});


// ===============================
// ADD REVIEW
// ===============================
router.post("/:id/reviews", auth, async (req, res) => {

  try {

    const already = await Review.findOne({
      property: req.params.id,
      author: req.user.id
    });

    if (already) {
      return res.status(409).json({
        success: false,
        error: "ALREADY_REVIEWED"
      });
    }

    const review = new Review({
      property: req.params.id,
      author: req.user.id,
      rating: req.body.rating,
      comment: req.body.comment
    });

    await review.save();

    res.json({
      success: true,
      message: "Review submitted successfully",
      data: review
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

module.exports = router;