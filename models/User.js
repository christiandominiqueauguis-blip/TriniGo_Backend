const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true },

    // BASIC INFO (Page 1)
    firstName: String,
    middleName: String,
    lastName: String,
    extension: String,

    profileImage: {
      type: String,
      default: "",
    },

    // ACCOUNT CREDENTIALS (Page 2)
    email: { type: String, default: "" },
    passwordHash: { type: String, default: "" },

    // GOOGLE AUTH
    googleId: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);