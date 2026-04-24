const router = require("express").Router();
const Notification = require("../models/notification");
const auth = require("../middleware/authMiddleware");

//---------------------------
// Get Notifications (User)
//---------------------------
router.get("/", auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: notifications
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

//---------------------------
// Mark One Notification as Read
//---------------------------
router.put("/:id/read", auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    if (notification.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    notification.isRead = true;
    await notification.save();

    res.json({
      success: true,
      message: "Notification marked as read"
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

//---------------------------
// Mark All Notifications as Read
//---------------------------
router.put("/mark-all-read", auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id },
      { $set: { isRead: true } }
    );

    res.json({
      success: true,
      message: "All notifications marked as read"
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

//---------------------------
// Delete Single Notification
//---------------------------
router.delete("/:id", auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    if (notification.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    await notification.deleteOne();

    res.json({
      success: true,
      message: "Notification deleted"
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

//---------------------------
// Delete All Notifications
//---------------------------
router.delete("/clear/all", auth, async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user.id });

    res.json({
      success: true,
      message: "All notifications deleted"
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;