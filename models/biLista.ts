import { Schema, models, model } from "mongoose";

const BIListaSchema = new Schema(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },

    userId: {
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
    timestamps: true
  }
);

BIListaSchema.index(
  {
    eventId: 1,
    userId: 1,
  },
  {
    unique: true,
  }
);

export default models.BILista || model("BILista", BIListaSchema);