const mongoose = require("mongoose");

const PropertyOwnerSchema = new mongoose.Schema({
  fullName: String,
  email: { type: String, unique: true },
  phone: String,
  passwordHash: String,

  accommodationName: String,
  propertyType: String,
  businessAddress: String,
  description: String,

  businessPermits: [String], // ✅ multiple uploaded files

  status: {
    type: String,
    default: "PENDING",
  },
}, { timestamps: true });

module.exports = mongoose.model("PropertyOwner", PropertyOwnerSchema);