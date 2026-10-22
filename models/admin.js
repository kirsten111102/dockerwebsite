const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: 3,
            maxlength: 50
        },
        passwordHash: {
            type: String,
            required: true,
            select: false
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Admin", adminSchema);