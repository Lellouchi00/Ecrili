const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");

const User = require("../models/User");
const PasswordReset = require("../models/passwordReset");

require("dotenv").config();

// ================= EMAIL CONFIG =================
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.AUTH_EMAIL,
        pass: process.env.AUTH_PASS,
    },
});

// ================= FORGOT PASSWORD =================
router.post("/requestPasswordReset", async (req, res) => {

    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    // Generate reset string
    const resetString = uuidv4() + user._id;

    // Hash reset string
    const hashedResetString = await bcrypt.hash(resetString, 10);

    // Save reset record
    await PasswordReset.create({
        userId: user._id,
        resetString: hashedResetString,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000, // 1 hour
    });

    // Create reset link
    const resetLink = `http://localhost:3000/user/reset-password/${user._id}/${resetString}`;

    // Send email
    await transporter.sendMail({
        from: process.env.AUTH_EMAIL,
        to: email,
        subject: "Password Reset",
        html: `<p>Click below to reset password:</p>
               <a href="${resetLink}">Reset Password</a>`
    });

    res.json({ message: "Password reset link sent to email" });
});

// ================= RESET PAGE =================
router.get("/reset-password/:userId/:resetString", (req, res) => {

    const { userId, resetString } = req.params;

    // Send simple HTML form
    res.send(`
        <h2>Reset Password</h2>
        <form method="POST" action="/user/resetPassword">
            <input type="hidden" name="userId" value="${userId}" />
            <input type="hidden" name="resetString" value="${resetString}" />
            <input type="password" name="newPassword" placeholder="Enter new password" required />
            <button type="submit">Reset</button>
        </form>
    `);
});

// ================= RESET PASSWORD =================
router.post("/resetPassword", async (req, res) => {

    const { userId, resetString, newPassword } = req.body;

    const resetRecord = await PasswordReset.findOne({ userId });

    if (!resetRecord) {
        return res.json({ message: "No reset request found" });
    }

    if (resetRecord.expiresAt < Date.now()) {
        await PasswordReset.deleteOne({ userId });
        return res.json({ message: "Reset link expired" });
    }

    const valid = await bcrypt.compare(resetString, resetRecord.resetString);

    if (!valid) {
        return res.json({ message: "Invalid reset link" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await User.updateOne({ _id: userId }, { password: hashedPassword });

    // Delete reset record
    await PasswordReset.deleteOne({ userId });

    res.json({ message: "Password reset successful" });
});

module.exports = router;