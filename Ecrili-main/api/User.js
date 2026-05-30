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

const buildUserTokenPayload = (user, extraClaims = {}) => ({
  id: user._id,
  email: user.email || "",
  name: user.name || "",
  famillyname: user.famillyname || "",
  isLessor: Boolean(user.isLessor),
  verified: Boolean(user.verified),
  avatar: user.images?.url || "",
  ...extraClaims,
});

const signUserToken = (user, extraClaims = {}, expiresIn = "1d") =>
  jwt.sign(buildUserTokenPayload(user, extraClaims), process.env.JWT_SECRET, {
    expiresIn,
  });

// ================= EMAIL CONFIG =================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.AUTH_EMAIL,
    pass: process.env.AUTH_PASS,
  },
});

// Test email connection
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email service error:", error.message);
    console.error("Email config - User:", process.env.AUTH_EMAIL);
  } else {
    console.log("✅ Email service is ready");
    console.log("📧 Sending from:", process.env.AUTH_EMAIL);
  }
});

// ================= REGISTER =================
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const userExist = await User.findOne({ email });
    if (userExist) {
      return res.status(400).json({ message: "User already exists",type:'email' });
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

    const token = signUserToken(user, {}, "7d");

    res.json({ token, verified: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error during verification"
    });
  }
});

router.post("/send-code", async (req, res) => {
  try {

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
     const thisUser = await User.findOne({ email });
    if (!thisUser) {
      return res.status(400).json({ message: 'User not found' });
    }

    
    await UserVerification.deleteMany({ userId: thisUser._id });

    
    const codeVerification = Math.floor(100000 + Math.random() * 900000).toString();

    const hashCode = await bcrypt.hash(codeVerification, 10);
    await UserVerification.create({
      userId: thisUser._id,
      code: hashCode,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 دقائق
      isResetPassword: true
    });

    console.log(`📧 Attempting to send code to: ${email}`);
    
    const mailResponse = await transporter.sendMail({
      from: `"ACRILI" <${process.env.AUTH_EMAIL}>`,
      to: email,
      subject: "verify Code",
      html: `
        <div style="font-family: Arial; text-align:center; padding:30px;">
          <h2>verify code</h2>
          <p>Your verification code is:</p>
          <div style="font-size:40px; letter-spacing:8px; font-weight:bold;
                      background:#f1f3ff; padding:20px; border-radius:8px; margin:20px 0;">
            ${codeVerification}
          </div>
          <p style="color:#888;">This code will expire in 10 minutes.</p>
        </div>
      `
    });

    console.log(`✅ Email sent successfully to: ${email}`, mailResponse.messageId);

    res.status(200).json({
      message: "Verification code sent successfully"
    });

  } catch (err) {
    console.error("❌ Error sending email:", err.message);
    console.error("Full error:", err);
    res.status(500).json({
      message: "Error sending verification email",
      error: err.message
    });
  }
});
// ================= LOGIN =================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User not found" ,type:'email'});
    }


    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(400).json({ message: "Incorrect password" ,type:'password'});
    }

    const token = signUserToken(user);

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

    
    await UserVerification.deleteMany({ userId: thisUser._id });

    
    const codeVerification = generateCode(); // مثلا 6 أرقام
    const hashCode = await bcrypt.hash(codeVerification, 10);

    await UserVerification.create({
      userId: thisUser._id,
      code: hashCode,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 دقائق
      isResetPassword: true
    });

    
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
    console.log(`🔍 Confirm attempt - Email: ${email}, Code: ${code}`);

    const user = await User.findOne({ email });
    if (!user) {
      console.log(`❌ User not found: ${email}`);
      return res.status(400).json({ message: "User not found" });
    }

    const record = await UserVerification.findOne({ userId: user._id });
    if (!record) {
      console.log(`❌ Verification record not found for user: ${user._id}`);
      return res.status(400).json({ message: "Verification not found" });
    }

    console.log(`⏰ Code expiry check - Expires at: ${record.expiresAt}, Current: ${Date.now()}`);

    if (record.expiresAt < Date.now()) {
      await UserVerification.deleteOne({ userId: user._id });
      console.log(`❌ Code expired for user: ${user._id}`);
      return res.status(400).json({ message: "Code expired" });
    }

    console.log(`🔐 Comparing codes - User provided: ${code}, Stored hash exists: ${!!record.code}`);
    
    const valid = await bcrypt.compare(code, record.code);
    
    if (!valid) {
      console.log(`❌ Code mismatch for user: ${email}`);
      return res.status(400).json({ message: "Invalid code" });
    }

    console.log(`✅ Code verified successfully for: ${email}`);
    
    const token = signUserToken(user, { action: "reset-password" }, "20m");

    await UserVerification.deleteOne({ userId: user._id });

    res.json({ token });

  } catch (err) {
    console.error("❌ Confirm error:", err.message);
    console.error("Full error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});
//change password
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
  upload.array("images", 1),
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
//SAVE A PROPRETY
router.post("/me/saved/:id", auth, async (req, res) => {

  try {

    const propertyId = req.params.id;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.savedProperties = Array.isArray(user.savedProperties)
      ? user.savedProperties
      : [];

    const hasProperty = user.savedProperties.some(
      (savedPropertyId) => savedPropertyId.toString() === propertyId
    );

    if (hasProperty) {
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
// ===============================
// Delete SAVED PROPRETY
// ===============================
router.delete(
  "/me/saved/:id",
  auth,
  async (req, res) => {
    try {
      const propertyId = req.params.id;

      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      user.savedProperties = Array.isArray(user.savedProperties)
        ? user.savedProperties
        : [];

      user.savedProperties = user.savedProperties.filter(
        (id) => id.toString() !== propertyId
      );
 await user.save();

    res.status(200).json({
      success: true,
      message: "Property removed from favorites",
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
  }
);
//---------------------
//GET ALL SAVES 
//--------------------
router.get('/me/saved',auth,async(req,res)=>{
  try{
    const user = await User.findById(req.user.id).populate("savedProperties");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    
    res.status(200).json({
      success: true,
      data:user.savedProperties || [],
    });


  }catch(err){
    res.status(500).json({ error: err.message });
  }


});

module.exports = router;
