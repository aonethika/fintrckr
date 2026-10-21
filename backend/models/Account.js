import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  institution: { type: String, trim: true, default: '' },
  type: { type: String, enum: ['Bank', 'Credit card', 'Cash', 'Investment'], default: 'Bank' },
  openingBalance: { type: Number, default: 0 },
  lastFour: { type: String, default: '', maxlength: 4 },
}, { timestamps: true });
export default mongoose.model('Account', schema);
