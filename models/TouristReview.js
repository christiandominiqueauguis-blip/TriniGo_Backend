const mongoose = require("mongoose");

const touristReviewSchema = new mongoose.Schema(
  {
    touristSpotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TouristSpot",
      required: true,
    },
    userSessionId: {
      type: String,
      default: "",
    },
    rating: Number,
    feedback: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("TouristReview", touristReviewSchema);