const router = require("express").Router();
const VisitRequest = require("../models/VisitRequest");
const Property = require("../models/Propreties");
const Notification = require("../models/notification");
const auth = require("../middleware/authMiddleware");

//---------------------------
// POST /api/visit-requests
//---------------------------
router.post("/", auth, async (req, res) => {
  try {
    const { propertyId, visitDate, message } = req.body;
    const tenantId = req.user.id;

    if (!propertyId || !visitDate) {
      return res.status(400).json({ success: false, message: "propertyId and visitDate are required" });
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    const visitRequest = await VisitRequest.create({
      propertyId,
      tenantId,
      ownerId: property.owner,
      visitDate: new Date(visitDate),
      message: message || "",
    });

    await Notification.create({
      user: property.owner,
      title: "New Visit Request",
      message: `Someone wants to visit "${property.title}"`,
      type: "visit_request"
    });

    if (global.io) {
      global.io.to(String(property.owner)).emit("notification", {
        title: "New Visit Request",
        message: `Someone wants to visit "${property.title}"`,
        type: "visit_request"
      });
    }

    res.status(201).json({
      success: true,
      message: "Visit request sent successfully",
      data: visitRequest
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

//---------------------------
// GET /api/visit-requests
//---------------------------
router.get("/", auth, async (req, res) => {
  try {
    const requests = await VisitRequest.find({ ownerId: req.user.id })
      .populate("tenantId", "name email phone images")
      .populate("propertyId", "title location price images")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

//---------------------------
// PATCH /api/visit-requests/:id
//---------------------------
router.patch("/:id", auth, async (req, res) => {
  try {
    const { status } = req.body;

    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be 'accepted' or 'rejected'" });
    }

    const visitRequest = await VisitRequest.findById(req.params.id)
      .populate("propertyId", "title")
      .populate("tenantId", "name");

    if (!visitRequest) {
      return res.status(404).json({ success: false, message: "Visit request not found" });
    }

    if (String(visitRequest.ownerId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (visitRequest.status !== "pending") {
      return res.status(400).json({ success: false, message: `Already ${visitRequest.status}` });
    }

    visitRequest.status = status;
    await visitRequest.save();

    const msg = status === "accepted" ? "accepted" : "declined";
    await Notification.create({
      user: visitRequest.tenantId._id,
      title: `Visit ${status === "accepted" ? "Accepted" : "Declined"}`,
      message: `Your visit request for "${visitRequest.propertyId.title}" was ${msg}`,
      type: "visit_response"
    });

    if (global.io) {
      global.io.to(String(visitRequest.tenantId._id)).emit("notification", {
        title: `Visit ${status === "accepted" ? "Accepted" : "Declined"}`,
        message: `Your visit request for "${visitRequest.propertyId.title}" was ${msg}`,
        type: "visit_response"
      });
    }

    res.json({ success: true, data: visitRequest });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
