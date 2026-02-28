const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema =new Schema ({
    name : String,
    famillyname:String,
    username:String,
    email:String,
    dateOfBirth:String,
    password:String,
    phone:String, 
    image:String,
    isLessor:Boolean,
    verified : Boolean
})

const User = mongoose.model('User',UserSchema);
module.exports = User;