const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const generateOtp = () => String(crypto.randomInt(100000, 1000000)); // 6-digit

const hashOtp = async (otp) => bcrypt.hash(otp, 10);

const compareOtp = async (otp, hash) => bcrypt.compare(otp, hash);

module.exports = { generateOtp, hashOtp, compareOtp };
