import { connectToDb, getEmployeeById, updateEmployeeAttendance } from '../core/db.js';
import { initSidebar } from '../components/sidebar.js';

const SERVER_URL = 'http://localhost:3001'; 
let db;
let currentUser;
let timerInterval;
let ws ; 
let pingStartTime;
let heartbeatInterval;
let healthMonitorInterval;


document.addEventListener('DOMContentLoaded', async () => {
    try {
        initSidebar();
        db = await connectToDb(2);
        const userId = sessionStorage.getItem('userId');
        if (!userId) {
            window.location.href = 'index.html';
            return;
        }

        // 2. Load User State
        currentUser = await getEmployeeById(db, userId);
        
        // Check if user exists
        if (!currentUser) {
            sessionStorage.clear();
            window.location.href = 'index.html';
            return;
        }

        // Initialize attendance if missing
        if (!currentUser.attendance) {
            currentUser.attendance = { status: 'inactive', logs: [] };
        }

        // 3. Setup UI
        restoreTimerState();
        renderHistoryTable();
        setupEventListeners();

        // 4. Connect to Real-Time Feed (SSE)
        initSSE();
        initHeartbeat();
        initHealthMonitor();
    } catch (error) {
        console.error('Failed to initialize attendance:', error);
        alert('Failed to load attendance system');
    }
});

// --- UI & Timer Logic ---

function setupEventListeners() {
    document.getElementById('btn-clock-in').addEventListener('click', handleClockIn);
    document.getElementById('btn-clock-out').addEventListener('click', handleClockOut);
}

async function handleClockIn() {
    try {
        const now = Date.now();
        const newLog = { start: now, end: null };
        const updatedAttendance = { 
            status: 'active',
            logs: [...(currentUser.attendance?.logs || []), newLog], 
        };
        
        const currentUserRole = sessionStorage.getItem('role') || currentUser.role;
        
        // Update currentUser with the returned updated data
        currentUser = await updateEmployeeAttendance(db, currentUserRole, currentUser.id, updatedAttendance);

        startVisualTimer(now);
        toggleButtons('active');
        renderHistoryTable();

        broadcastEvent("Checked In", "in");
    } catch (error) {
        console.error('Clock in failed:', error);
        alert('Failed to clock in: ' + error.message);
    }
}
async function handleClockOut() {
    try {
        const now = Date.now();
        const logs = [...(currentUser.attendance?.logs || [])]; // Create copy
        const lastLog = logs[logs.length - 1];
        
        if (lastLog && !lastLog.end) {
            lastLog.end = now;
        }
        
        const updatedAttendance = { 
            status: 'inactive',
            logs: logs
        };

        const currentUserRole = sessionStorage.getItem('role');
        
        // Update currentUser with the returned updated data
        currentUser = await updateEmployeeAttendance(db, currentUserRole, currentUser.id, updatedAttendance);

        stopVisualTimer();
        toggleButtons('inactive');
        renderHistoryTable();

        broadcastEvent("Checked Out", "out");
    } catch (error) {
        console.error('Clock out failed:', error);
        alert('Failed to clock out: ' + error.message);
    }
}

function restoreTimerState() {
    if (currentUser.attendance?.status === 'active') {
        const logs = currentUser.attendance.logs;
        const lastLog = logs[logs.length - 1];
        if (lastLog && !lastLog.end) {
            startVisualTimer(lastLog.start);
            toggleButtons('active');
            document.getElementById('start-time-display').innerText = new Date(lastLog.start).toLocaleTimeString();
        }
    } else {
        toggleButtons('inactive');
    }
}

function startVisualTimer(startTime) {
    if (timerInterval) clearInterval(timerInterval);
    const display = document.getElementById('main-timer');
    timerInterval = setInterval(() => {
        const now = Date.now();
        const diff = Math.floor((now - startTime) / 1000);
        const h = Math.floor(diff / 3600).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        display.innerText = `${h}:${m}:${s}`;
    }, 1000);
}

function stopVisualTimer() {
    clearInterval(timerInterval);
    document.getElementById('main-timer').innerText = "00:00:00";
    document.getElementById('start-time-display').innerText = "--:--";
}

function toggleButtons(state) {
    const btnIn = document.getElementById('btn-clock-in');
    const btnOut = document.getElementById('btn-clock-out');
    if (state === 'active') {
        btnIn.classList.add('hidden');
        btnOut.classList.remove('hidden');
    } else {
        btnIn.classList.remove('hidden');
        btnOut.classList.add('hidden');
    }
}

// --- Attendance History Table ---

function renderHistoryTable() {
    const tbody = document.getElementById('my-logs-list');
    tbody.innerHTML = '';
    
    const logs = [...(currentUser.attendance.logs || [])].reverse().slice(0, 10);
    
    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #64748b;">No attendance records yet</td></tr>';
        return;
    }
    
    logs.forEach(log => {
        const row = document.createElement('tr');
        const start = new Date(log.start);
        const end = log.end ? new Date(log.end) : null;
        
        let durationStr = "Active";
        if (end) {
            const diffMins = Math.floor((end - start) / 60000);
            const hrs = Math.floor(diffMins / 60);
            const mins = diffMins % 60;
            durationStr = `${hrs}h ${mins}m`;
        }
        
        row.innerHTML = `
            <td>${start.toLocaleDateString()}</td>
            <td>${start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
            <td>${end ? end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '---'}</td>
            <td><strong>${durationStr}</strong></td>
        `;
        tbody.appendChild(row);
    });
}

// --- Server Communication (SSE & POST) ---

async function broadcastEvent(action, type) {
    try {
        // Use the identity structure from your schema
        const firstName = currentUser.identity?.firstName || 'Unknown';
        const lastName = currentUser.identity?.lastName || 'User';
        const name = `${firstName} ${lastName}`;
        const message = `${name} ${action}`;
        
        await fetch(`${SERVER_URL}/broadcast-attendance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, type })
        });
    } catch (error) {
        console.warn(" Offline Mode: Cannot broadcast to server.");
    }
}

function initSSE() {
    const feedContainer = document.getElementById('sse-feed-list');
    const statusDot = document.querySelector('#network-status .status-dot');
    const statusText = document.querySelector('#network-status .status-text');
    
    try {
        const evtSource = new EventSource(`${SERVER_URL}/events`);

        evtSource.onopen = () => {
            console.log("SSE Connected");
            statusDot.style.background = "#22c55e";
            statusText.innerText = "Live";
        };

        evtSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            const placeholder = document.querySelector('.feed-placeholder');
            if (placeholder) placeholder.remove();
            
            const item = document.createElement('div');
            item.className = `feed-item ${data.type}`;
            item.innerHTML = `
                <span class="feed-dot"></span>
                <div class="feed-content">
                    <span class="feed-msg">${data.message}</span>
                    <span class="feed-time">${data.timestamp}</span>
                </div>
            `;
            feedContainer.prepend(item);
            
            // Limit to 20 items
            if (feedContainer.children.length > 20) {
                feedContainer.lastElementChild.remove();
            }
        };

        evtSource.onerror = (error) => {
            console.error("SSE Error:", error);
            statusDot.style.background = "#ef4444";
            statusText.innerText = "Reconnecting...";
        };
        
    } catch (error) {
        console.error("Failed to initialize SSE:", error);
        statusDot.style.background = "#ef4444";
        statusText.innerText = "Offline";
    }
};

function initHeartbeat() {
    const statusDot = document.querySelector('#network-status .status-dot');
    const wsLatencyElement = document.getElementById('ws-latency');
    
    try {
        // Connect to WebSocket on the same port as your server
        ws = new WebSocket(`ws://localhost:3001`);
        
        ws.onopen = () => {
            console.log(" WebSocket Connected");
            statusDot.style.background = "#22c55e"; // Green
            
            // Start heartbeat loop - every 30 seconds
            heartbeatInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    pingStartTime = performance.now();
                    ws.send("PING");
                }
            }, 30000);
        };
        
        ws.onmessage = (event) => {
            if (event.data === "PONG") {
                const latency = Math.round(performance.now() - pingStartTime);
                wsLatencyElement.textContent = `${latency} ms`;
                console.log(` WebSocket Latency: ${latency}ms`);
            }
        };
        
        ws.onclose = () => {
            console.log(" WebSocket Disconnected");
            statusDot.style.background = "#ef4444"; // Red
            wsLatencyElement.textContent = "OFF";
            
            // Clear heartbeat interval
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
            }
        };
        
        ws.onerror = (error) => {
            console.error(" WebSocket Error:", error);
            statusDot.style.background = "#ef4444"; // Red
            wsLatencyElement.textContent = "OFF";
        };
        
    } catch (error) {
        console.error("Failed to initialize WebSocket:", error);
        statusDot.style.background = "#ef4444";
        wsLatencyElement.textContent = "OFF";
    }
}



function initHealthMonitor() {
    const serverUptimeElement = document.getElementById('server-uptime');
    const serverMemoryElement = document.getElementById('server-memory');
    
    // Start health monitoring loop - every 5 seconds
    healthMonitorInterval = setInterval(async () => {
        try {
            // Create AbortController for 2-second timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            
            const response = await fetch(`${SERVER_URL}/health`, {
                signal: controller.signal,
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                
                // Format uptime as HHh MMm
                const hours = Math.floor(data.uptime / 3600);
                const minutes = Math.floor((data.uptime % 3600) / 60);
                const uptimeFormatted = `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`;
                
                // Format memory as XX MB
                const memoryFormatted = `${data.memory} MB`;
                
                // Update DOM elements
                serverUptimeElement.textContent = uptimeFormatted;
                serverMemoryElement.textContent = memoryFormatted;
                
                console.log(` Health Check: Uptime ${uptimeFormatted}, Memory ${memoryFormatted}`);
            }
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn(" Health check timeout (>2s)");
            } else {
                console.warn(" Health check failed:", error.message);
            }
            
            // Set error states
            serverUptimeElement.textContent = "ERROR";
            serverMemoryElement.textContent = "ERROR";
        }
    }, 5000);
}

// cleanup
function cleanupDiagnostics(){
    if(heartbeatInterval){
        clearInterval(heartbeatInterval);
    }
    if(healthMonitorInterval){
        clearInterval(healthMonitorInterval);
    }
    if(ws && ws.readyState === WebSocket.OPEN){
        ws.close();
    }
} ; 

document.addEventListener('beforeunload',cleanupDiagnostics);