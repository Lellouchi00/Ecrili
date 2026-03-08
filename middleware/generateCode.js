const crypto = require("crypto");

function generateCode() {
  const otp = crypto.randomInt(100000, 999999); // 6 أرقام
  return otp.toString();
}

module.exports = generateCode;