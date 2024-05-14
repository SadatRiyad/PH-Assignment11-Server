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
  // QueryHubCollection
  const QueryHubCollection = client.db("BB-QueryHubDB").collection("Queries");

  try {
    // Get all the data from the collection
    app.get("/queries", async (req, res) => {
      const data = QueryHubCollection.find().sort({ datePosted: -1 });
      const result = await data.toArray();
      res.send(result);
    });

    // get data by id
    app.get("/queries/id/:id", async (req, res) => {
      const data = QueryHubCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      const result = await data;
      res.send(result);
    });

    // put data by id
    app.put("/queries/id/:id", async (req, res) => {
      const data = req.body;
      const result = await QueryHubCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: data },
        { upsert: true }
      );
      res.send(result);
    });

    // delete data by id
    app.delete("/queries/id/:id", async (req, res) => {
      const data = QueryHubCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      const result = await data;
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

    // Get data by email
    app.get("/queries/myQueries/:email", async (req, res) => {
      const data = QueryHubCollection.find({
        userEmail: req.params.email,
      }).sort({ datePosted: -1 });
      const result = await data.toArray();
      res.send(result);
    });

    // add recommendation on queries
    app.post("/queries/:id/recommendations", async (req, res) => {
      const { id } = req.params;
      const {
        recommendationTitle,
        recommendedProductName,
        recommendedProductImageURL,
        recommendationReason,
        recommendedUserEmail,
        recommendedUserName,
        recommendedUserImageUrl,
        timestamp,
      } = req.body;

      const recommendation = {
        id: new ObjectId(),
        recommendationTitle,
        recommendedProductName,
        recommendedProductImageURL,
        recommendationReason,
        recommendedUserEmail,
        recommendedUserName,
        recommendedUserImageUrl,
        timestamp,
      };

      // Update the query document with a new recommendation
      const result = await QueryHubCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $push: { recommendations: recommendation },
          $inc: { recommendationCount: 1 },
        }
      );

      if (result.modifiedCount === 1) {
        res.status(200).json({ message: "Recommendation added successfully" });
      } else {
        res.status(500).json({ error: "Failed to add recommendation" });
      }
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.log);

// Listen for incoming requests
app.listen(port, () => console.log(`Server is running on port ${port}`));
