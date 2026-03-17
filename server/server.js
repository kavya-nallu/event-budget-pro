const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
require('dotenv').config();

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

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ Connection Error:", err));

// Auth & Event Routes (Same as before, ensuring Expenses are updated correctly)
app.post('/api/users/login', async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const user = await User.findOne({ username, role });
    if (!user) return res.status(401).send("Invalid credentials!");
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch && password !== user.password) return res.status(401).send("Invalid credentials!");
    res.status(200).json(user);
  } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/users/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword, role });
    await newUser.save();
    res.status(201).send("User created");
  } catch (err) { res.status(400).send(err.message); }
});

app.get('/api/events/all', async (req, res) => {
  const events = await Event.find().sort({ createdAt: -1 });
  res.json(events);
});

app.post('/api/events/add', async (req, res) => {
  const newEvent = new Event(req.body);
  await newEvent.save();
  res.status(201).json(newEvent);
});

app.put('/api/events/update-expenses/:eventId', async (req, res) => {
  const { categoryId, expenses } = req.body;
  const event = await Event.findById(req.params.eventId);
  const category = event.categories.id(categoryId);
  category.expenses = expenses; 
  await event.save();
  res.status(200).send("Updated!");
});

app.put('/api/events/update-event/:id', async (req, res) => {
    const updatedEvent = await Event.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    res.status(200).json(updatedEvent);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));