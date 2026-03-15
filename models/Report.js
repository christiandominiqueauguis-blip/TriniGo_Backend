const mongoose = require("mongoose");

const ReportSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyOwner",
    },
    ownerName: String,
    accommodationName: String,
    propertyType: String,

    fileName: String,
    filePath: String,
    fileSize: Number,
    fileType: String,

    status: {
      type: String,
      default: "Pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", ReportSchema);