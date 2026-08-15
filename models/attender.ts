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

    rpId: {
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

    qr: {
      type: String,
      default: null,
    },

    observations: {
      type: String,
      default: "",
    },

    validatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    device: {
      type: String,
      default: "",
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