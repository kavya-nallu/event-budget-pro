const express = require('express');
const router = express.Router();
const Event = require('../models/Event'); // Import the Blueprint we just made

// POST Route: This "door" accepts new event data
router.post('/add', async (req, res) => {
  try {
    const { eventName, totalBudget, startDate, endDate } = req.body;

    const newEvent = new Event({
      eventName,
      totalBudget,
      startDate,
      endDate
    });

    const savedEvent = await newEvent.save();
    res.status(201).json(savedEvent); // Success! Send the saved event back
  } catch (err) {
    res.status(400).json({ message: err.message }); // Something went wrong
  }
});

// GET Route: This "door" lets us see all events we've created
router.get('/all', async (req, res) => {
  try {
    const events = await Event.find();
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;