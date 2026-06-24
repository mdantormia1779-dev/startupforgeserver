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
    origin: process.env.NEXT_PUBLIC_URL,
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


    // payment stripe 
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
          success_url: `${process.env.NEXT_PUBLIC_URL}/success`,
          cancel_url: `${process.env.NEXT_PUBLIC_URL}/cancel`,
        });

        res.json({ url: session.url }); // 🔥 IMPORTANT CHANGE
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // post payment data database 

    app.post("/payments", async (req, res) => {
      try {
        // ফ্রন্টএন্ড থেকে পাঠানো নাম অনুযায়ী ডিস্ট্রাকচারিং করুন
        const { userId, email, amount, sessionId, status } = req.body;

        const paymentEntry = {
          userId: userId, // ফ্রন্টএন্ড থেকে পাঠানো userId
          user_email: email,
          amount: amount,
          transaction_id: sessionId, // sessionId এখানে বসবে
          payment_status: status,
          paid_at: new Date(),
        };

        const result = await paymentsCollection.insertOne(paymentEntry);
        res.status(201).send({ success: true, insertedId: result.insertedId });
      } catch (err) {
        res.status(500).send({ success: false, error: err.message });
      }
    });

    // চেক করুন ইউজার প্রিমিয়াম কি না (userId দিয়ে)
    app.get("/payments/check-premium/:userId", async (req, res) => {
      const { userId } = req.params;
      // MongoDB তে transaction_id এর জায়গায় যদি আপনার ইউজার আইডি সেভ করা থাকে তবে সেটি দিন
      // অথবা যদি আপনি পেমেন্ট কালেকশনে userId সেভ করে থাকেন:
      const payment = await paymentsCollection.findOne({ userId: userId });
      res.send({ isPremium: !!payment });
    });

    // payment api front end e dekhaba
    app.get("/payments", async (req, res) => {
      try {
        // সর্বশেষ পেমেন্টগুলো আগে দেখানোর জন্য sort(-1) ব্যবহার করা হয়েছে
        const payments = await paymentsCollection
          .find()
          .sort({ paid_at: -1 })
          .toArray();
        res.send(payments);
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
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

    // startup er id onujayi dekhano

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

    // application post api 


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

    // founder er id onujayi dekhaba front end e 
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

    // email diya application dekhano 

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

    app.get("/admin/revenue-analytics", async (req, res) => {
      try {
        const revenueData = await paymentsCollection
          .aggregate([
            {
              // ১. শুধুমাত্র 'paid' স্ট্যাটাস থাকা পেমেন্টগুলো ফিল্টার করুন
              $match: {
                payment_status: "paid",
              },
            },
            {
              // ২. তারিখ থেকে মাস বের করুন
              $group: {
                _id: {
                  $dateToString: { format: "%b", date: "$paid_at" },
                },
                totalRevenue: { $sum: "$amount" },
              },
            },
            {
              // ৩. সাজান যেন মাসের ক্রমে আসে (ঐচ্ছিক)
              $sort: { _id: 1 },
            },
            {
              // ৪. চার্টের সাথে সামঞ্জস্যপূর্ণ ফরম্যাটে প্রজেক্ট করুন
              $project: {
                _id: 0,
                name: "$_id",
                revenue: "$totalRevenue",
              },
            },
          ])
          .toArray();

        // যদি ডাটা না থাকে তবে ডিফল্ট এমটি অ্যারে পাঠান
        res.send(revenueData.length > 0 ? revenueData : []);
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
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

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
run();
