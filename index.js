const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.efrqq6z.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// middleware
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://ph-assignment11-sadatriyad.surge.sh",
      "https://ph-assignment11-sadatriyad.netlify.app",
    ],
    credentials: true,
  })
);



// Routes
app.get("/", (req, res) => {
  res.send("BB-QueryHub server is running");
});

async function run() {
  const QueryHubCollection = client.db("BB-QueryHubDB").collection("Queries");
  try {
    // Get all the data from the collection
    app.get("/queries", async (req, res) => {
      const data = QueryHubCollection.find();
      const result = await data.toArray();
      res.send(result);
    });

    // Get recent 6 data from the collection
    app.get("/queries/recent", async (req, res) => {
      const data = QueryHubCollection.find().sort({ _id: -1 }).limit(6);
      const result = await data.toArray();
      res.send(result);
    });

    // Add data to the collection
    app.post("/queries/addQuery", async (req, res) => {
      const data = req.body;
      const result = await QueryHubCollection.insertOne(data);
      res.send(result);
    });

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.log);

// Listen for incoming requests
app.listen(port, () => console.log(`Server is running on port ${port}`));