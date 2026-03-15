const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require("./models/User");
const PropertyOwner = require('./models/PropertyOwner');
const multer = require('multer');
const path = require('path');
const Admin = require('./models/Admin');
const Accommodation = require("./models/Accommodation");
const Booking = require("./models/Booking");
const TouristSpot = require("./models/TouristSpot");
const TouristReview = require("./models/TouristReview");
const AccommodationReview = require("./models/AccommodationReview");
const Report = require("./models/Report");
const TourismSiteManager = require('./models/TourismSiteManager');
const TouristSpotReport = require('./models/TouristSpotReport');

const otpStore = {};
// { sessionId: { code, expiresAt } }

const COUNTRY_RULES = {
  '+63': { min: 10, max: 10 },
  '+1': { min: 10, max: 10 },
  '+65': { min: 8, max: 8 },
  '+81': { min: 10, max: 10 },
  '+82': { min: 9, max: 10 },
};

const app = express();
const PORT = 4000;

// Middleware
app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());

// ================================
// PROFILE IMAGE UPLOAD SETUP
// ================================
const storage = multer.diskStorage({
  destination: './uploads',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });
const businessPermitUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
const accommodationUpload = multer({ storage });
const bookingUpload = multer({ storage });
const touristUpload = multer({ storage });
const reportUpload = multer({ storage });

// Serve uploaded images
app.use('/uploads', express.static('uploads'));

// Test route
app.get('/', (req, res) => {
  res.send('API is running ✅');
});

// ================================
// BASIC INFO ROUTE (Matches your frontend fetch)
// ================================
app.post('/api/register/basic-info', async (req, res) => {
  const { firstName, middleName, lastName, extension } = req.body;

  let errors = {};

  // Validation
  if (!firstName || firstName.trim() === '') {
    errors.firstName = 'First name is required';
  }

  if (!lastName || lastName.trim() === '') {
    errors.lastName = 'Last name is required';
  }

  // If may errors, ibalik sa frontend
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  // Generate session ID
  const sessionId = uuidv4();

  await User.create({
  sessionId,
  firstName,
  middleName,
  lastName,
  extension,
});

  // Success response
  res.json({
    message: 'Basic info saved successfully ✅',
    sessionId,
    data: {
      firstName,
      middleName,
      lastName,
      extension,
    }
  });
});

// ================================
// ACCOUNT CREDENTIALS ROUTE (PAGE 2)
// ================================
app.post('/api/register/account-credentials', async (req, res) => {
  const { sessionId, email, password, confirmPassword } = req.body;

  let errors = {};

  if (!sessionId) {
    errors.session = 'Invalid session';
  }

  if (!email) {
    errors.email = 'Email is required';
  } else if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.com$/.test(email)) {
  errors.email = 'Invalid email address format';
}

  if (!password) {
    errors.password = 'Password is required';
  } else {
    if (password.length < 8)
      errors.password = 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password))
      errors.password = 'Password must have at least 1 uppercase letter';
    if (!/\d/.test(password))
      errors.password = 'Password must have at least 1 number';
    if (!/[^A-Za-z0-9]/.test(password))
      errors.password = 'Password must have at least 1 symbol';
  }

  if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await User.findOneAndUpdate(
  { sessionId },
  {
    email,
    passwordHash,
  }
);

  res.json({
    message: 'Account credentials saved successfully ✅',
  });
});

// ================================
// LOGIN ROUTE
// ================================
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: 'Email and password are required',
    });
  }

  const account = await User.findOne({ email });

  if (!account) {
    return res.status(401).json({
      message: 'Invalid email',
    });
  }

  const isMatch = await bcrypt.compare(password, account.passwordHash);

  if (!isMatch) {
    return res.status(401).json({
      message: 'Invalid password',
    });
  }

  res.json({
    message: 'Login successful ✅',
  });
});

// ================================
// GET PROFILE DATA
// ================================
app.get('/api/profile/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  const user = await User.findOne({ sessionId });

  if (!user) {
  return res.status(404).json({ message: "Profile not found" });
}

const fullName = [
  user.firstName,
  user.middleName,
  user.lastName,
  user.extension,
]
  .filter(Boolean)
  .join(" ");

res.json({
  fullName,
  email: user.email,
  profileImage: user.profileImage,
});
});

// ================================
// UPLOAD PROFILE IMAGE
// ================================
app.post(
  '/api/profile/upload/:sessionId',
  upload.single('image'),
  async (req, res) => {
    const { sessionId } = req.params;

    const imagePath = `/uploads/${req.file.filename}`;

    await User.findOneAndUpdate(
  { sessionId },
  { profileImage: imagePath }
);

    res.json({ image: imagePath });
  }
);

app.post(
  "/api/property-owner/register",
  businessPermitUpload.array("businessPermits", 10),
  async (req, res) => {
    try {
      const {
        fullName,
        email,
        phone,
        password,
        accommodationName,
        propertyType,
        businessAddress,
        description,
      } = req.body;

// ========================
// VALIDATION
// ========================
if (
  !fullName ||
  !email ||
  !phone ||
  !password ||
  !accommodationName ||
  !propertyType ||
  !businessAddress ||
  !description
) {
  return res.status(400).json({
    message: "Please fill in all required fields",
  });
}

// ✅ CHECK IF AT LEAST 1 BUSINESS PERMIT IS UPLOADED
if (!req.files || req.files.length === 0) {
  return res.status(400).json({
    message: "Please upload at least one business document",
  });
}

      // ✅ EMAIL FORMAT VALIDATION
const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.com$/;

if (!emailRegex.test(email)) {
  return res.status(400).json({
    message: "Invalid email address format",
  });
}

      const existing = await PropertyOwner.findOne({ email });
      if (existing) {
        return res.status(400).json({
          message: "Email already registered",
        });
      }

      // ========================
      // PASSWORD HASHING
      // ========================
      const passwordHash = await bcrypt.hash(password, 10);

      // ========================
      // FILE HANDLING
      // ========================
      const permitFiles = req.files.map(
        (file) => `/uploads/${file.filename}`
      );

      // ========================
      // SAVE TO DATABASE
      // ========================
      await PropertyOwner.create({
        fullName,
        email,
        phone,
        passwordHash,

        accommodationName,
        propertyType,
        businessAddress,
        description,

        businessPermits: permitFiles,
      });

      res.json({
        message:
          "Property owner registration submitted successfully ✅ Please wait for approval.",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Server error during registration",
      });
    }
  }
);

// ================================
// PROPERTY OWNER LOGIN
// ================================
app.post("/api/property-owner/login", async (req, res) => {
  const { email, password } = req.body;

  // 🔎 basic validation
  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required",
    });
  }

  // 🔍 hanapin ang property owner
  const owner = await PropertyOwner.findOne({ email });

  if (!owner) {
    return res.status(401).json({
      message: "Invalid email or password",
    });
  }

  // 🔐 compare password (bcrypt)
  const isMatch = await bcrypt.compare(password, owner.passwordHash);

  if (!isMatch) {
    return res.status(401).json({
      message: "Invalid email or password",
    });
  }

  // ✅ success
  res.json({
  message: "Login successful ✅",
  owner: {
    id: owner._id,
    fullName: owner.fullName,
    email: owner.email,
    accommodationName: owner.accommodationName,
    propertyType: owner.propertyType,
  },
});
});

// ================================
// GET PROPERTY OWNER APPLICATIONS (ADMIN)
// ================================
app.get("/api/admin/property-owners", async (req, res) => {
  try {
    const applications = await PropertyOwner.find()
      .sort({ createdAt: -1 }); // latest first

    res.json(applications);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch property owner applications",
    });
  }
});

// ================================
// ADMIN / TOURISM OFFICER REGISTER
// ================================
app.post("/api/admin/register", async (req, res) => {
  try {
    const { fullName, username, password } = req.body;

    let errors = {};

    // ========================
    // VALIDATIONS
    // ========================
    if (!fullName || fullName.trim() === "") {
      errors.fullName = "Full name is required";
    }

    if (!username || username.trim() === "") {
      errors.username = "Username is required";
    }

    if (!password) {
      errors.password = "Password is required";
    } else {
      if (password.length < 8)
        errors.password = "Password must be at least 8 characters";
      if (!/[A-Z]/.test(password))
        errors.password = "Password must contain at least 1 uppercase letter";
      if (!/\d/.test(password))
        errors.password = "Password must contain at least 1 number";
      if (!/[^A-Za-z0-9]/.test(password))
        errors.password = "Password must contain at least 1 symbol";
    }

    // If may validation errors
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }
    // ========================
// 🔒 SINGLE ADMIN SECURITY
// ========================
const adminCount = await Admin.countDocuments();

if (adminCount > 0) {
  return res.status(403).json({
    message: "Admin / Tourism Officer already exists. Registration is restricted.",
  });
}

    // ========================
    // CHECK DUPLICATE USERNAME
    // ========================
    const existingAdmin = await Admin.findOne({ username });

    if (existingAdmin) {
      return res.status(400).json({
        errors: {
          username: "Username already exists",
        },
      });
    }

    // ========================
    // HASH PASSWORD
    // ========================
    const passwordHash = await bcrypt.hash(password, 10);

    // ========================
    // SAVE TO DATABASE
    // ========================
    await Admin.create({
      fullName,
      username,
      passwordHash,
    });

    res.json({
      message: "Admin registered successfully ✅",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error during admin registration",
    });
  }
});

// ================================
// ADMIN / TOURISM OFFICER LOGIN
// ================================
app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    let errors = {};

    if (!username || username.trim() === "") {
      errors.username = "Username is required";
    }

    if (!password) {
      errors.password = "Password is required";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    const admin = await Admin.findOne({ username });

    if (!admin) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    res.json({
      message: "Admin login successful ✅",
      admin: {
        id: admin._id,
        username: admin.username,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error during admin login",
    });
  }
});

app.post(
  "/api/accommodations",
  accommodationUpload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "coverImages", maxCount: 20 },
    { name: "roomImages", maxCount: 20 },
  ]),
  async (req, res) => {
    try {
      const {
        accommodationName,
        businessAddress,
        description,
        roomData,
        selectedRooms,
        gcashNumber,
        gcashAccountName,
      } = req.body;

      if (!accommodationName || !businessAddress || !description) {
        return res.status(400).json({
          message: "Please fill all required fields",
        });
      }

      // ✅ Profile image
      const profileImagePath = req.files["profileImage"]
        ? `/uploads/${req.files["profileImage"][0].filename}`
        : null;

      // ✅ Cover images
      const coverImagePaths = req.files["coverImages"]
        ? req.files["coverImages"].map(
            (file) => `/uploads/${file.filename}`
          )
        : [];

      // ✅ Parse JSON room info
      const parsedRoomData = JSON.parse(roomData);
      const parsedSelectedRooms = JSON.parse(selectedRooms);

      // ✅ Room images
      const uploadedImages = req.files["roomImages"] || [];

      const imageRoomNames = req.body.roomImageNames
        ? Array.isArray(req.body.roomImageNames)
          ? req.body.roomImageNames
          : [req.body.roomImageNames]
        : [];

      const rooms = parsedSelectedRooms.map((roomName) => {
        const roomImageFiles = uploadedImages.filter(
          (_, index) => imageRoomNames[index] === roomName
        );

        return {
          roomName,
          price: parsedRoomData[roomName]?.price || 0,
          availableRooms: parsedRoomData[roomName]?.availableRooms || 0,
          maxPersons: parsedRoomData[roomName]?.maxPersons || 0,
          images: roomImageFiles.map(
            (file) => `/uploads/${file.filename}`
          ),
        };
      });

      // ✅ Save accommodation
      const newAccommodation = await Accommodation.create({
        accommodationName,
        businessAddress,
        description,
        profileImage: profileImagePath,
        coverImages: coverImagePaths,
        gcashNumber,
        gcashAccountName,
        rooms,
      });

      res.json({
        message: "Accommodation created successfully ✅",
        accommodation: newAccommodation,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Server error while creating accommodation",
      });
    }
  }
);

// ================================
// GET ALL ACCOMMODATIONS (FOR APP)
// ================================
app.get("/api/accommodations", async (req, res) => {
  try {
    const accommodations = await Accommodation.find().sort({ createdAt: -1 });

    res.json(accommodations);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch accommodations",
    });
  }
});

// ================================
// GET SINGLE ACCOMMODATION
// ================================
app.get("/api/accommodations/:id", async (req, res) => {
  try {
    const accommodation = await Accommodation.findById(req.params.id);
    if (!accommodation) {
      return res.status(404).json({ message: "Accommodation not found" });
    }
    res.json(accommodation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch accommodation" });
  }
});

// ================================
// UPDATE ACCOMMODATION
// ================================
app.put(
  "/api/accommodations/:id",
  accommodationUpload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "coverImages", maxCount: 20 },
    { name: "roomImages", maxCount: 20 },
  ]),
  async (req, res) => {
    try {
      const {
        accommodationName,
        businessAddress,
        description,
        gcashNumber,
        gcashAccountName,
        roomData,
        selectedRooms,
      } = req.body;

      const updatedData = {
        accommodationName,
        businessAddress,
        description,
        gcashNumber,
        gcashAccountName,
      };

      if (req.files["profileImage"]) {
        updatedData.profileImage =
          "/uploads/" + req.files["profileImage"][0].filename;
      }

      if (req.files["coverImages"]) {
        updatedData.coverImages = req.files["coverImages"].map(
          (file) => "/uploads/" + file.filename
        );
      }

      if (roomData && selectedRooms) {
        const parsedRoomData = JSON.parse(roomData);
        const parsedSelectedRooms = JSON.parse(selectedRooms);
        const uploadedImages = req.files["roomImages"] || [];
        const imageRoomNames = req.body.roomImageNames
          ? Array.isArray(req.body.roomImageNames)
            ? req.body.roomImageNames
            : [req.body.roomImageNames]
          : [];

        updatedData.rooms = parsedSelectedRooms.map((roomName) => {
          const roomImageFiles = uploadedImages.filter(
            (_, index) => imageRoomNames[index] === roomName
          );
          return {
            roomName,
            price: parsedRoomData[roomName]?.price || 0,
            availableRooms: parsedRoomData[roomName]?.availableRooms || 0,
            maxPersons: parsedRoomData[roomName]?.maxPersons || 0,
            images: roomImageFiles.map((file) => "/uploads/" + file.filename),
          };
        });
      }

      const updated = await Accommodation.findByIdAndUpdate(
        req.params.id,
        updatedData,
        { new: true }
      );

      res.json({
        message: "Accommodation updated successfully ✅",
        accommodation: updated,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to update accommodation" });
    }
  }
);

// ================================
// CREATE BOOKING
// ================================
app.post(
  "/api/bookings",
  bookingUpload.single("proofImage"),
  async (req, res) => {
    try {
      const {
        accommodationId, // ✅ added
        roomType,
        roomPrice,
        maxPersons,
        fullName,
        contactNumber,
        checkInDate,
        checkOutDate,
        gcashNumber,
        gcashAccountName,
        referenceNumber,
        userSessionId,
      } = req.body;

      const proofImagePath = req.file
        ? `/uploads/${req.file.filename}`
        : null;

      // ✅ find accommodation
      const accommodation = await Accommodation.findById(accommodationId);

      if (!accommodation) {
        return res.status(404).json({
          message: "Accommodation not found",
        });
      }

      // ✅ create booking
      const newBooking = await Booking.create({
        accommodationId: accommodationId,
        accommodationProfileImage: accommodation.profileImage,
        accommodationName: accommodation.accommodationName,
        businessAddress: accommodation.businessAddress,
        userSessionId: userSessionId,

        roomType,
        roomPrice,
        maxPersons,
        fullName,
        contactNumber,
        checkInDate,
        checkOutDate,
        gcashNumber,
        gcashAccountName,
        referenceNumber,
        proofImage: proofImagePath,
      });

      res.json({
        message: "Booking submitted successfully ✅",
        booking: newBooking,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Server error while creating booking",
      });
    }
  }
);

// ================================
// GET ALL BOOKINGS (FOR APP)
// ================================
app.get("/api/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });

    const enrichedBookings = await Promise.all(
      bookings.map(async (booking) => {
        let profileImage = null;
        let user = null; // ✅ FIX

        if (booking.userSessionId) {
          user = await User.findOne({
            sessionId: booking.userSessionId,
          });

          if (user && user.profileImage) {
            profileImage = user.profileImage;
          }
        }

        return {
          ...booking.toObject(),
          userProfileImage: profileImage,

          userFullName: user
            ? [
                user.firstName,
                user.middleName,
                user.lastName,
                user.extension,
              ]
                .filter(Boolean)
                .join(" ")
            : booking.fullName,
        };
      })
    );

    res.json(enrichedBookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch bookings",
    });
  }
});

// ================================
// ✅ CANCEL BOOKING (DELETE)
// ================================
app.delete("/api/bookings/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const deletedBooking = await Booking.findByIdAndDelete(id);

    if (!deletedBooking) {
      return res.status(404).json({
        message: "Booking not found",
      });
    }

    res.json({
      message: "Booking cancelled successfully ✅",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error while cancelling booking",
    });
  }
});

// ================================
// ✅ APPROVE BOOKING (PATCH)
// ================================
app.patch("/api/bookings/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Find booking
    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found",
      });
    }

    // ✅ Prevent double approval
    if (booking.status === "Approved") {
      return res.status(400).json({
        message: "Booking already approved",
      });
    }

    // ✅ Find accommodation
    const accommodation = await Accommodation.findById(
      booking.accommodationId
    );

    if (!accommodation) {
      return res.status(404).json({
        message: "Accommodation not found",
      });
    }

    // ✅ Find the correct room
    const room = accommodation.rooms.find(
      (r) => r.roomName === booking.roomType
    );

    if (!room) {
      return res.status(404).json({
        message: "Room not found",
      });
    }

    // ✅ Check if may available pa
    if (room.availableRooms <= 0) {
      return res.status(400).json({
        message: "No available rooms left",
      });
    }

    // ✅ Decrease available rooms
    room.availableRooms -= 1;

    // ✅ Save accommodation
    await accommodation.save();

    // ✅ Update booking status
    booking.status = "Approved";
    await booking.save();

    res.json({
      message: "Booking approved successfully ✅",
      booking,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error while approving booking",
    });
  }
});

// ================================
// ✅ COMPLETE BOOKING (PATCH)
// ================================
app.patch("/api/bookings/:id/complete", async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found",
      });
    }

    // ✅ Only approved bookings can be completed
    if (booking.status !== "Approved") {
      return res.status(400).json({
        message: "Only approved bookings can be completed",
      });
    }

    // ✅ Find accommodation
    const accommodation = await Accommodation.findById(
      booking.accommodationId
    );

    if (!accommodation) {
      return res.status(404).json({
        message: "Accommodation not found",
      });
    }

    // ✅ Find the correct room
    const room = accommodation.rooms.find(
      (r) => r.roomName === booking.roomType
    );

    if (!room) {
      return res.status(404).json({
        message: "Room not found",
      });
    }

    // ✅ Increase available rooms back
    room.availableRooms += 1;

    await accommodation.save();

    // ✅ Update booking status
    booking.status = "Completed";
    await booking.save();

    res.json({
      message: "Booking marked as completed ✅",
      booking,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error while completing booking",
    });
  }
});

// ================================
// CREATE ACCOMMODATION REVIEW
// ================================
app.post("/api/accommodation-reviews", async (req, res) => {
  try {
    const { accommodationId, rating, feedback, userSessionId } = req.body;

    if (!accommodationId || !rating) {
      return res.status(400).json({
        message: "Accommodation and rating are required",
      });
    }

    const newReview = await AccommodationReview.create({
      accommodationId,
      rating,
      feedback,
      userSessionId: userSessionId || "",
    });

    res.json({
      message: "Accommodation review submitted successfully ✅",
      review: newReview,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error while submitting accommodation review",
    });
  }
});

// ================================
// GET ACCOMMODATION REVIEW STATS
// ================================
app.get("/api/accommodation-reviews/:accommodationId", async (req, res) => {
  try {
    const { accommodationId } = req.params;

    const reviews = await AccommodationReview.find({ accommodationId }).sort({ createdAt: -1 });

    const reviewCount = reviews.length;

    const averageRating =
      reviewCount > 0
        ? (
            reviews.reduce((sum, r) => sum + r.rating, 0) /
            reviewCount
          ).toFixed(1)
        : 0;

    // Enrich reviews with user info
    const enrichedReviews = await Promise.all(
      reviews.map(async (review) => {
        let userName = "Anonymous";
        let userProfileImage = null;

        if (review.userSessionId) {
          const user = await User.findOne({ sessionId: review.userSessionId });
          if (user) {
            userName = [
              user.firstName,
              user.middleName,
              user.lastName,
              user.extension,
            ]
              .filter(Boolean)
              .join(" ");
            userProfileImage = user.profileImage || null;
          }
        }

        return {
          ...review.toObject(),
          userName,
          userProfileImage,
        };
      })
    );

    res.json({
      averageRating,
      reviewCount,
      reviews: enrichedReviews,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch accommodation reviews",
    });
  }
});

// ================================
// CREATE TOURIST REVIEW
// ================================
app.post("/api/tourist-reviews", async (req, res) => {
  try {
    const { touristSpotId, rating, feedback, userSessionId } = req.body;

    if (!touristSpotId || !rating) {
      return res.status(400).json({
        message: "Tourist spot and rating are required",
      });
    }

    const newReview = await TouristReview.create({
      touristSpotId,
      rating,
      feedback,
      userSessionId: userSessionId || "",
    });

    res.json({
      message: "Tourist review submitted successfully ✅",
      review: newReview,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error while submitting tourist review",
    });
  }
});

// ================================
// GET TOURIST REVIEW STATS
// ================================
app.get("/api/tourist-reviews/:touristSpotId", async (req, res) => {
  try {
    const { touristSpotId } = req.params;

    const reviews = await TouristReview.find({ touristSpotId }).sort({ createdAt: -1 });

    const reviewCount = reviews.length;

    const averageRating =
      reviewCount > 0
        ? (
            reviews.reduce((sum, r) => sum + r.rating, 0) /
            reviewCount
          ).toFixed(1)
        : 0;

    // Enrich reviews with user info
    const enrichedReviews = await Promise.all(
      reviews.map(async (review) => {
        let userName = "Anonymous";
        let userProfileImage = null;

        if (review.userSessionId) {
          const user = await User.findOne({ sessionId: review.userSessionId });
          if (user) {
            userName = [
              user.firstName,
              user.middleName,
              user.lastName,
              user.extension,
            ]
              .filter(Boolean)
              .join(" ");
            userProfileImage = user.profileImage || null;
          }
        }

        return {
          ...review.toObject(),
          userName,
          userProfileImage,
        };
      })
    );

    res.json({
      averageRating,
      reviewCount,
      reviews: enrichedReviews,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch tourist reviews",
    });
  }
});

// ================================
// CREATE TOURIST SPOT
// ================================
app.post(
  "/api/tourist-spots",
  touristUpload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "coverImages", maxCount: 20 },
  ]),
  async (req, res) => {
    try {
      const { name, address, description, entranceFee } = req.body;

      if (!name || !address || !description) {
        return res.status(400).json({
          message: "Please fill all required fields",
        });
      }

      const profileImagePath = req.files["profileImage"]
        ? `/uploads/${req.files["profileImage"][0].filename}`
        : null;

      const coverImagePaths = req.files["coverImages"]
        ? req.files["coverImages"].map(
            (file) => `/uploads/${file.filename}`
          )
        : [];

      if (!profileImagePath || coverImagePaths.length === 0) {
        return res.status(400).json({
          message: "Images are required",
        });
      }

      const parsedEntranceFee = JSON.parse(entranceFee);

      const newTouristSpot = await TouristSpot.create({
        name,
        address,
        description,
        entranceFee: parsedEntranceFee,
        profileImage: profileImagePath,
        coverImages: coverImagePaths,
      });

      res.json({
        message: "Tourist spot added successfully ✅",
        touristSpot: newTouristSpot,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Server error while creating tourist spot",
      });
    }
  }
);

// ================================
// GET ALL TOURIST SPOTS
// ================================
app.get("/api/tourist-spots", async (req, res) => {
  try {
    const touristSpots = await TouristSpot.find().sort({ createdAt: -1 });
    res.json(touristSpots);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch tourist spots",
    });
  }
});

// ================================
// GET SINGLE TOURIST SPOT
// ================================
app.get("/api/tourist-spots/:id", async (req, res) => {
  try {
    const spot = await TouristSpot.findById(req.params.id);

    if (!spot) {
      return res.status(404).json({ message: "Not found" });
    }

    res.json(spot);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ================================
// UPDATE TOURIST SPOT
// ================================
app.put(
  "/api/tourist-spots/:id",
  touristUpload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "coverImages", maxCount: 20 },
  ]),
  async (req, res) => {
    try {
      const { name, address, description, entranceFee } = req.body;

      const updatedData = {
        name,
        address,
        description,
        entranceFee: JSON.parse(entranceFee),
      };

      if (req.files["profileImage"]) {
        updatedData.profileImage =
          "/uploads/" + req.files["profileImage"][0].filename;
      }

      if (req.files["coverImages"]) {
        updatedData.coverImages =
          req.files["coverImages"].map(
            (file) => "/uploads/" + file.filename
          );
      }

      const updated = await TouristSpot.findByIdAndUpdate(
        req.params.id,
        updatedData,
        { new: true }
      );

      res.json({
        message: "Tourist spot updated successfully ✅",
        touristSpot: updated,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Failed to update tourist spot",
      });
    }
  }
);

// ================================
// UPLOAD REPORT FILES
// ================================
app.post(
  "/api/reports",
  reportUpload.array("reports", 20),
  async (req, res) => {
    try {
      const {
        ownerId,
        ownerName,
        accommodationName,
        propertyType,
      } = req.body;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          message: "No files uploaded",
        });
      }

      const savedReports = await Promise.all(
        req.files.map(async (file) => {
          return await Report.create({
            ownerId,
            ownerName,
            accommodationName,
            propertyType,

            fileName: file.originalname,
            filePath: `/uploads/${file.filename}`,
            fileSize: file.size,
            fileType: file.mimetype,
          });
        })
      );

      res.json({
        message: "Reports uploaded successfully ✅",
        reports: savedReports,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Server error while uploading reports",
      });
    }
  }
);

// ================================
// GET ALL REPORTS
// ================================
app.get("/api/reports", async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch reports",
    });
  }
});

// ================================
// DELETE REPORT
// ================================
app.delete("/api/reports/:id", async (req, res) => {
  try {
    await Report.findByIdAndDelete(req.params.id);

    res.json({
      message: "Report deleted successfully ✅",
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete report",
    });
  }
});

// ================================
// SUBMIT REPORTS
// ================================
app.post(
  "/api/reports",
  reportUpload.array("reports", 10),
  async (req, res) => {
    try {
      const {
        ownerId,
        ownerName,
        accommodationName,
        propertyType,
      } = req.body;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          message: "No files uploaded",
        });
      }

      const savedReports = [];

      for (const file of req.files) {
        const newReport = await Report.create({
          ownerId,
          ownerName,
          accommodationName,
          propertyType,
          fileName: file.originalname,
          fileSize: file.size,
          fileType: file.mimetype,
          filePath: `/uploads/${file.filename}`,
          status: "Pending",
        });

        savedReports.push(newReport);
      }

      res.json({
        message: "Reports uploaded successfully",
        reports: savedReports,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Failed to upload reports",
      });
    }
  }
);

// ================================
// GET REPORTS
// ================================
app.get("/api/reports", async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });

    res.json(reports);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch reports",
    });
  }
});

// ================================
// ✅ UPDATE MULTIPLE REPORTS STATUS (ADMIN BULK APPROVE)
// ================================
app.patch("/api/reports/bulk-status", async (req, res) => {
  try {
    const { ids, status } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No IDs provided" });
    }

    await Report.updateMany(
      { _id: { $in: ids } },
      { $set: { status } }
    );

    res.json({ message: "Reports status updated successfully ✅" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update reports status" });
  }
});

// ================================
// ✅ UPDATE REPORT STATUS (ADMIN)
// ================================
app.patch("/api/reports/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        message: "Report not found",
      });
    }

    report.status = status;
    await report.save();

    res.json({
      message: "Report status updated successfully ✅",
      report,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to update report status",
    });
  }
});

// ================================
// TOURISM SITE MANAGER REGISTER
// ================================
app.post("/api/tourism-site-manager/register", async (req, res) => {
  try {
    const { fullName, username, password } = req.body;

    let errors = {};

    // ========================
    // VALIDATIONS
    // ========================
    if (!fullName || fullName.trim() === "") {
      errors.fullName = "Full name is required";
    }

    if (!username || username.trim() === "") {
      errors.username = "Username is required";
    }

    if (!password) {
      errors.password = "Password is required";
    } else {
      if (password.length < 8)
        errors.password = "Password must be at least 8 characters";
      if (!/[A-Z]/.test(password))
        errors.password = "Password must contain at least 1 uppercase letter";
      if (!/\d/.test(password))
        errors.password = "Password must contain at least 1 number";
      if (!/[^A-Za-z0-9]/.test(password))
        errors.password = "Password must contain at least 1 symbol";
    }

    // If may validation errors
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    // ========================
    // CHECK DUPLICATE USERNAME
    // ========================
    const existing = await TourismSiteManager.findOne({ username });

    if (existing) {
      return res.status(400).json({
        errors: {
          username: "Username already exists",
        },
      });
    }

    // ========================
    // HASH PASSWORD
    // ========================
    const passwordHash = await bcrypt.hash(password, 10);

    // ========================
    // SAVE TO DATABASE
    // ========================
    await TourismSiteManager.create({
      fullName,
      username,
      passwordHash,
    });

    res.json({
      message: "Tourism Site Manager registered successfully ✅",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error during registration",
    });
  }
});

// ================================
// TOURISM SITE MANAGER LOGIN
// ================================
app.post("/api/tourism-site-manager/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    let errors = {};

    if (!username || username.trim() === "") {
      errors.username = "Username is required";
    }

    if (!password) {
      errors.password = "Password is required";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    const manager = await TourismSiteManager.findOne({ username });

    if (!manager) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    const isMatch = await bcrypt.compare(password, manager.passwordHash);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    res.json({
      message: "Tourism Site Manager login successful ✅",
      manager: {
        id: manager._id,
        fullName: manager.fullName,
        username: manager.username,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error during login",
    });
  }
});

// ================================
// UPLOAD TOURIST SPOT REPORT FILES
// ================================
app.post(
  "/api/tourist-spot-reports",
  reportUpload.array("reports", 20),
  async (req, res) => {
    try {
      const {
        managerId,
        managerName,
        touristSpotName,
        touristSpotLocation,
      } = req.body;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const savedReports = await Promise.all(
        req.files.map(async (file) => {
          return await TouristSpotReport.create({
            managerId,
            managerName,
            touristSpotName,
            touristSpotLocation,
            fileName: file.originalname,
            filePath: `/uploads/${file.filename}`,
            fileSize: file.size,
            fileType: file.mimetype,
            status: "Pending",
          });
        })
      );

      res.json({
        message: "Tourist spot reports uploaded successfully ✅",
        reports: savedReports,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error while uploading tourist spot reports" });
    }
  }
);

// ================================
// GET ALL TOURIST SPOT REPORTS
// ================================
app.get("/api/tourist-spot-reports", async (req, res) => {
  try {
    const reports = await TouristSpotReport.find().sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch tourist spot reports" });
  }
});

// ================================
// DELETE TOURIST SPOT REPORT
// ================================
app.delete("/api/tourist-spot-reports/:id", async (req, res) => {
  try {
    await TouristSpotReport.findByIdAndDelete(req.params.id);
    res.json({ message: "Tourist spot report deleted successfully ✅" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete tourist spot report" });
  }
});

// ================================
// BULK UPDATE STATUS - TOURIST SPOT REPORTS
// ================================
app.patch("/api/tourist-spot-reports/bulk-status", async (req, res) => {
  try {
    const { ids, status } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No IDs provided" });
    }

    await TouristSpotReport.updateMany(
      { _id: { $in: ids } },
      { $set: { status } }
    );

    res.json({ message: "Tourist spot reports status updated successfully ✅" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update tourist spot reports status" });
  }
});

mongoose.connect(
  'mongodb+srv://trinigo_db:BvxiKMAnR46jPvS6@cluster-1.wuxd9zd.mongodb.net/trinigo',

)
.then(() => {
  console.log('✅ MongoDB connected successfully');
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});