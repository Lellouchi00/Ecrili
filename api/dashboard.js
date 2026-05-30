const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const Notification = require("../models/notification");
const VisitRequest = require("../models/VisitRequest");

router.get("/stats", auth, async (req, res) => {
  try {
    const [notificationsCount, newRequestsCount] = await Promise.all([
      Notification.countDocuments({ user: req.user.id, read: false }),
      VisitRequest.countDocuments({ ownerId: req.user.id, status: "pending" }),
    ]);

    res.json({ notificationsCount, newRequestsCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
