// server.js
require('dotenv').config(); // Load environment variables

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const app = express();
const PORT = process.env.PORT || 3306; // Use PORT from .env or default to 5000


// Middleware
app.use(cors({origin:'http://localhost:5173'}));
app.use(bodyParser.json());

// Update this line to require your new database file
require('./Database.db'); // Changed from './config/db' to './Database.db'

// Routes
app.use('/api', authRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});