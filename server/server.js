const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const User = require('./models/User');
const Event = require('./models/Event');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ Connection Error:", err));

// --- AUTH ---
app.post('/api/users/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const newUser = new User({ username, password, role });
    await newUser.save();
    res.status(201).send("Success");
  } catch (err) { res.status(400).send(err.message); }
});

app.post('/api/users/login', async (req, res) => {
  const { username, password, role } = req.body;
  const user = await User.findOne({ username, password, role });
  if (user) res.status(200).json(user);
  else res.status(401).send("Invalid credentials!");
});

// --- EVENTS ---
app.post('/api/events/add', async (req, res) => {
  try {
    const newEvent = new Event(req.body);
    await newEvent.save();
    res.status(201).json(newEvent);
  } catch (err) { res.status(400).send(err.message); }
});

app.get('/api/events/all', async (req, res) => {
  try {
    const events = await Event.find();
    res.json(events);
  } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/events/update-expenses/:eventId', async (req, res) => {
  try {
    const { categoryId, expenses } = req.body;
    const event = await Event.findById(req.params.eventId);
    const category = event.categories.id(categoryId);
    category.expenses = expenses;
    await event.save();
    res.status(200).send("Updated");
  } catch (err) { res.status(500).send(err.message); }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.status(200).send("Deleted");
  } catch (err) { res.status(500).send(err.message); }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));