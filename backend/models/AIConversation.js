import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: String, required: true },
  messages: [{ role: { type: String, enum: ['user', 'assistant'], required: true }, content: { type: String, required: true }, createdAt: { type: Date, default: Date.now } }],
}, { timestamps: true });
schema.index({ user: 1, month: 1 }, { unique: true });
export default mongoose.model('AIConversation', schema);
