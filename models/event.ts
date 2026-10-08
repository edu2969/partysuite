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

    deleted: {
      type: Boolean,
      default: false,
      index: true,
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

const EventModel = models.Event || model("Event", EventSchema);

if (!EventModel.schema.path("deleted")) {
  EventModel.schema.add({
    deleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  });
}

export default EventModel;