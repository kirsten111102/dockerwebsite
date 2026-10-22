const express = require("express");
const Dish = require("../models/dish");

const router = express.Router();

router.get("/", async (req, res, next) => {
    try {
        const dishes = await Dish.find().sort({ createdAt: -1 }).lean();

        res.render("index", { dishes });
    } catch (error) {
        next(error);
    }
});

router.get("/products", async (req, res, next) => {
    try {
        const { search = "", category = "" } = req.query;

        const filter = {};
        const keyword = String(search).trim().slice(0, 100);
        const selectedCategory = String(category).trim().slice(0, 60);

        if (keyword) {
            const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

            filter.$or = [
                { name: { $regex: escaped, $options: "i" } },
                { description: { $regex: escaped, $options: "i" } }
            ];
        }

        if (selectedCategory) {
            filter.category = selectedCategory;
        }

        const [dishes, categories] = await Promise.all([
            Dish.find(filter).sort({ name: 1 }).lean(),
            Dish.distinct("category")
        ]);

        res.render("products", {
            dishes,
            categories: categories.sort(),
            search: keyword,
            category: selectedCategory
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;