StartupForge Backend API
এটি StartupForge প্ল্যাটফর্মের ব্যাকএন্ড সার্ভার। এই সার্ভারটি স্টার্টআপ ম্যানেজমেন্ট, অপরচুনিটি পোস্টিং, অ্যাপ্লিকেশন ট্র্যাকিং এবং স্ট্রাইপ পেমেন্ট ইন্টিগ্রেশন হ্যান্ডেল করে।

🛠 প্রযুক্তি (Tech Stack)
Node.js & Express.js

MongoDB (Database)

Stripe API (Payments)

Cors & Dotenv

🚀 মূল ফিচারসমূহ (Key Features)
Authentication: ইউজার প্রোফাইল ও অথেন্টিকেশন সাপোর্ট।

Startup Management: নতুন স্টার্টআপ তৈরি, আপডেট এবং ডিলিট করার সুবিধা।

Opportunities: চাকরির বা প্রজেক্টের সুযোগ পোস্ট করা এবং ম্যানেজ করা।

Applications: আবেদনকারীদের অ্যাপ্লিকেশন ট্র্যাক করা এবং স্ট্যাটাস (Pending/Accepted/Rejected) পরিবর্তন করা।

Payments: স্ট্রাইপ ইন্টিগ্রেশনের মাধ্যমে প্রিমিয়াম সাবস্ক্রিপশন এবং পেমেন্ট ট্র্যাকিং।

Analytics: এডমিন প্যানেলের জন্য স্ট্যাটিস্টিকস এবং রেভিনিউ অ্যানালিটিক্স।

⚙️ ইনস্টলেশন (How to Run)
১. প্রজেক্টটি ক্লোন করুন:

Bash
git clone <your-repository-url>
cd <your-folder-name>
২. ডিপেন্ডেন্সি ইন্সটল করুন:

Bash
npm install
৩. .env ফাইল তৈরি করুন এবং নিচের ভেরিয়েবলগুলো সেট করুন:

Code snippet
PORT=5000
DB_URL=your_mongodb_connection_string
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_URL=your_frontend_url
৪. সার্ভার রান করুন:

Bash
node index.js
# অথবা nodemon ব্যবহার করলে
npm start
🔗 API এন্ডপয়েন্টসমূহ (Endpoints)
Startups
POST /startups - নতুন স্টার্টআপ তৈরি।

GET /startups - সব স্টার্টআপ দেখা।

GET /startups/:id - একটি নির্দিষ্ট স্টার্টআপের তথ্য।

PUT /startups/:id - স্টার্টআপ আপডেট।

Opportunities
POST /opportunities - নতুন সুযোগ পোস্ট করা।

GET /opportunities - সব সুযোগ দেখা।

PUT /opportunities/:id - সুযোগ আপডেট।

Applications
POST /applications - নতুন আবেদন করা।

GET /applications/by-founder/:ownerId - ফাউণ্ডারের জন্য তার স্টার্টআপের সব আবেদন দেখা।

PATCH /applications/:id - আবেদনের স্ট্যাটাস পরিবর্তন।

Payments
POST /create-checkout-session - পেমেন্ট সেশনের জন্য স্ট্রাইপ চেকআউট।

GET /admin/revenue-analytics - রেভিনিউ রিপোর্ট দেখা।
