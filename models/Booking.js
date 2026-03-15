const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    roomType: String,
    roomPrice: Number,
    maxPersons: Number,
    fullName: String,
    contactNumber: String,
    checkInDate: Date,
    checkOutDate: Date,
    gcashNumber: String,
    gcashAccountName: String,
    referenceNumber: String,
    proofImage: String,

status: {
  type: String,
  default: "Pending",
},

userSessionId: {
  type: String,
},
accommodationId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Accommodation",
},
accommodationProfileImage: {
  type: String,
},
accommodationName: {
  type: String,
},
businessAddress: {
  type: String,
},
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);