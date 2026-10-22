const mongoose = require("mongoose");

const dishSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 120 },
        category: { type: String, required: true, trim: true, maxlength: 60 },
        price: {
            type: Number,
            required: true,
            min: 0,
            validate: { validator: Number.isFinite, message: "Price must be a valid number" }
        },
        image: { type: String, required: true, trim: true, maxlength: 2048 },
        imageStatus: {
            type: String,
            enum: ["processing", "completed", "failed"],
            default: "processing"
        },
        imageError: { type: String, default: null },
        description: { type: String, required: true, trim: true, maxlength: 2000 }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Dish", dishSchema);
