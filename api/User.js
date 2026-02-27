const router = require("express").Router();
const User = require("../models/User");
const UserVerification = require("../models/UserVerification");
const PasswordReset = require("../models/PasswordReset");

const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");

// ================= EMAIL CONFIG =================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.AUTH_EMAIL,
    pass: process.env.AUTH_PASS,
  },
});

// ================= REGISTER =================
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const userExist = await User.findOne({ email });
    if (userExist) {
      return res.json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      verified: false,
    });

    const savedUser = await newUser.save();

    const uniqueString = uuidv4() + savedUser._id;
    const hashedUniqueString = await bcrypt.hash(uniqueString, 10);

    await new UserVerification({
      userId: savedUser._id,
      uniqueString: hashedUniqueString,
      createdAt: Date.now(),
      expiresAt: Date.now() + 21600000,
    }).save();

    const link = `http://localhost:${process.env.PORT}/user/verify/${savedUser._id}/${uniqueString}`;

    await transporter.sendMail({
        from: `"ACRILI" <${process.env.AUTH_EMAIL}>`,
        to: email,
        subject: "Verify Your Email - ACRILI",
        html: `
          <div style="font-family: Arial; background:#f4f6fb; padding:40px;">
            <div style="max-width:600px; background:white; margin:auto; padding:30px; border-radius:10px; box-shadow:0 5px 20px rgba(0,0,0,0.1);">
              
              <div style="text-align:center;">
                <img src="cid:acrililogo" width="150"/>
                <h2 style="color:#4e54c8;">Welcome to ACRILI</h2>
              </div>
      
              <p>Hello,</p>
              <p>Thank you for registering with <strong>ACRILI</strong>.</p>
              <p>Please verify your email by clicking the button below:</p>
      
              <div style="text-align:center; margin:30px 0;">
                <a href="${link}" 
                   style="background:#4e54c8; color:white; padding:12px 25px; text-decoration:none; border-radius:6px;">
                   Verify Email
                </a>
              </div>
      
              <p style="color:#888; font-size:14px;">
                ⚠ This verification link will expire in 6 hours.
              </p>
      
              <hr>
      
              <p style="font-size:12px; color:#aaa;">
                This email was sent by ACRILI Company.<br>
                If you did not request this, please ignore this email.
              </p>
      
            </div>
          </div>
        `,
        attachments: [
          {
            filename: "logo.png",
            path: "./public/logo.png",
            cid: "acrililogo"
          }
        ]
      });

    res.json({ message: "Verification email sent" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= VERIFY EMAIL =================
router.get("/verify/:userId/:uniqueString", async (req, res) => {
  try {
    const { userId, uniqueString } = req.params;

    const record = await UserVerification.findOne({ userId });

    if (!record) {
      return res.send("Invalid verification link");
    }

    if (record.expiresAt < Date.now()) {
      await User.deleteOne({ _id: userId });
      await UserVerification.deleteOne({ userId });
      return res.send("Verification link expired");
    }

    const valid = await bcrypt.compare(uniqueString, record.uniqueString);

    if (!valid) {
      return res.send("Invalid verification details");
    }

    await User.updateOne({ _id: userId }, { verified: true });
    await UserVerification.deleteOne({ userId });

    res.sendFile(require("path").join(__dirname, "../views/verified.html"));

  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ================= LOGIN =================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.json({ message: "User not found" });
    }

    if (!user.verified) {
      return res.json({ message: "Please verify your email" });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.json({ message: "Incorrect password" });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ message: "Login successful", token });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= REQUEST PASSWORD RESET =================
router.post("/requestPasswordReset", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.json({ message: "User not found" });
    }

    await PasswordReset.deleteMany({ userId: user._id });

    const resetString = uuidv4() + user._id;
    const hashedResetString = await bcrypt.hash(resetString, 10);

    await new PasswordReset({
      userId: user._id,
      resetString: hashedResetString,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    }).save();

    const link = `http://localhost:${process.env.PORT}/user/reset/${user._id}/${resetString}`;

    await transporter.sendMail({
      from: process.env.AUTH_EMAIL,
      to: email,
      subject: "Reset Password",
      html: `<a href="${link}">Click here to reset password</a>`,
    });

    res.json({ message: "Password reset email sent" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= RESET PASSWORD =================
router.post("/reset/:userId/:resetString", async (req, res) => {
  try {
    const { userId, resetString } = req.params;
    const { newPassword } = req.body;

    const record = await PasswordReset.findOne({ userId });

    if (!record) {
      return res.json({ message: "Invalid reset request" });
    }

    if (record.expiresAt < Date.now()) {
      await PasswordReset.deleteOne({ userId });
      return res.json({ message: "Reset link expired" });
    }

    const valid = await bcrypt.compare(resetString, record.resetString);

    if (!valid) {
      return res.json({ message: "Invalid reset details" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await User.updateOne({ _id: userId }, { password: hashedPassword });
    await PasswordReset.deleteOne({ userId });

    res.json({ message: "Password reset successful" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;