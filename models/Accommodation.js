const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  roomName: String,
  price: Number,
  availableRooms: Number,
  maxPersons: Number,
  images: [String],
});

const accommodationSchema = new mongoose.Schema(
  {
    accommodationName: String,
    businessAddress: String,
    description: String,
    profileImage: String,
    coverImages: [String],
    gcashNumber: String,
    gcashAccountName: String,

    rooms: [roomSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Accommodation", accommodationSchema);