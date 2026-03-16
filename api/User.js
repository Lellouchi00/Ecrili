const router = require("express").Router();
const User = require("../models/User");
const UserVerification = require("../models/UserVerification");
const auth = require("../middleware/authMiddleware");
const cloudinary = require("../config/cloudinary");
const upload = require("../middleware/upload");

const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const  generateCode  = require("../middleware/generateCode");

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
      return res.status(400).json({ message: "User already exists" });
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

    const codeVerification=generateCode();
    const hashcodeVerification = await bcrypt.hash(codeVerification, 10);

    await new UserVerification({
      userId: savedUser._id,
      code: hashcodeVerification,
      createdAt: Date.now(),
      expiresAt:Date.now() + 10 * 60 * 1000,
      isRestPassword:false
    }).save();

    await transporter.sendMail({
  from: `"ACRILI" <${process.env.AUTH_EMAIL}>`,
  to: email,
  subject: "ACRILI Verification Code",
  html: `
  <div style="font-family: Arial; background:#f4f6fb; padding:40px;">
    
    <div style="max-width:500px; margin:auto; background:white; padding:30px; border-radius:10px; text-align:center;">
      
      <h2 style="color:#4e54c8;">Email Verification</h2>
      <p>Your verification code is:</p>

      <div id="otpBox" 
           style="font-size:40px; letter-spacing:8px; font-weight:bold; 
           background:#f1f3ff; padding:20px; border-radius:8px; margin:20px 0;">
        ${codeVerification}
      </div>

      <button onclick="navigator.clipboard.writeText('${codeVerification}')"
        style="background:#4e54c8; color:white; border:none; padding:10px 20px;
        border-radius:6px; cursor:pointer; font-size:16px;">
        Copy Code
      </button>

      <p style="margin-top:25px; font-size:14px; color:#888;">
        This code will expire in 10 minutes.
      </p>

    </div>

  </div>
  `
});

    res.status(200).json({ message: "Verification email sent" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= VERIFY EMAIL =================
router.post("/verify", async (req, res) => {
  try {

    const { email, code } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const record = await UserVerification.findOne({ userId: user._id });

    if (!record) {
      return res.status(400).json({ message: "Verification not found" });
    }

    if (record.expiresAt < Date.now()) {
      await UserVerification.deleteOne({ userId: user._id });
      return res.status(400).json({ message: "Code expired" });
    }

    const valid = await bcrypt.compare(code, record.code);

    if (!valid) {
      return res.status(400).json({ message: "Invalid code" });
    }

    user.verified = true;
    await user.save();

    await UserVerification.deleteOne({ userId: user._id });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, verified: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error during verification"
    });
  }
});
// ================= LOGIN =================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (!user.verified) {
      return res.status(400).json({ message: "Please verify your email" });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(400).json({ message: "Incorrect password" });
    }

    const token = jwt.sign(
      { 
        id: user._id,
        isLessor: user.isLessor 
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({ message: "Login successful", token });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//forget password 

router.post('/forget', async (req, res) => {
  try {
    const { email } = req.body;
    const thisUser = await User.findOne({ email });
    if (!thisUser) {
      return res.status(400).json({ message: 'User not found' });
    }

    // حذف أي OTP قديم
    await UserVerification.deleteMany({ userId: thisUser._id });

    // توليد الكود
    const codeVerification = generateCode(); // مثلا 6 أرقام
    const hashCode = await bcrypt.hash(codeVerification, 10);

    await UserVerification.create({
      userId: thisUser._id,
      code: hashCode,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 دقائق
      isResetPassword: true
    });

    // إرسال الإيميل
    await transporter.sendMail({
      from: `"ACRILI" <${process.env.AUTH_EMAIL}>`,
      to: email,
      subject: "Password Reset Code",
      html: `
        <div style="font-family: Arial; text-align:center; padding:30px;">
          <h2>Password Reset</h2>
          <p>Your verification code is:</p>
          <div style="font-size:40px; letter-spacing:8px; font-weight:bold; 
                      background:#f1f3ff; padding:20px; border-radius:8px; margin:20px 0;">
            ${codeVerification}
          </div>
          <p style="color:#888;">This code will expire in 10 minutes.</p>
        </div>
      `
    });

    res.status(200).json({ message: 'Email sent successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post('/confirm', async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const record = await UserVerification.findOne({ userId: user._id ,});
    if (!record) return res.status(400).json({ message: "Verification not found" });

    if (record.expiresAt < Date.now()) {
      await UserVerification.deleteOne({ userId: user._id });
      return res.status(400).json({ message: "Code expired" });
    }

    const valid = await bcrypt.compare(code, record.code);
    if (!valid) return res.status(400).json({ message: "Invalid code" });

    console.log(user)
    const token = jwt.sign(
      { id: user._id, action:"reset-password" },
      process.env.JWT_SECRET,
      { expiresIn: "20m" }
    );



    // حذف سجل التحقق
    await UserVerification.deleteOne({ userId: user._id });

    res.json({ token, });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put('/password', auth, async (req, res) => {
  try {
    const { id, action } = req.user; // من JWT
    const { password, newPassword } = req.body;
    console.log(action)
    const user = await User.findById(id);
    if (!user) return res.status(400).json({ message: "User not found" });

    const hashNewPassword = await bcrypt.hash(newPassword, 10);

    if (action === "reset-password") {
      user.password = hashNewPassword;
      await user.save();

      // حذف أي OTP قديم مرتبط بالمستخدم
      await UserVerification.deleteMany({ userId: user._id });

    } else {
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(400).json({ message: "Incorrect password" });

      user.password = hashNewPassword;
      await user.save();
    }

    res.status(200).json({ message: "Password updated successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
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
//----------------------
router.post("/me/saved/:id", auth, async (req, res) => {

  try {

    const propertyId = req.params.id;

    const user = await User.findById(req.user.id);

    if (user.savedProperties.includes(propertyId)) {
      return res.status(400).json({
        success:false,
        message:"Property already saved"
      });
    }

    user.savedProperties.push(propertyId);

    await user.save();

    res.json({
      success:true,
      message:"Property saved successfully"
    });

  } catch (err) {

    res.status(500).json({error:err.message});

  }

});

module.exports = router;