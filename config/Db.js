require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));   
    
