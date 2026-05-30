const Notification = require("../models/notification");
const VisitRequest = require("../models/VisitRequest");

const emitStatsUpdate = async (io, userId) => {
  try {
    const [notificationsCount, newRequestsCount] = await Promise.all([
      Notification.countDocuments({ user: userId, read: false }),
      VisitRequest.countDocuments({ ownerId: userId, status: "pending" }),
    ]);

    io.to(String(userId)).emit("stats_update", { notificationsCount, newRequestsCount });
  } catch (err) {
    console.error("emitStatsUpdate error:", err.message);
  }
};

module.exports = emitStatsUpdate;
