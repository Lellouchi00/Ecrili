const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema =new Schema ({
    name : String,
    famillyname:String,
    email:String,
    dateOfBirth:String,
    password:String,
    phone:String, 
    images: 
        {
          url: String,
          public_id: String
        }
      ,
    isLessor:Boolean,
    verified : Boolean,
    savedProperties: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property"
      }
    ]
})

const User = mongoose.model('User',UserSchema);
module.exports = User;