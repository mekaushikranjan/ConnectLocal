🌍 ConnectLocal
📱 Hyperlocal Social • Jobs • Marketplace Platform
<p align="center"> <img src="https://img.shields.io/badge/Platform-React%20Native-blue?style=for-the-badge&logo=react" /> <img src="https://img.shields.io/badge/Expo-SDK-black?style=for-the-badge&logo=expo" /> <img src="https://img.shields.io/badge/Firebase-Backend-orange?style=for-the-badge&logo=firebase" /> <img src="https://img.shields.io/badge/Database-Firestore-yellow?style=for-the-badge&logo=googlecloud" /> <img src="https://img.shields.io/badge/Authentication-Secure-green?style=for-the-badge&logo=google" /> </p>
🚀 Overview
ConnectLocal is a modern location-based mobile application that connects nearby people for:
💬 Real-time chatting
💼 Local job discovery
🛒 Buying, selling & renting products
The platform creates a hyperlocal digital ecosystem where users can interact, work, and trade within their local community.
✨ Key Features
📍 1. Nearby People Discovery
Location-based user search
View nearby profiles
Send connection requests
Real-time availability status
💬 2. Real-Time Chat System
One-to-one private messaging
Media sharing (images & documents)
Chat history storage
Secure user-based conversations
💼 3. Job Marketplace
Post local job opportunities
Apply for jobs
Upload resumes/documents
Detailed job view:
🏷 Title
📝 Description
💰 Salary
📍 Location
📎 Attachments
🛒 4. Local Marketplace
Post items for sale or rent
Upload product images
Category-based browsing
Product detail page:
🏷 Title
📄 Description
💵 Price
👤 Seller Info
📎 Documents
👤 5. Profile Management
Edit personal information
View posted jobs/products
Activity history
Profile image upload
🔐 6. Authentication & Security
Firebase Authentication
Google / Social Login
Role-based access control
Secure Firestore rules
Encrypted sessions
🏗️ Tech Stack
📱 Frontend
React Native
Expo
Context API / State Management
Modern Glassmorphism UI
🔥 Backend & Services
Firebase Authentication
Firestore Database
Firebase Storage
Real-time database for chat
📂 Project Structure
ConnectLocal/
│── assets/              # Images & static assets
│── src/
│   ├── components/      # Reusable UI components
│   ├── screens/         # Application screens
│   ├── navigation/      # Navigation setup
│   ├── services/        # Firebase services
│   ├── context/         # Global state
│   └── utils/           # Helper functions
│
│── App.js               # Entry point
│── package.json         # Dependencies
│── app.json             # Expo configuration
│── .env.example         # Environment variables template
⚙️ Installation & Setup
1️⃣ Clone the Repository
git clone https://github.com/mekaushikranjan/ConnectLocal.git
cd ConnectLocal
2️⃣ Install Dependencies
npm install
3️⃣ Configure Environment Variables
Create a .env file:
FIREBASE_API_KEY=your_key
FIREBASE_AUTH_DOMAIN=your_domain
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_bucket
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
4️⃣ Run the Application
npx expo start
Scan the QR code using Expo Go.
📊 Application Modules
Module	Description
🔐 Authentication	Login / Signup / Social Login
👥 Nearby Users	Location-based user discovery
💬 Chat	Real-time private messaging
💼 Jobs	Post & apply for local jobs
🛒 Marketplace	Buy, sell & rent products
👤 Profile	User account management
🎯 Project Objective
To build a community-driven local platform that:
Encourages local networking
Simplifies job discovery
Enables small-scale commerce
Strengthens digital community engagement
🚀 Future Enhancements
🤖 AI-based job recommendations
📍 Advanced distance filtering
📲 Push notifications
⭐ Rating & review system
📞 In-app audio/video calling
📊 Admin analytics dashboard
📸 Screenshots (Add Here)
/screenshots/home.png
/screenshots/chat.png
/screenshots/jobs.png
/screenshots/marketplace.png
👨‍💻 Author
Kaushik Ranjan
🔗 GitHub: https://github.com/mekaushikranjan
