const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000",
  }),
);

// MongoDB URI
const uri = process.env.DB_URL;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const db = client.db("startupforge");
    const usersCollection = db.collection("user");
    const startupsCollection = db.collection("startups");
    const opportunitiesCollection = db.collection("opportunities");
    const applicationsCollection = db.collection("applications");

    // ========================
    // TEST ROUTE
    // ========================
    app.get("/", (req, res) => {
      res.send("server is running...");
    });

    // ========================
    // USERS API
    // ========================
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // ========================
    // CREATE STARTUP
    // ========================
    app.post("/startups", async (req, res) => {
      try {
        const data = req.body;

        const newStartup = {
          ...data,
          ownerId: data.ownerId, // 👈 important
          createdAt: new Date(),
        };

        const result = await startupsCollection.insertOne(newStartup);

        res.send({
          success: true,
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // ========================
    // GET STARTUPS
    // ========================
    app.get("/startups", async (req, res) => {
      const result = await startupsCollection.find().toArray();
      res.send(result);
    });

    // single startups
    app.get("/startups/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const result = await startupsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!result) {
          return res.status(404).send({ message: "Startup not found" });
        }

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error", error });
      }
    });

    // ========================
    // UPDATE STARTUP (FIXED)
    // ========================
    app.put("/startups/:id", async (req, res) => {
      try {
        const id = req.params.id;

        // ❌ remove _id from body
        const { _id, ...updatedData } = req.body;

        const result = await startupsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData },
        );

        res.send({
          success: true,
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error("PUT ERROR:", error);
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // ========================
    // DELETE STARTUP
    // ========================
    app.delete("/startups/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const result = await startupsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send({
          success: true,
          deletedCount: result.deletedCount,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          error: error.message,
        });
      }
    });

    // ========================
    // ADD OPPORTUNITY (POST API)
    // ========================
    app.post("/opportunities", async (req, res) => {
      try {
        const data = req.body;

        // ভ্যালিডেশন (ঐচ্ছিক কিন্তু জরুরি)
        if (!data.roleTitle || !data.description) {
          return res.status(400).send({
            success: false,
            message: "Role Title and Description are required!",
          });
        }

        const newOpportunity = {
          ...data,
          createdAt: new Date(), // পোস্ট করার সময় সেভ হবে
        };

        // একটি নতুন কালেকশন 'opportunities' এ ডাটা সেভ করা হচ্ছে
        const result = await opportunitiesCollection.insertOne(newOpportunity);

        res.send({
          success: true,
          insertedId: result.insertedId,
          message: "Opportunity added successfully!",
        });
      } catch (error) {
        console.error("POST OPPORTUNITY ERROR:", error);
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // GET /opportunities?ownerId=...
    app.get("/opportunities", async (req, res) => {
      const { ownerId } = req.query;
      const query = ownerId ? { ownerId } : {};
      const result = await opportunitiesCollection.find(query).toArray();
      res.send(result);
    });

    // GET SINGLE OPPORTUNITY BY ID
    app.get("/opportunities/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const result = await opportunitiesCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!result) {
          return res.status(404).send({
            success: false,
            message: "Opportunity not found",
          });
        }

        res.send(result);
      } catch (error) {
        console.error("GET SINGLE OPPORTUNITY ERROR:", error);
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // UPDATE OPPORTUNITY ✅ (IMPORTANT FIX)
    // ========================
    app.put("/opportunities/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { _id, ...updatedData } = req.body;

        const result = await opportunitiesCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              ...updatedData,
              updatedAt: new Date(),
            },
          },
        );

        res.send({
          success: true,
          modifiedCount: result.modifiedCount,
        });
      } catch (err) {
        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    // DELETE OPPORTUNITY
    // ========================
    app.delete("/opportunities/:id", async (req, res) => {
      try {
        const result = await opportunitiesCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });

        res.send({
          success: true,
          deletedCount: result.deletedCount,
        });
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    app.get("/startups/by-owner/:ownerId", async (req, res) => {
      try {
        const { ownerId } = req.params;

        const startups = await startupsCollection.find({ ownerId }).toArray();

        const opportunities = await opportunitiesCollection
          .find({ ownerId })
          .toArray();

        res.send({
          success: true,
          startups,
          opportunities,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    app.post("/applications", async (req, res) => {
      const data = req.body;

      const exists = await applicationsCollection.findOne({
        opportunityId: data.opportunityId,
        applicantEmail: data.applicantEmail,
      });

      if (exists) {
        return res.send({
          success: false,
          message: "Already applied",
        });
      }

      const newApp = {
        ...data,
        status: "Pending",
        appliedAt: new Date(),
      };

      await applicationsCollection.insertOne(newApp);

      res.send({ success: true });
    });

    app.get("/applications/by-founder/:founderId", async (req, res) => {
      const { founderId } = req.params;

      const result = await applicationsCollection.find({ founderId }).toArray();

      res.send(result);
    });

    app.get("/applications/check", async (req, res) => {
      const { jobId, email } = req.query;

      const exists = await applicationsCollection.findOne({
        opportunityId: jobId,
        applicantEmail: email,
      });

      res.send({
        applied: !!exists,
      });
    });

    app.get("/applications/by-user/:email", async (req, res) => {
      const { email } = req.params;

      const apps = await applicationsCollection
        .find({ applicantEmail: email })
        .toArray();

      const result = await Promise.all(
        apps.map(async (app) => {
          const job = await opportunitiesCollection.findOne({
            _id: new ObjectId(app.opportunityId),
          });

          return {
            ...app,
            job, // 👈 full job details attach
          };
        }),
      );

      res.send(result);
    });

    
  } catch (error) {
    console.log("MONGO ERROR:", error);
  }
}

run();

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
