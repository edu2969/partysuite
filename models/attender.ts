import { Schema, models, model } from "mongoose";

const AttenderSchema = new Schema(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },

    guestId: {
      type: Schema.Types.ObjectId,
      ref: "Guest",
      required: true,
      index: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    fecha: {
      type: Date,
      default: Date.now,
    },

    checktime: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

AttenderSchema.index(
  {
    eventId: 1,
    guestId: 1,
  },
  {
    unique: true,
  }
);

export default models.Attender || model("Attender", AttenderSchema);