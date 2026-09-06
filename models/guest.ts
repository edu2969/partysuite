import { Schema, models, model } from "mongoose";

const GuestSchema = new Schema(
  {
    rut: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    names: {
      type: String,
      required: true,
      trim: true,
    },

    vip: {
      type: Boolean,
      default: false,
      index: true
    },

    royalties: {
      type: String
    },

    banned: {
      type: Boolean,
      default: false,
      index: true,
    },

    observation: {
      type: String,
      default: "",
      trim: true,
    },

    arrives: {
      type: Number,
      default: 0,
      min: 0,
    },

    inscriptions: {
      type: Number,
      default: 0,
      min: 0,
    },

    ratio: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    collection: "guests",
  }
);

export default models.Guest || model("Guest", GuestSchema);