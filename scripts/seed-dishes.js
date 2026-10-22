
require("dotenv").config();

const mongoose = require("mongoose");
const Dish = require("../models/dish");

const dishes = [
    {
        name: "Gotcha Pork Roast",
        category: "Main Course",
        price: 16.99,
        image: "/images/foods/gotcha-pork-roast.jpg",
        description:
            "A creative potato, mushroom, and bacon roast inspired by Soma's resourceful cooking."
    },
    {
        name: "Transforming Furikake Gohan",
        category: "Rice Dish",
        price: 9.99,
        image: "/images/foods/furikake-gohan.jpg",
        description:
            "Warm Japanese rice topped with a savory, umami-rich furikake-inspired seasoning."
    },
    {
        name: "Chaliapin Steak Don",
        category: "Rice Bowl",
        price: 15.99,
        image: "/images/foods/chaliapin-steak-don.jpg",
        description:
            "Tender onion-marinated steak served over steamed rice, inspired by Soma's cooking challenge."
    },
    {
        name: "Yukihira Special Omurice",
        category: "Rice Dish",
        price: 12.99,
        image: "/images/foods/yukihira-omurice.jpg",
        description:
            "Fluffy Japanese omelet over seasoned rice, finished with a rich house sauce."
    },
    {
        name: "Sumire Karaage Roll",
        category: "Main Course",
        price: 11.99,
        image: "/images/foods/sumire-karaage.jpg",
        description:
            "Crispy Japanese fried chicken served with shredded cabbage and a savory sauce."
    },
    {
        name: "Yukihira Apple Risotto",
        category: "Specialty",
        price: 13.99,
        image: "/images/foods/apple-risotto.jpg",
        description:
            "Creamy risotto with a delicate apple flavor, created as a seasonal diner special."
    }
];

async function seedDishes() {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI is missing from your .env file.");
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB.");

        for (const dish of dishes) {
            await Dish.updateOne(
                { name: dish.name },
                { $set: dish },
                { upsert: true, runValidators: true }
            );
        }

        console.log(`Successfully seeded ${dishes.length} dishes.`);
    } catch (error) {
        console.error("Failed to seed dishes:", error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

seedDishes();
