require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function createAdmin() {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('Connected to DB');

        const username = 'admin@vlx.com';
        const password = 'password123';
        const role = 'admin';

        // Check if user exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            console.log('User already exists');
            existingUser.password = password; // Update password just in case
            existingUser.role = role;
            await existingUser.save();
            console.log('User updated');
        } else {
            const user = new User({ username, password, role });
            await user.save();
            console.log('User created');
        }

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

createAdmin();
