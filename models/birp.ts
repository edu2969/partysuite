import mongoose, { Schema, models, model } from "mongoose";

const BIRPSchema = new Schema(
  {
    eventoId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },

    rpId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    inscritos: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    asisten: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    collection: "birps",
  }
);

BIRPSchema.index(
  {
    eventoId: 1,
    rpId: 1,
  },
  {
    unique: true,
  }
);

export default models.BIRP || model("BIRP", BIRPSchema);