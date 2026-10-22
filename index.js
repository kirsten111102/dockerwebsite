require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const helmet = require("helmet");
const path = require("path");

const publicRoutes = require("./routes/public");
const adminRoutes = require("./routes/admin");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({
    extended: false,
    limit: "20kb"
}));

app.use(session({
    name: "yukihira.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: "sessions"
    }),
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false, // Local testing over HTTP
        maxAge: 2 * 60 * 60 * 1000
    }
}));

app.use("/", publicRoutes);
app.use("/admin", adminRoutes);

app.use((req, res) => {
    res.status(404).send("Page not found.");
});

app.use((err, req, res, next) => {
    console.error(err);

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).send("Something went wrong. Please try again.");
});

async function startServer() {
    if (!process.env.MONGODB_URI || !process.env.SESSION_SECRET) {
        throw new Error("MONGODB_URI and SESSION_SECRET must be configured.");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const port = process.env.PORT || 3000;

    app.listen(port, () => {
        console.log(`Yukihira Diner running at http://localhost:${port}`);
    });
}

startServer().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
});