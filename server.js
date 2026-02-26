// Connect to database
require('./config/Db');

const express = require('express');
const app = express();

const port = process.env.PORT || 3000;

// -------- Middleware --------
// Parse incoming JSON
app.use(express.json());

// -------- Routes --------
const userRouter = require('./api/User');

// All routes start with /user
app.use('/user', userRouter);

// -------- Start Server --------
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});