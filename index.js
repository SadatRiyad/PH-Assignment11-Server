const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
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

// Let's create a cookie options for both production and local server
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};
//localhost:5000 and localhost:5173 are treated as same site.  so sameSite value must be strict in development server.  in production sameSite will be none
// in development server secure will false .  in production secure will be true

// middleware
app.use(express.json());
app.use(cookieParser());
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

// logger
const logger = (req, res, next) => {
  const token = req.cookies?.token;
  console.log("value inside logger", token);
  if (!token) {
    return res.status(401).send({ error: "Unauthorized" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ error: "Unauthorized" });
    }
    console.log("value in the token", decoded);
    req.user = decoded;
    next();
  });
};

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
    app.get("/queries/id/:id", logger, async (req, res) => {
      const data = QueryHubCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      const result = await data;
      res.send(result);
    });

    // put data by id
    app.put("/queries/id/:id", logger, async (req, res) => {
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
    app.post("/queries/addQuery", logger, async (req, res) => {
      const data = req.body;
      const result = await QueryHubCollection.insertOne(data);
      res.send(result);
    });

    // Get data by email
    app.get("/queries/myQueries/:email", logger, async (req, res) => {
      // give a status if user is using others cookies
      if (req.user.email !== req.params.email) {
        return res.status(403).send({ error: "Forbidden Access" });
      }
      const data = QueryHubCollection.find({
        userEmail: req.params.email,
      }).sort({ datePosted: -1 });
      const result = await data.toArray();
      res.send(result);
    });

    // all recommendations api
    app.get("/recommendations", logger, async (req, res) => {
      const data = QueryHubCollection.find({
        recommendations: { $exists: true },
      });
      const result = await data.toArray();
      res.send(result);
    });

    // Delete a recommendation by its ID
    app.delete("/recommendations/:id", logger, async (req, res) => {
      try {
        const recommendationId = req.params.id;
        const result = await QueryHubCollection.updateOne(
          { "recommendations.id": new ObjectId(recommendationId) },
          {
            $pull: { recommendations: { id: new ObjectId(recommendationId) } },
            $inc: { recommendationCount: -1 }, // Decrement recommendation count
          }
        );
        if (result.modifiedCount === 1) {
          res
            .status(200)
            .json({ message: "Recommendation deleted successfully" });
        } else {
          res.status(404).json({ error: "Recommendation not found" });
        }
      } catch (error) {
        console.error("Error deleting recommendation:", error);
        res.status(500).json({ error: "Failed to delete recommendation" });
      }
    });

    // Get recommendations made by a specific user
    app.get(
      "/recommendations/myRecommendations/:email",
      logger,
      async (req, res) => {
        const userEmail = req.params.email;
        if (req.user.email !== req.params.email) {
          return res.status(403).send({ error: "Forbidden Access" });
        }

        try {
          const data = await QueryHubCollection.find({
            "recommendations.recommendedUserEmail": userEmail,
          }).toArray();

          // Filter out only the recommendations where the recommendedUserEmail matches the user's email
          const userRecommendations = data.reduce((acc, query) => {
            const filteredRecommendations = query.recommendations.filter(
              (recommendation) =>
                recommendation.recommendedUserEmail === userEmail
            );
            if (filteredRecommendations.length > 0) {
              acc.push({
                ...query,
                recommendations: filteredRecommendations,
              });
            }
            return acc;
          }, []);

          res.json(userRecommendations);
        } catch (error) {
          console.error("Error fetching user recommendations:", error);
          res
            .status(500)
            .json({ error: "Failed to fetch user recommendations" });
        }
      }
    );

    //  recommendatios on only my posted queries by others
    app.get(
      "/recommendations/recommendationsForMe/:email",
      logger,
      async (req, res) => {
        if (req.user.email !== req.params.email) {
          return res.status(403).send({ error: "Forbidden Access" });
        }
        try {
          const data = await QueryHubCollection.find({
            userEmail: req.params.email,
            recommendations: { $exists: true, $not: { $size: 0 } }, // Filter out empty recommendations array
          }).toArray();

          res.send(data);
        } catch (error) {
          console.error("Error fetching recommendations:", error);
          res.status(500).json({ error: "Failed to fetch recommendations" });
        }
      }
    );

    // add recommendation on queries
    app.post("/queries/:id/recommendations", logger, async (req, res) => {
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

    //creating Token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log("user for token", user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });

      res.cookie("token", token, cookieOptions).send({ success: true });
    });

    //clearing Token
    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("logging out", user);
      res
        .clearCookie("token", { ...cookieOptions, maxAge: 0 })
        .send({ success: true });
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.log);

// Listen for incoming requests
app.listen(port, () => console.log(`Server is running on port ${port}`));
