const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
require('dotenv').config();

// ====== Debug ENV ======
const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL;
console.log("Mongo URI:", mongoUri ? "Loaded ✅" : "Missing ❌");

// ====== FORCE DEBUG MONGODB CONNECTION ======
async function connectDB() {
  if (!mongoUri) {
    console.error("❌ ERROR: MONGO_URI is missing!");
    process.exit(1);
  }

  try {
    console.log("⏳ Connecting to MongoDB...");

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000 // fail fast
    });

    console.log("✅ MongoDB Connected Successfully");
  } catch (err) {
    console.error("❌ MongoDB CONNECTION FAILED:");
    console.error("👉 Message:", err.message);
    console.error("👉 Full Error:", err);
  }
}

connectDB();

// Runtime error listener
mongoose.connection.on("error", err => {
  console.log("❌ MongoDB runtime error:", err.message);
});

// ====== Models ======
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const EventSchema = new mongoose.Schema({
  eventName: { type: String, required: true },
  totalBudget: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  categories: [
    {
      name: { type: String, required: true },
      amount: { type: Number, required: true },
      coordRealName: { type: String, default: "" },
      assignedCoordinator: { type: String, required: true },
      coordPassword: { type: String, required: true },
      expenses: [
        {
          day: Number,
          hotelName: String,
          rooms: String,
          travelType: String,
          vehicleName: String,
          fromLoc: String,
          toLoc: String,
          checkInDate: String,
          checkOutDate: String,
          items: [
            { itemName: String, itemAmount: Number }
          ]
        }
      ]
    }
  ],
  createdAt: { type: Date, default: Date.now }
});
const Event = mongoose.models.Event || mongoose.model('Event', EventSchema);

// ====== App Setup ======
const app = express();
app.use(cors());
app.use(express.json());

// ====== Health Routes ======
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

app.get("/ping", (req, res) => {
  res.send("Backend is alive!");
});

// ====== Auth Routes ======
app.post('/api/users/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    const user = await User.findOne({ username, role });
    if (!user) return res.status(401).send("Invalid credentials");

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).send("Invalid credentials");

    res.json(user);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/api/users/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    const hash = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hash, role });

    await user.save();
    res.status(201).send("User created");
  } catch (err) {
    res.status(400).send(err.message);
  }
});

// ====== Event Routes ======
app.get('/api/events/all', async (req, res) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });
    res.json(events);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/api/events/add', async (req, res) => {
  try {
    const event = new Event(req.body);
    await event.save();
    res.status(201).json(event);
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.put('/api/events/update-expenses/:eventId', async (req, res) => {
  try {
    const { categoryId, expenses } = req.body;

    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).send("Event not found");

    const category = event.categories.id(categoryId);
    if (!category) return res.status(404).send("Category not found");

    category.expenses = expenses;
    await event.save();

    res.send("Updated");
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.put('/api/events/update-event/:id', async (req, res) => {
  try {
    const updated = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    if (!updated) return res.status(404).send("Event not found");

    res.json(updated);
  } catch (err) {
    res.status(400).send(err.message);
  }
});

// ====== Start Server ======
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});