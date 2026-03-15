const mongoose = require("mongoose");
const touristSpotSchema = new mongoose.Schema(

  {
    name: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    entranceFee: {
      age0to6: {
        type: Number,
        default: 0,
      },
      age7to12: {
        type: String,
        required: true,
      },
      age13up: {
        type: String,
        required: true,
      },
    },
    profileImage: {
      type: String,
      required: true,
    },
    coverImages: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("TouristSpot", touristSpotSchema);