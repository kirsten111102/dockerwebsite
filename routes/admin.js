const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Dish = require("../models/dish");
const Admin = require("../models/admin");
const { requireAdmin } = require("../middleware/auth");
const { publishImageTask } = require("../services/imageQueue");

const router = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false
});

const uploadDir = path.join(__dirname, "..", "public", "images", "foods", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir),
        filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `${Date.now()}-${require("crypto").randomUUID()}${ext}`);
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
        const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
        if (!allowed.has(file.mimetype)) {
            return cb(new Error("Please upload a JPG, PNG, or WebP image."));
        }
        cb(null, true);
    }
});

function validateDish(body) {
    const name = String(body.name || "").trim();
    const category = String(body.category || "").trim();
    const description = String(body.description || "").trim();
    const price = Number(body.price);

    if (
        !name || name.length > 120 ||
        !category || category.length > 60 ||
        !description || description.length > 2000 ||
        !Number.isFinite(price) || price < 0
    ) return null;

    return { name, category, description, price };
}

// Login page
router.get("/login", (req, res) => {
    if (req.session.adminId) return res.redirect("/admin");
    res.render("login", { error: null });
});

// Authenticate admin
router.post("/login", loginLimiter, async (req, res, next) => {
    try {
        const username = String(req.body.username || "").trim();
        const password = String(req.body.password || "");
        const admin = await Admin.findOne({ username }).select("+passwordHash");
        const valid = admin && await bcrypt.compare(password, admin.passwordHash);

        if (!valid) {
            return res.status(401).render("login", {
                error: "Invalid username or password"
            });
        }

        req.session.regenerate((error) => {
            if (error) return next(error);
            req.session.adminId = admin._id.toString();
            req.session.save((saveError) => {
                if (saveError) return next(saveError);
                res.redirect("/admin");
            });
        });
    } catch (error) {
        next(error);
    }
});

// All routes below this point require an authenticated admin.
router.use(requireAdmin);

router.get("/", async (req, res, next) => {
    try {
        const dishes = await Dish.find().sort({ name: 1 }).lean();
        res.render("admin", { dishes });
    } catch (error) {
        next(error);
    }
});

// Add a dish and enqueue its image for asynchronous processing.
router.post("/dishes/add", (req, res, next) => {
    upload.single("image")(req, res, async (uploadError) => {
        if (uploadError) {
            const status = uploadError instanceof multer.MulterError ? 400 : 400;
            return res.status(status).send(uploadError.message);
        }

        let createdDish;
        try {
            const data = validateDish(req.body);
            if (!data || !req.file) {
                if (req.file) fs.unlink(req.file.path, () => {});
                return res.status(400).send("Please enter valid dish details and choose an image.");
            }

            const sourceUrl = `/images/foods/uploads/${req.file.filename}`;
            createdDish = await Dish.create({
                ...data,
                image: sourceUrl,
                imageStatus: "processing",
                imageError: null
            });

            try {
                await publishImageTask({
                    dishId: createdDish._id.toString(),
                    filename: req.file.filename
                });
            } catch (queueError) {
                await Dish.findByIdAndUpdate(createdDish._id, {
                    imageStatus: "failed",
                    imageError: "Could not enqueue image processing task"
                });
                console.error("Could not publish image task:", queueError);
                return res.status(503).send(
                    "The dish was saved, but image processing could not be queued. Please check RabbitMQ and try again."
                );
            }

            return res.redirect("/admin");
        } catch (error) {
            if (req.file && !createdDish) fs.unlink(req.file.path, () => {});
            next(error);
        }
    });
});

// Show edit form
router.get("/dishes/:id/edit", async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).send("Invalid dish ID.");
        }
        const dish = await Dish.findById(req.params.id).lean();
        if (!dish) return res.status(404).send("Dish not found.");
        res.render("edit", { dish, error: null });
    } catch (error) {
        next(error);
    }
});

// Save edited dish (the existing edit form continues to accept an image URL/path).
router.post("/dishes/:id/edit", async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).send("Invalid dish ID.");
        }

        const data = validateDish(req.body);
        const image = String(req.body.image || "").trim();
        const isLocalImage = /^\/images\/foods\/[\w./-]+\.(jpg|jpeg|png|webp)$/i.test(image)
            && !image.split("/").includes("..");
        let isExternalImage = false;
        try {
            const url = new URL(image);
            isExternalImage = ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname);
        } catch {}

        if (!data || (!isLocalImage && !isExternalImage) || image.length > 2048) {
            const dish = await Dish.findById(req.params.id).lean();
            if (!dish) return res.status(404).send("Dish not found.");
            return res.status(400).render("edit", {
                dish: { ...dish, ...req.body },
                error: "Please enter valid dish details."
            });
        }

        const updated = await Dish.findOneAndUpdate(
            { _id: req.params.id },
            { ...data, image },
            { returnDocument: "after", runValidators: true }
        );
        if (!updated) return res.status(404).send("Dish not found.");
        res.redirect("/admin");
    } catch (error) {
        next(error);
    }
});

// Delete dish
router.post("/dishes/delete/:id", async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).send("Invalid dish ID.");
        }
        const deleted = await Dish.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).send("Dish not found.");
        res.redirect("/admin");
    } catch (error) {
        next(error);
    }
});

// Logout
router.post("/logout", (req, res, next) => {
    req.session.destroy((error) => {
        if (error) return next(error);
        res.clearCookie("yukihira.sid");
        res.redirect("/");
    });
});

module.exports = router;
