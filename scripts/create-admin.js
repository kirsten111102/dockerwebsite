require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const readline = require("readline");
const Admin = require("../models/admin");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

async function main() {
    const username = (await ask("Admin username: ")).trim();
    const password = await ask("New admin password: ");

    if (username.length < 3 || username.length > 50) {
        throw new Error("Username must be 3–50 characters.");
    }

    if (!password) {
        throw new Error("Password cannot be empty.");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const existing = await Admin.findOne({ username });

    if (existing) {
        throw new Error("That username already exists.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await Admin.create({ username, passwordHash });

    console.log(`Admin "${username}" created successfully.`);
}

main()
    .catch((err) => {
        console.error("Failed to create admin:", err.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        rl.close();
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    });
