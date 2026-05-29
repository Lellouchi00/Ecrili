require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));   
    
