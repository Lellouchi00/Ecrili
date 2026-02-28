const router = require("express").Router();
const Property = require("../models/Propreties");
const auth = require("../middleware/authMiddleware");
const cloudinary = require("../config/cloudinary");
const upload = require("../middleware/upload");


// ===============================
// CREATE PROPERTY
// ===============================
router.post(
  "/create",
  auth,
  upload.array("images", 5),
  async (req, res) => {
    try {

      if (!req.files || req.files.length === 0)
        return res.status(400).json({ message: "At least one image is required" });

      const uploadedImages = [];

      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(
          `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
          { folder: "properties" }
        );

        uploadedImages.push({
          url: result.secure_url,
          public_id: result.public_id
        });
      }

      const newProperty = new Property({
        title: req.body.title,
        description: req.body.description,
        price: req.body.price,
        category: req.body.category,
        numberOfRooms: req.body.numberOfRooms,
        location: req.body.location,
        locationGoogle: req.body.locationGoogle,
        characteristics: req.body.characteristics,
        owner: req.user.id,
        images: uploadedImages,
        status: "available"
      });

      const saved = await newProperty.save();

      res.status(201).json(saved);

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);


// ===============================
// GET ALL AVAILABLE PROPERTIES
// ===============================
router.get("/", async (req, res) => {
  try {

    const properties = await Property.find({ status: "available" });

    res.status(200).json(properties);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ===============================
// GET ONE PROPERTY
// ===============================
router.get("/:id", async (req, res) => {
  try {

    const property = await Property.findById(req.params.id);

    if (!property)
      return res.status(404).json({ message: "Property not found" });

    // السماح للمالك برؤية منشوره مهما كانت حالته
    if (
      property.status !== "available" &&
      property.owner.toString() !== req.user?.id
    ) {
      return res.status(200).json({
        message: "Property is not available",
        status: property.status
      });
    }

    res.status(200).json(property);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ===============================
// UPDATE PROPERTY
// ===============================
router.put("/:id", auth, async (req, res) => {
  try {

    if (!req.body)
      return res.status(400).json({ message: "No data provided" });

    const property = await Property.findById(req.params.id);

    if (!property)
      return res.status(404).json({ message: "Property not found" });

    if (property.owner.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    const allowedFields = [
      "title",
      "description",
      "price",
      "category",
      "numberOfRooms",
      "location",
      "locationGoogle",
      "characteristics"
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        property[field] = req.body[field];
      }
    });

    const updated = await property.save();

    res.status(200).json(updated);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ===============================
// ADD NEW IMAGES TO PROPERTY
// ===============================
router.put(
  "/:id/images",
  auth,
  upload.array("images", 5),
  async (req, res) => {
    try {
      const property = await Property.findById(req.params.id);

      if (!property)
        return res.status(404).json({ message: "Property not found" });

      if (property.owner.toString() !== req.user.id)
        return res.status(403).json({ message: "Not authorized" });

      if (!req.files || req.files.length === 0)
        return res.status(400).json({ message: "No images uploaded" });

      const uploadedImages = [];

      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(
          `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
          { folder: "properties" }
        );

        uploadedImages.push({
          url: result.secure_url,
          public_id: result.public_id
        });
      }

      property.images.push(...uploadedImages);

      const updated = await property.save();

      res.status(200).json(updated);

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);


// ===============================
// DELETE ONE IMAGE
// ===============================
router.delete("/:propertyId/image/:imageId", auth, async (req, res) => {
  try {

    const property = await Property.findById(req.params.propertyId);

    if (!property)
      return res.status(404).json({ message: "Property not found" });

    if (property.owner.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    const image = property.images.find(
      img => img.public_id === req.params.imageId
    );

    if (!image)
      return res.status(404).json({ message: "Image not found" });

    await cloudinary.uploader.destroy(image.public_id);

    property.images = property.images.filter(
      img => img.public_id !== req.params.imageId
    );

    await property.save();

    res.status(200).json({ message: "Image deleted successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ===============================
// HIDE PROPERTY
// ===============================
router.put("/:propertyId/hide", auth, async (req, res) => {
  try {

    const property = await Property.findById(req.params.propertyId);

    if (!property)
      return res.status(404).json({ message: "Property not found" });

    if (property.owner.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    
    if (property.status !== "available")
      return res.status(400).json({
        message: "Only available properties can be hidden"
      });

    property.status = "hidden";

    await property.save();

    res.status(200).json({ message: "Property deactivated successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ===============================
// RENT PROPERTY
// ===============================
router.put("/:propertyId/rent", auth, async (req, res) => {
  try {

    const property = await Property.findById(req.params.propertyId);

    if (!property)
      return res.status(404).json({ message: "Property not found" });

    if (property.owner.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    
    if (property.status !== "available")
      return res.status(400).json({
        message: "Only available properties can be rented"
      });

    property.status = "rented";

    await property.save();

    res.status(200).json({ message: "Property rented successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ===============================
// ACTIVATE PROPERTY
// ===============================
router.put("/:propertyId/active", auth, async (req, res) => {
  try {

    const property = await Property.findById(req.params.propertyId);

    if (!property)
      return res.status(404).json({ message: "Property not found" });

    if (property.owner.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    
    if (!["hidden", "rented"].includes(property.status))
      return res.status(400).json({
        message: "Property is already active"
      });

    property.status = "available";

    await property.save();

    res.status(200).json({ message: "Property activated successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ===============================
// DELETE PROPERTY (HARD DELETE)
// ===============================
router.delete("/:propertyId", auth, async (req, res) => {
  try {

    const property = await Property.findById(req.params.propertyId);

    if (!property)
      return res.status(404).json({ message: "Property not found" });

    if (property.owner.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    
    if (property.status !== "available")
      return res.status(400).json({
        message: "Only available properties can be permanently deleted"
      });

    await property.deleteOne();

    res.status(200).json({ message: "Property deleted successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;