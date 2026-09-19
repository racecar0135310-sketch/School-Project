import 'dotenv/config';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("❌ MONGODB_URI is not defined in your .env file!");
  process.exit(1);
}

const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 5000,
});

async function run() {
  try {
    console.log("⏳ Connecting to MongoDB...");
    await client.connect();
    console.log("✅ Successfully connected to MongoDB Atlas!");

    await client.db("admin").command({ ping: 1 });
    console.log("✅ Ping succeeded. Database is reachable!");

  } catch (error) {
    console.error("\n❌ Connection failed!");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
  } finally {
    await client.close();
    console.log("🔌 Connection closed.");
  }
}

run();