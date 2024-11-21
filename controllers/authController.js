// controllers/authController.js
const db = require('../config/db');

exports.registerUser  = (req, res) => {
  const { fullName, username, email, tel, password } = req.body;

  // Basic validation
  if (!fullName || !username || !email || !tel || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // Insert user into database
  const query = 'INSERT INTO users (fullName, username, email, tel, password) VALUES (?, ?, ?, ?, ?)';
  db.query(query, [fullName, username, email, tel, password], (error, results) => {
    if (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Username or email already exists' });
      }
      return res.status(500).json({ message: 'Database error', error });
    }
    res.status(201).json({ message: 'User  registered successfully', userId: results.insertId });
  });
};