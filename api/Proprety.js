const router = require("express").Router();
const mongoose = require("mongoose");
const Property = require("../models/Propreties");
const Review = require("../models/review");
const Notification = require("../models/notification");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");
const cloudinary = require("../config/cloudinary");
const upload = require("../middleware/upload");
const emitStatsUpdate = require("../helpers/emitStatsUpdate");

const toFiniteNumber = (value, fallback = undefined) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalizedValue =
    typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalizedValue)) {
      return true;
    }

    if (["false", "0", "no", "off"].includes(normalizedValue)) {
      return false;
    }
  }

  return Boolean(value);
};

const readBodyValue = (body, keys = []) => {
  for (const key of keys) {
    if (body?.[key] !== undefined) {
      return body[key];
    }
  }

  return undefined;
};

const normalizeAmenities = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
};

const resolveAuthorAvatar = (author = {}) =>
  author.avatar ||
  author.image ||
  author.images?.url ||
  "";

const serializeReview = (review) => {
  const normalizedReview =
    typeof review?.toObject === "function" ? review.toObject() : review;
  const author = normalizedReview?.author || {};

  return {
    ...normalizedReview,
    author: {
      _id: author._id,
      id: author._id,
      name: author.name || "",
      email: author.email || "",
      avatar: resolveAuthorAvatar(author),
    },
  };
};

const toObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : value;

const buildReviewSummary = async (propertyId) => {
  const [summaryRow] = await Review.aggregate([
    {
      $match: {
        property: toObjectId(propertyId),
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        rating: { $avg: "$rating" },
      },
    },
  ]);

  const distribution = await Review.aggregate([
    {
      $match: {
        property: toObjectId(propertyId),
      },
    },
    {
      $group: {
        _id: "$rating",
        count: { $sum: 1 },
      },
    },
  ]);

  const total = summaryRow?.total || 0;
  const normalizedDistribution = [5, 4, 3, 2, 1].map((stars) => {
    const matchedRow = distribution.find((item) => Number(item._id) === stars);
    const count = matchedRow?.count || 0;

    return {
      stars,
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });

  return {
    rating: total > 0 ? Number((summaryRow.rating || 0).toFixed(1)) : 0,
    total,
    categories: normalizedDistribution,
  };
};

const syncPropertyRatings = async (propertyId) => {
  const summary = await buildReviewSummary(propertyId);

  await Property.findByIdAndUpdate(propertyId, {
    ratingsAverage: summary.rating,
    ratingsQuantity: summary.total,
  });

  return summary;
};

const uploadImagesToCloudinary = async (files = []) => {
  const uploadedImages = [];

  for (const file of files) {
    const result = await cloudinary.uploader.upload(
      `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
      { folder: "properties" }
    );
    uploadedImages.push(result.secure_url);
  }

  return uploadedImages;
};

const applyPropertyPayload = (property, body = {}) => {
  const title = readBodyValue(body, ["title"]);
  const type = readBodyValue(body, ["type"]);
  const description = readBodyValue(body, ["description"]);
  const area = toFiniteNumber(readBodyValue(body, ["area"]), property.area);
  const rooms = toFiniteNumber(
    readBodyValue(body, ["rooms", "numberOfRooms"]),
    property.rooms
  );
  const bathrooms = toFiniteNumber(readBodyValue(body, ["bathrooms"]), property.bathrooms);
  const floor = toFiniteNumber(readBodyValue(body, ["floor"]), property.floor);
  const amenities = normalizeAmenities(readBodyValue(body, ["amenities"]));
  const address = readBodyValue(body, ["address"]);
  const city = readBodyValue(body, ["city"]);
  const state = readBodyValue(body, ["state"]);
  const country = readBodyValue(body, ["country"]);
  const latitude = toFiniteNumber(readBodyValue(body, ["lat", "location[lat]"]), property.location?.lat);
  const longitude = toFiniteNumber(readBodyValue(body, ["lng", "location[lng]"]), property.location?.lng);
  const price = toFiniteNumber(readBodyValue(body, ["price"]), property.price);
  const deposit = toFiniteNumber(readBodyValue(body, ["deposit"]), property.deposit);
  const availabilityDate = readBodyValue(body, ["availability_date"]);
  const rentalDuration = readBodyValue(body, ["rental_duration"]);
  const ownerName = readBodyValue(body, ["owner_name", "contact[owner_name]"]);
  const phone = readBodyValue(body, ["phone", "contact[phone]"]);
  const secondPhone = readBodyValue(body, ["second_phone", "contact[second_phone]"]);
  const showPhone = readBodyValue(body, ["show_phone", "contact[show_phone]"]);

  if (title !== undefined) {
    property.title = title;
  }

  if (type !== undefined) {
    property.type = type;
  }

  if (description !== undefined) {
    property.description = description;
  }

  if (area !== undefined) {
    property.area = area;
  }

  if (rooms !== undefined) {
    property.rooms = rooms;
  }

  if (bathrooms !== undefined) {
    property.bathrooms = bathrooms;
  }

  if (floor !== undefined) {
    property.floor = floor;
  }

  if (amenities.length > 0 || body?.amenities !== undefined) {
    property.amenities = amenities;
  }

  property.location = property.location || {};

  if (address !== undefined) {
    property.location.address = address;
  }

  if (city !== undefined) {
    property.location.city = city;
  }

  if (state !== undefined) {
    property.location.state = state;
  }

  if (country !== undefined) {
    property.location.country = country;
  }

  if (latitude !== undefined) {
    property.location.lat = latitude;
  }

  if (longitude !== undefined) {
    property.location.lng = longitude;
  }

  if (price !== undefined) {
    property.price = price;
  }

  if (deposit !== undefined) {
    property.deposit = deposit;
  }

  if (availabilityDate !== undefined) {
    property.availability_date = availabilityDate || null;
  }

  if (rentalDuration !== undefined) {
    property.rental_duration = rentalDuration;
  }

  property.contact = property.contact || {};

  if (ownerName !== undefined) {
    property.contact.owner_name = ownerName;
  }

  if (phone !== undefined) {
    property.contact.phone = phone;
  }

  if (secondPhone !== undefined) {
    property.contact.second_phone = secondPhone;
  }

  if (showPhone !== undefined) {
    property.contact.show_phone = toBoolean(showPhone, property.contact.show_phone);
  }
};

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
// Get Property Reviews
//---------------------------
router.get("/:id/reviews", async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ success: false, error: "PROPERTY_NOT_FOUND" });
    }

    const page = Math.max(toFiniteNumber(req.query.page, 1), 1);
    const limit = Math.max(toFiniteNumber(req.query.limit, 5), 1);
    const skip = (page - 1) * limit;

    const [reviews, total, summary] = await Promise.all([
      Review.find({ property: req.params.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("author", "name email images"),
      Review.countDocuments({ property: req.params.id }),
      buildReviewSummary(req.params.id),
    ]);

    res.json({
      success: true,
      data: {
        reviews: reviews.map(serializeReview),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
          hasMore: skip + reviews.length < total,
        },
        summary,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//---------------------------
// Create Review
//---------------------------
router.post("/:id/reviews", auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ success: false, error: "PROPERTY_NOT_FOUND" });
    }

    const rating = toFiniteNumber(req.body.rating);
    const comment = typeof req.body.comment === "string" ? req.body.comment.trim() : "";

    if (!rating || rating < 1 || rating > 5 || !comment) {
      return res.status(400).json({ success: false, error: "VALIDATION_ERROR" });
    }

    const existingReview = await Review.findOne({
      property: req.params.id,
      author: req.user.id,
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You already reviewed this property.",
      });
    }

    const review = await Review.create({
      property: req.params.id,
      author: req.user.id,
      rating,
      comment,
    });

    const populatedReview = await Review.findById(review._id).populate(
      "author",
      "name email images"
    );
    const summary = await syncPropertyRatings(req.params.id);

    res.status(201).json({
      success: true,
      message: "Review saved successfully.",
      data: {
        review: serializeReview(populatedReview),
        summary,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//---------------------------
// Update Review
//---------------------------
router.put("/:propertyId/:reviewID/reviews", auth, async (req, res) => {
  try {
    const review = await Review.findOne({
      _id: req.params.reviewID,
      property: req.params.propertyId,
    });

    if (!review) {
      return res.status(404).json({ success: false, error: "REVIEW_NOT_FOUND" });
    }

    if (String(review.author) !== String(req.user.id)) {
      return res.status(403).json({ success: false, error: "FORBIDDEN" });
    }

    const rating = toFiniteNumber(req.body.rating, review.rating);
    const comment =
      typeof req.body.comment === "string" && req.body.comment.trim()
        ? req.body.comment.trim()
        : review.comment;

    review.rating = rating;
    review.comment = comment;
    await review.save();

    const populatedReview = await Review.findById(review._id).populate(
      "author",
      "name email images"
    );
    const summary = await syncPropertyRatings(req.params.propertyId);

    res.json({
      success: true,
      message: "Review updated successfully.",
      data: {
        review: serializeReview(populatedReview),
        summary,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//---------------------------
// Delete Review
//---------------------------
router.delete("/:propertyId/:reviewID/reviews", auth, async (req, res) => {
  try {
    const review = await Review.findOne({
      _id: req.params.reviewID,
      property: req.params.propertyId,
    });

    if (!review) {
      return res.status(404).json({ success: false, error: "REVIEW_NOT_FOUND" });
    }

    if (String(review.author) !== String(req.user.id)) {
      return res.status(403).json({ success: false, error: "FORBIDDEN" });
    }

    await Review.findByIdAndDelete(review._id);
    const summary = await syncPropertyRatings(req.params.propertyId);

    res.json({
      success: true,
      message: "Review deleted successfully.",
      data: { summary },
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

    const property = new Property({
      owner: req.user.id,
      status: "pending_review",
    });

    applyPropertyPayload(property, req.body);

    if (!property.title || !property.type || !property.location?.city || !property.price) {
      return res.status(400).json({ success: false, error: "VALIDATION_ERROR" });
    }

    property.images = await uploadImagesToCloudinary(req.files);

    await property.save();

    await Notification.create({
      user: property.owner,
      title: "New Property",
      message: "Property created",
      type: "review"
    });

    if (global.io) {
      emitStatsUpdate(global.io, property.owner);
    }

    res.status(201).json({ success: true, data: property });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//---------------------------
// Update Property
//---------------------------
router.put("/:id", auth, upload.array("images", 10), async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ success: false, error: "PROPERTY_NOT_FOUND" });
    }

    if (String(property.owner) !== String(req.user.id)) {
      return res.status(403).json({ success: false, error: "FORBIDDEN" });
    }

    applyPropertyPayload(property, req.body);

    if (Array.isArray(req.files) && req.files.length > 0) {
      const uploadedImages = await uploadImagesToCloudinary(req.files);
      property.images = [...(property.images || []), ...uploadedImages];
    }

    await property.save();

    res.json({ success: true, data: property });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//---------------------------
// Delete Property
//---------------------------
router.delete("/:id", auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ success: false, error: "PROPERTY_NOT_FOUND" });
    }

    if (String(property.owner) !== String(req.user.id)) {
      return res.status(403).json({ success: false, error: "FORBIDDEN" });
    }

    await Review.deleteMany({ property: req.params.id });
    await Property.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Property deleted successfully.",
    });
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

    user.savedProperties = Array.isArray(user.savedProperties)
      ? user.savedProperties
      : [];

    const alreadySaved = user.savedProperties.some(
      (savedPropertyId) => savedPropertyId.toString() === postId
    );

    if (alreadySaved) {
      return res.status(400).json({ success: false });
    }

    user.savedProperties.push(postId);
    await user.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
