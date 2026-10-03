import { Schema, models, model } from "mongoose";

const EventSchema = new Schema(
  {
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

    businessDate: {
      type: Date,
      required: true,
      index: true,
    },

    startsAt: {
      type: Date,
      required: true,
    },

    timeZone: {
      type: String,
      required: true,
      default: "America/Santiago",
    },

    listClosedAt: {
      type: Date,
      required: true,
    },

    closeAt: {
      type: Date,
      required: true,
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