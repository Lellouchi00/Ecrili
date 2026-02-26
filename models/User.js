const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema =new Schema ({
    name : String,
    famillyname:String,
    email:String,
    dateOfBirth:String,
    password:String,
    phone:String, 
    verified : Boolean
})

const User = mongoose.model('User',UserSchema);
module.exports = User;