# ConnectLocal

<p align="center">
  <img src="https://img.shields.io/badge/Platform-React%20Native-blue?style=for-the-badge&logo=react" alt="React Native badge"/>
  <img src="https://img.shields.io/badge/Expo-SDK-black?style=for-the-badge&logo=expo" alt="Expo badge"/>
</p>

## Overview

ConnectLocal is a hyperlocal mobile application that helps people discover nearby users, find local jobs, and buy/sell/rent items within their community. It provides real-time chat, profile management, a jobs marketplace, and a local marketplace.

## Key Features

- Nearby people discovery (location-based)
- Real-time one-to-one chat with media sharing
- Local job posting and application workflow
- Marketplace for buying, selling, and renting items
- Profile management and activity history
- Firebase-based authentication and storage

## Tech Stack

- Frontend: React Native + Expo
- State: Context API (or your preferred state library)
- Backend & Services: Firebase Authentication, Firestore, Firebase Storage, Realtime Database (for chat)

## Table of Contents

- [Installation](#installation)
- [Quickstart](#quickstart)
- [Configuration](#configuration)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)
- [Author](#author)

## Installation

1. Clone the repository

   git clone https://github.com/mekaushikranjan/ConnectLocal.git
   cd ConnectLocal

2. Install dependencies

   npm install

## Quickstart

1. Create a copy of the environment template:

   cp .env.example .env

2. Fill in your Firebase credentials in the `.env` file (see Configuration below).
3. Start Expo:

   npx expo start

4. Open the app with Expo Go or an emulator and scan the QR code.

## Configuration

Create a `.env` file at the project root and set the following variables (example in `.env.example`):

- FIREBASE_API_KEY
- FIREBASE_AUTH_DOMAIN
- FIREBASE_PROJECT_ID
- FIREBASE_STORAGE_BUCKET
- FIREBASE_MESSAGING_SENDER_ID
- FIREBASE_APP_ID

Ensure your Firebase project has Firestore, Authentication, and Storage enabled. Update Firebase security rules for your desired access controls.

## Usage

- Authentication: Email/password and social logins (Google) via Firebase.
- Nearby users: Uses device location to show nearby profiles. Ensure location permission is granted.
- Chat: Real-time chat backed by Firebase Realtime Database / Firestore.
- Jobs & Marketplace: Post, edit, and browse job listings and product listings.

## Project Structure

ConnectLocal/
├── assets/              # Images & static assets
├── src/
│   ├── components/      # Reusable UI components
│   ├── screens/         # Application screens
│   ├── navigation/      # Navigation setup
│   ├���─ services/        # Firebase services & APIs
│   ├── context/         # Global state providers
│   └── utils/           # Helper functions
├── App.js               # Entry point
├── package.json         # Dependencies & scripts
├── app.json             # Expo configuration
└── .env.example         # Environment variables template

## Development

- Run the app: `npx expo start`
- Linting: add/adjust ESLint configuration as needed
- Testing: add unit/integration tests and a test runner (Jest recommended)

## Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository.
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes with clear messages.
4. Push to your fork and open a pull request.

Please include a descriptive PR title and summary of changes. Add screenshots or steps to reproduce when applicable.

## Screenshots

Place screenshots under `/screenshots` and reference them here. Example:

- `/screenshots/home.png`
- `/screenshots/chat.png`
- `/screenshots/jobs.png`
- `/screenshots/marketplace.png`

## License

This project is currently unlicensed. If you want to add a license, create a `LICENSE` file (e.g., MIT).

## Author

Kaushik Ranjan — https://github.com/mekaushikranjan
