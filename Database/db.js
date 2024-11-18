const mysql2 = require("mysql2/promise");

const db = mysql2.createPool({
  host: "localhost",
  user: "root",
  password: "ikhwanaji123",
  database: "doker",
});

async function testConnection() {
  try {
    await db.getConnection();
    console.log("Connection Database Succses :)");
  } catch (error) {
    console.error("Database Connection Failed", error);
  }
}

async function query(command, values) {
  try {
    const [value] = await db.query(command, values ?? []);
    return value;
  } catch (error) {
    console.error(error);
  }
}

module.exports = { db, testConnection, query };
