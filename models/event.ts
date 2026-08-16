import { Schema, models, model } from "mongoose";

const EventSchema = new Schema(
  {
    created: {
      type: Date,
      default: Date.now,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    date: {
      type: Date,
      required: true,
      index: true,
    },

    closeTime: {
      type: Number,
      required: true,
      default: 13.5 * 60 * 60 * 1000,
    },

    total: {
      type: Number,
      default: 0,
    },

    arrives: {
      type: Number,
      default: 0,
    },

    averageCheckTime: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export default models.Event || model("Event", EventSchema);