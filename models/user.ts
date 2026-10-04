import mongoose, { Schema, models } from "mongoose";

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    changedAt: {
      type: Date,
      optional: true
    },
    role: {
      type: String,
      default: null,
    },
    maxAttendersByEvent: {
      type: Number,
      default: 500
    },
    maxImportTime: {
      type: String,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    }

  },
  { timestamps: true }
);

const User = models.User || mongoose.model("User", userSchema);
export default User;