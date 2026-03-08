// Connect to database
require('./config/Db');

const express = require('express');
const app = express();

const port = process.env.PORT || 3000;

const cors = require("cors");

app.use(cors({
  origin: "*",        // السماح لأي origin
  credentials: true   // للحالات التي تحتاج إرسال cookies أو authorization headers
}));
// -------- Middleware --------
// Parse incoming JSON
app.use(express.json());

// -------- Routes --------
const userRouter = require('./api/User');
const propretyRouter = require('./api/Proprety');

// All routes start with /user
app.use('/user', userRouter);
app.use('/proprety', propretyRouter);

app.use(express.static("public"));

// -------- Start Server --------
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});