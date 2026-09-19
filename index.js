import dns from 'node:dns';
dns.setServers(['8.8.8.8', '8.8.4.4']); // Google's Public DNS
import 'dotenv/config'; // This automatically loads your .env file
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    console.log("✅ Successfully connected to MongoDB Atlas!");
    
    // Test a simple ping
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Pinged your deployment. You are connected!");
    
  } catch (error) {
    console.error("❌ Connection failed:", error);
    console.log("\n💡 TIP: If you see 'querySrv ECONNREFUSED', you need to change your Windows DNS to 8.8.8.8");
  } finally {
    await client.close();
  }
}

run();