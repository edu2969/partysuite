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

    checktime: {
      type: Date,
      optional: true
    }
  },
  {
    timestamps: true, // Created es fecha de importación, Updated es fecha de checkin
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