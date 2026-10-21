import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  name: { type: String, required: true },
  fileType: { type: String, enum: ['CSV', 'PDF'], required: true },
  fingerprint: { type: String, required: true },
  count: { type: Number, required: true },
  status: { type: String, default: 'Completed' },
}, { timestamps: true });
schema.index({ user: 1, fingerprint: 1 }, { unique: true });
export default mongoose.model('Statement', schema);
