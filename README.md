# VLW-ESTIMATOR

VLW-ESTIMATOR is a web app designed for users to efficiently quote windows for their construction projects. It enables users to calculate the total selling price for all window systems they wish to purchase, taking into account various factors such as measurements, accessories, color, and type of glass.

## Overview

The application utilizes a MERN stack architecture, leveraging technologies such as Node.js, Express, and MongoDB for the backend, and HTML, Tailwind CSS for the frontend. The project is structured to separate concerns, with routes handling specific areas of the application functionality, models for database interactions, and views for the front-end interface.

## Features

- **User Authentication**: Users can register and login using their email and password.
- **Quotation Creation**: Users can create quotes containing multiple windows with detailed specifications.
- **Administrative Functions**: Admin users can add, modify, or delete window components like profiles, accessories, and glasses.
- **PDF Export**: Users can export their quotations to PDF for easy sharing and record-keeping.

## Getting Started

### Requirements

- Node.js
- MongoDB
- A modern web browser

### Quickstart

1. Clone the repository.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and fill in your database and session secret details.
4. Start the server using `npm start`.
5. Access the web application at `http://localhost:3000`.

### License

Copyright (c) 2024.