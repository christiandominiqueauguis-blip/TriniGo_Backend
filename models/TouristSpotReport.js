const mongoose = require("mongoose");

const TouristSpotReportSchema = new mongoose.Schema(
  {
    managerId: { type: String, default: "" },
    managerName: { type: String, default: "" },
    touristSpotName: { type: String, default: "" },
    touristSpotLocation: { type: String, default: "" },

    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileSize: { type: Number, required: true },
    fileType: { type: String, required: true },

    status: { type: String, default: "Pending" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TouristSpotReport", TouristSpotReportSchema);