const mongoose = require('mongoose');

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
      expenses: { type: Array, default: [] } 
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Event || mongoose.model('Event', EventSchema);