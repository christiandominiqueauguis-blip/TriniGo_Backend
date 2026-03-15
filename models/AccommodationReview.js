const mongoose = require("mongoose");

const accommodationReviewSchema = new mongoose.Schema(
  {
    accommodationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Accommodation",
      required: true,
    },
    userSessionId: {
      type: String,
      default: "",
    },
    rating: {
      type: Number,
      required: true,
    },
    feedback: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AccommodationReview", accommodationReviewSchema);