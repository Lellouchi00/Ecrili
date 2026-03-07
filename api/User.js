const router = require("express").Router();
const User = require("../models/User");
const UserVerification = require("../models/UserVerification");
const PasswordReset = require("../models/PasswordReset");
const auth = require("../middleware/authMiddleware");
const cloudinary = require("../config/cloudinary");
const upload = require("../middleware/upload");

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
    famillyname:req.body.famillyname,
    dateOfBirth:req.body.dateOfBirth,
    username:req.body.username,
    
    phone:req.body.phone, 
    image:req.body.image,
    isLessor:req.body.isLessor === true,
    verified :false
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
      { 
        id: user._id,
        isLessor: user.isLessor 
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ message: "Login successful", token });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ================= SHOW RESET PASSWORD PAGE =================
router.get("/reset-password/:userId/:resetString", (req, res) => {
  res.sendFile(require("path").join(__dirname, "../views/resetPassword.html"));
});

// ================= VERIFY RESET LINK (HEAD request) =================
router.head("/reset-password/:userId/:resetString", async (req, res) => {
  try {
    const { userId, resetString } = req.params;
    
    const record = await PasswordReset.findOne({ userId });
    
    if (!record || record.expiresAt < Date.now()) {
      return res.status(404).end();
    }
    
    const valid = await bcrypt.compare(resetString, record.resetString);
    
    if (!valid) {
      return res.status(404).end();
    }
    
    res.status(200).end();
  } catch (err) {
    res.status(500).end();
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

    const link = `http://localhost:${process.env.PORT}/user/reset-password/${user._id}/${resetString}`;

    await transporter.sendMail({
      from: process.env.AUTH_EMAIL,
      to: email,
      subject: "Reset Password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #8a2be2;">Reset Your Password</h2>
          <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
          <a href="${link}" style="display: inline-block; background: #8a2be2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 30px; margin: 20px 0;">Reset Password</a>
          <p>Or copy this link: <br> <small>${link}</small></p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });

    res.json({ message: "Password reset email sent" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= SHOW RESET PASSWORD PAGE =================
router.get("/reset-password/:userId/:resetString", (req, res) => {
  res.sendFile(require("path").join(__dirname, "../views/resetPassword.html"));
});

// ================= SHOW PASSWORD RESET SUCCESS PAGE =================
router.get("/password-reset-success", (req, res) => {
  res.sendFile(require("path").join(__dirname, "../views/password-reset-success.html"));
});

// ================= RESET PASSWORD =================
router.post("/reset-password/:userId/:resetString", async (req, res) => {
  try {
    const { userId, resetString } = req.params;
    const { newPassword } = req.body;

    // التحقق من قوة كلمة المرور
    const hasLength = newPassword.length >= 8;
    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
    
    if (!hasLength || !hasUppercase || !hasNumber || !hasSpecial) {
      return res.status(400).json({ message: "Password does not meet requirements" });
    }

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

//create a image
router.put(
  "/:id/images",
  auth,
  upload.array("images", 5),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);

      if (!user)
        return res.status(404).json({ message: "User not found" });

      if (!req.files || req.files.length === 0)
        return res.status(400).json({ message: "No images uploaded" });

      const uploadedImages = [];

      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(
          `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
          { folder: "userimages" }
        );

        uploadedImages.push({
          url: result.secure_url,
          public_id: result.public_id
        });
      }

     
      user.images.push(...uploadedImages);

      const updatedUser = await user.save();

      res.status(200).json(updatedUser);

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;