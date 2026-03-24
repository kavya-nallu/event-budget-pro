// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
require('dotenv').config();

// ====== User Model ======
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true } 
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

// ====== Event Model ======
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

// ====== MongoDB Connection ======
const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL;
if (!mongoUri) {
  console.error("❌ MONGO_URI not set in environment variables!");
  process.exit(1);
}

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ Connection Error:", err));

// ====== Temporary Ping Route ======
app.get('/ping', (req, res) => {
  res.send('Backend is alive!');
});

// ====== Auth Routes ======
app.post('/api/users/login', async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const user = await User.findOne({ username, role });
    if (!user) return res.status(401).send("Invalid credentials!");
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).send("Invalid credentials!");
    res.status(200).json(user);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/api/users/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword, role });
    await newUser.save();
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
    const newEvent = new Event(req.body);
    await newEvent.save();
    res.status(201).json(newEvent);
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.put('/api/events/update-expenses/:eventId', async (req, res) => {
  try {
    const { categoryId, expenses } = req.body;
    const event = await Event.findById(req.params.eventId);
    const category = event.categories.id(categoryId);
    category.expenses = expenses; 
    await event.save();
    res.status(200).send("Updated!");
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.put('/api/events/update-event/:id', async (req, res) => {
  try {
    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    res.status(200).json(updatedEvent);
  } catch (err) {
    res.status(400).send(err.message);
  }
});

// ====== Start Server ======
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
app.get("/", (req, res) => {
  res.send("Backend is working 🚀");
});