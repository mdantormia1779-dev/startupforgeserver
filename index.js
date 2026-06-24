const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const cors = require("cors");
require("dotenv").config();
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
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
    const paymentsCollection = db.collection("payments");

    app.post("/create-checkout-session", async (req, res) => {
      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "payment",
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: "Premium Plan",
                },
                unit_amount: req.body.amount * 100,
              },
              quantity: 1,
            },
          ],
          success_url: "http://localhost:3000/success",
          cancel_url: "http://localhost:3000/cancel",
        });

        res.json({ url: session.url }); // 🔥 IMPORTANT CHANGE
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ২. পেমেন্ট সেভ করা (আপনার ডাটাবেসে)
    app.post("/payments", async (req, res) => {
      const paymentData = req.body;
      const result = await paymentsCollection.insertOne({
        ...paymentData,
        paid_at: new Date(),
      });
      res.send({ success: true, insertedId: result.insertedId });
    });

    // ৩. এডমিন স্ট্যাটাস (পেমেন্টসহ)
    app.get("/admin/stats", async (req, res) => {
      const usersCount = await usersCollection.countDocuments();
      const startupsCount = await startupsCollection.countDocuments();
      const oppsCount = await opportunitiesCollection.countDocuments();

      // পেমেন্ট ক্যালকুলেশন
      const payments = await paymentsCollection.find().toArray();
      const revenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

      res.send({
        users: usersCount,
        startups: startupsCount,
        opportunities: oppsCount,
        revenue,
      });
    });

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

    app.get("/applications/by-founder/:ownerId", async (req, res) => {
      const { ownerId } = req.params;

      const result = await applicationsCollection
        .aggregate([
          {
            $addFields: {
              opportunityObjId: { $toObjectId: "$opportunityId" },
            },
          },
          {
            $lookup: {
              from: "opportunities",
              localField: "opportunityObjId",
              foreignField: "_id",
              as: "job",
            },
          },
          { $unwind: "$job" },

          // ✅ MAIN FILTER
          {
            $match: {
              "job.ownerId": ownerId,
            },
          },

          {
            $project: {
              _id: 1,
              applicantName: 1,
              applicantEmail: 1,
              portfolio: 1,
              motivation: 1,
              status: 1,
              appliedAt: 1,
              jobTitle: "$job.roleTitle",
            },
          },
        ])
        .toArray();

      res.send(result);
    });

    app.patch("/applications/:id", async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      const result = await applicationsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } },
      );

      res.send({ success: true, result });
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

    // ========================
    // ADMIN OVERVIEW API
    // ========================

    // // ১. স্ট্যাটাস কার্ডের ডেটা (Total Users, Startups, Opportunities, Revenue)
    // app.get("/admin/stats", async (req, res) => {
    //   try {
    //     const usersCount = await usersCollection.countDocuments();
    //     const startupsCount = await startupsCollection.countDocuments();
    //     const oppsCount = await opportunitiesCollection.countDocuments();

    //     // সব অ্যাপ্লিকেশনের স্ট্যাটাস থেকে রেভিনিউ হিসাব করা (যদি আপনার মডেলে কোনো পেমেন্ট ফিল্ড থাকে)
    //     // আপাতত একটি সিম্পল ক্যালকুলেশন দিচ্ছি
    //     const revenue = 12500; // আপনার লজিক অনুযায়ী এটি পরিবর্তন করুন

    //     res.send({
    //       users: usersCount,
    //       startups: startupsCount,
    //       opportunities: oppsCount,
    //       revenue: revenue,
    //     });
    //   } catch (error) {
    //     res.status(500).send({ message: "Error fetching stats", error });
    //   }
    // });

    // ২. চার্টের জন্য রেভিনিউ ডেটা
    app.get("/admin/revenue-analytics", async (req, res) => {
      // এটি স্ট্যাটিক ডেটা, প্রয়োজনে MongoDB অ্যাগ্রিগেশন দিয়ে ডাইনামিক করতে পারেন
      const revenueData = [
        { name: "Jan", revenue: 4000 },
        { name: "Feb", revenue: 3000 },
        { name: "Mar", revenue: 5000 },
        { name: "Apr", revenue: 4500 },
        { name: "May", revenue: 6000 },
        { name: "Jun", revenue: 5500 },
      ];
      res.send(revenueData);
    });

    // 1. ইউজার স্ট্যাটাস আপডেট (Block/Unblock)
    app.patch("/users/:id", async (req, res) => {
      const { isBlocked } = req.body;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { isBlocked } },
      );
      res.send({ success: true, result });
    });

    // 2. ইউজার ডিলিট
    app.delete("/users/:id", async (req, res) => {
      const result = await usersCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
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
