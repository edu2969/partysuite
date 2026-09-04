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

    baneado: {
      type: Boolean,
      default: false,
      index: true,
    },

    observacion: {
      type: String,
      default: "",
      trim: true,
    },

    asistencias: {
      type: Number,
      default: 0,
      min: 0,
    },

    inscripciones: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    collection: "guests",
  }
);

export default models.Guest || model("Guest", GuestSchema);