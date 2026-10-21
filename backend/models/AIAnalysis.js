import mongoose from 'mongoose';

const analysis = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: String, required: true }, fingerprint: { type: String, required: true },
  report: { type: mongoose.Schema.Types.Mixed, required: true },
  model: { type: String, required: true }, provider: { type: String, required: true },
}, { timestamps: true });
analysis.index({ user: 1, month: 1 }, { unique: true });
export default mongoose.model('AIAnalysis', analysis);
