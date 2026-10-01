const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session'); // <--- 1. Import session
const Dish = require('./models/Dish');

const app = express();

// 2. Middleware & Configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 3. Configure Session Middleware
app.use(session({
    secret: 'yukihira_secret_key_change_this', // Change this to a secure random string in production
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 2 } // Session lasts for 2 hours
}));

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/yukihira_diner')
    .then(() => console.log('Connected to MongoDB successfully!'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- 4. AUTHENTICATION MIDDLEWARE ---
const isAdmin = (req, res, next) => {
    if (req.session && req.session.isAdminAuthenticated) {
        return next(); // User is logged in as admin, proceed!
    }
    res.redirect('/admin/login'); // Not logged in? Send them to the login page
};


// --- PUBLIC ROUTES ---
app.get('/', async (req, res) => {
    try {
        const dishes = await Dish.find({});
        res.render('index', { dishes });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});


// --- ADMIN AUTH ROUTES ---

// Render Login Page
app.get('/admin/login', (req, res) => {
    res.render('login', { error: null });
});

// Handle Login Submission
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;

    // Hardcoded admin credentials (in production, store hashed passwords in MongoDB)
    const ADMIN_USER = "soma";
    const ADMIN_PASS = "totsuki123";

    if (username === ADMIN_USER && password === ADMIN_PASS) {
        req.session.isAdminAuthenticated = true; // Set session flag
        return res.redirect('/admin');
    }

    res.render('login', { error: 'Invalid credentials! Try again.' });
});

// Handle Logout
app.get('/admin/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/admin/login');
    });
});


// --- PROTECTED ADMIN ROUTES (Protected by `isAdmin` middleware) ---

// Admin Dashboard
app.get('/admin', isAdmin, async (req, res) => {
    try {
        const dishes = await Dish.find({});
        res.render('admin', { dishes });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Add Dish
app.post('/admin/dishes/add', isAdmin, async (req, res) => {
    try {
        const { name, category, price, description, image } = req.body;
        await Dish.create({ name, category, price, description, image });
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.status(500).send('Failed to add dish');
    }
});

// Delete Dish
app.post('/admin/dishes/delete/:id', isAdmin, async (req, res) => {
    try {
        await Dish.findByIdAndDelete(req.params.id);
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.status(500).send('Failed to delete dish');
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Yukihira Diner server running on http://localhost:${PORT}`);
});