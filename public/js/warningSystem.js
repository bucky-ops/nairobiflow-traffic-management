class WarningSystem {
    constructor() {
        this.alerts = [];
        this.alertLevels = {
            CRITICAL: { priority: 1, color: '#dc2626', sound: 'critical', icon: '🚨' },
            HIGH: { priority: 2, color: '#ef4444', sound: 'high', icon: '⚠️' },
            MEDIUM: { priority: 3, color: '#f59e0b', sound: 'medium', icon: '⚡' },
            LOW: { priority: 4, color: '#10b981', sound: 'low', icon: 'ℹ️' },
            INFO: { priority: 5, color: '#3b82f6', sound: 'info', icon: '📢' }
        };
        this.warningThresholds = {
            severeCongestion: 80,
            highIncidentCount: 5,
            unusualSpeedDrop: 50,
            gridlockRisk: 90
        };
        this.audioContext = null;
        this.init();
    }

    init() {
        this.setupAudioContext();
        this.createWarningPanel();
        this.startMonitoring();
    }

    setupAudioContext() {
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        } catch (error) {
            console.log('Audio context not supported');
        }
    }

    createWarningPanel() {
        const warningHTML = `
            <div class="control-section">
                <h3>🚨 Traffic Warnings</h3>
                <div class="warning-dashboard">
                    <div class="alert-status">
                        <div class="status-indicator critical" id="critical-indicator">
                            <span class="status-icon">🚨</span>
                            <span class="status-text">Critical</span>
                            <span class="status-count" id="critical-count">0</span>
                        </div>
                        <div class="status-indicator high" id="high-indicator">
                            <span class="status-icon">⚠️</span>
                            <span class="status-text">High</span>
                            <span class="status-count" id="high-count">0</span>
                        </div>
                        <div class="status-indicator medium" id="medium-indicator">
                            <span class="status-icon">⚡</span>
                            <span class="status-text">Medium</span>
                            <span class="status-count" id="medium-count">0</span>
                        </div>
                        <div class="status-indicator low" id="low-indicator">
                            <span class="status-icon">ℹ️</span>
                            <span class="status-text">Low</span>
                            <span class="status-count" id="low-count">0</span>
                        </div>
                    </div>
                    <div class="alert-list" id="alert-list">
                        <div class="no-alerts">No active warnings</div>
                    </div>
                    <div class="warning-controls">
                        <button class="btn warning-btn" id="mute-warnings">🔇 Mute</button>
                        <button class="btn warning-btn" id="clear-warnings">🗑️ Clear</button>
                        <button class="btn warning-btn" id="test-warning">🔊 Test</button>
                    </div>
                </div>
            </div>
        `;

        const sidebar = document.querySelector('.sidebar');
        const existingSection = sidebar.querySelector('.control-section:nth-child(4)');
        if (existingSection) {
            existingSection.insertAdjacentHTML('afterend', warningHTML);
        } else {
            sidebar.insertAdjacentHTML('beforeend', warningHTML);
        }

        this.setupWarningControls();
    }

    setupWarningControls() {
        document.getElementById('mute-warnings').addEventListener('click', () => {
            this.toggleMute();
        });

        document.getElementById('clear-warnings').addEventListener('click', () => {
            this.clearAllWarnings();
        });

        document.getElementById('test-warning').addEventListener('click', () => {
            this.testWarningSystem();
        });
    }

    async analyzeTrafficData(trafficData, incidents) {
        const warnings = [];

        if (trafficData && trafficData.segments) {
            warnings.push(...this.analyzeTrafficFlow(trafficData.segments));
        }

        if (incidents && incidents.length > 0) {
            warnings.push(...this.analyzeIncidents(incidents));
        }

        warnings.push(...this.analyzeSystemHealth());

        return warnings;
    }

    analyzeTrafficFlow(segments) {
        const warnings = [];
        const congestionLevels = segments.map(s => s.trafficLevel);
        const speeds = segments.map(s => s.currentSpeed);

        const severeCount = congestionLevels.filter(level => level === 'severe').length;
        const highCount = congestionLevels.filter(level => level === 'high').length;
        const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;

        if (severeCount > 3) {
            warnings.push({
                level: 'CRITICAL',
                title: 'Severe Traffic Congestion',
                message: `${severeCount} road segments experiencing severe congestion`,
                location: 'Multiple locations',
                timestamp: new Date().toISOString(),
                type: 'congestion',
                severity: severeCount
            });
        }

        if (highCount > 5) {
            warnings.push({
                level: 'HIGH',
                title: 'High Traffic Volume',
                message: `${highCount} road segments with heavy traffic`,
                location: 'City-wide',
                timestamp: new Date().toISOString(),
                type: 'congestion',
                severity: highCount
            });
        }

        if (avgSpeed < 15) {
            warnings.push({
                level: 'HIGH',
                title: 'Very Low Average Speed',
                message: `City-wide average speed: ${avgSpeed.toFixed(1)} km/h`,
                location: 'Nairobi metropolitan',
                timestamp: new Date().toISOString(),
                type: 'speed',
                severity: avgSpeed
            });
        }

        const gridlockSegments = segments.filter(s => s.currentSpeed < 5).length;
        if (gridlockSegments > 0) {
            warnings.push({
                level: 'CRITICAL',
                title: 'Gridlock Risk Detected',
                message: `${gridlockSegments} segments at near-standstill speeds`,
                location: 'Critical intersections',
                timestamp: new Date().toISOString(),
                type: 'gridlock',
                severity: gridlockSegments
            });
        }

        return warnings;
    }

    analyzeIncidents(incidents) {
        const warnings = [];
        const severeIncidents = incidents.filter(i => i.severity === 'high' || i.severity === 'severe');
        const totalDelay = incidents.reduce((sum, i) => sum + (i.delayInSeconds || 0), 0);

        if (severeIncidents.length > 0) {
            warnings.push({
                level: 'HIGH',
                title: 'Severe Traffic Incidents',
                message: `${severeIncidents.length} serious incidents reported`,
                location: severeIncidents.map(i => i.description).join(', '),
                timestamp: new Date().toISOString(),
                type: 'incident',
                severity: severeIncidents.length
            });
        }

        if (incidents.length > 5) {
            warnings.push({
                level: 'MEDIUM',
                title: 'Multiple Traffic Incidents',
                message: `${incidents.length} total incidents affecting traffic flow`,
                location: 'City-wide',
                timestamp: new Date().toISOString(),
                type: 'incident',
                severity: incidents.length
            });
        }

        if (totalDelay > 1800) { // 30 minutes
            warnings.push({
                level: 'MEDIUM',
                title: 'Significant Traffic Delays',
                message: `Total delay time: ${Math.floor(totalDelay / 60)} minutes`,
                location: 'Affected routes',
                timestamp: new Date().toISOString(),
                type: 'delay',
                severity: totalDelay
            });
        }

        return warnings;
    }

    analyzeSystemHealth() {
        const warnings = [];
        const dataAge = window.trafficManager?.statistics?.dataAge || 0;

        if (dataAge > 10) {
            warnings.push({
                level: 'MEDIUM',
                title: 'Stale Traffic Data',
                message: `Traffic data is ${dataAge} minutes old`,
                location: 'System-wide',
                timestamp: new Date().toISOString(),
                type: 'system',
                severity: dataAge
            });
        }

        if (dataAge > 30) {
            warnings.push({
                level: 'HIGH',
                title: 'Data Connection Issues',
                message: `No fresh data for ${dataAge} minutes`,
                location: 'System-wide',
                timestamp: new Date().toISOString(),
                type: 'system',
                severity: dataAge
            });
        }

        return warnings;
    }

    async processWarnings(warnings) {
        const newWarnings = warnings.filter(warning => 
            !this.alerts.some(existing => 
                existing.title === warning.title && 
                existing.location === warning.location
            )
        );

        for (const warning of newWarnings) {
            this.alerts.push(warning);
            await this.triggerWarning(warning);
        }

        this.updateWarningDisplay();
        this.cleanupOldWarnings();
    }

    async triggerWarning(warning) {
        this.showWarningNotification(warning);
        this.playWarningSound(warning.level);
        this.updateWarningIndicators();
        
        if (warning.level === 'CRITICAL') {
            this.showCriticalAlert(warning);
        }
    }

    showWarningNotification(warning) {
        const notification = document.createElement('div');
        notification.className = `warning-notification warning-${warning.level.toLowerCase()}`;
        notification.innerHTML = `
            <div class="warning-content">
                <div class="warning-header">
                    <span class="warning-icon">${this.alertLevels[warning.level].icon}</span>
                    <span class="warning-title">${warning.title}</span>
                    <span class="warning-time">${new Date().toLocaleTimeString()}</span>
                </div>
                <div class="warning-message">${warning.message}</div>
                <div class="warning-location">📍 ${warning.location}</div>
            </div>
        `;

        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${this.alertLevels[warning.level].color};
            color: white;
            padding: 15px;
            border-radius: 8px;
            z-index: 4000;
            box-shadow: 0 6px 20px rgba(0,0,0,0.3);
            animation: slideInWarning 0.5s ease;
            min-width: 300px;
            max-width: 400px;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOutWarning 0.5s ease';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 500);
        }, 8000);
    }

    playWarningSound(level) {
        if (!this.audioContext || this.muted) return;

        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            const frequencies = {
                CRITICAL: [800, 600],
                HIGH: [600, 400],
                MEDIUM: [400, 300],
                LOW: [300, 200],
                INFO: [200, 150]
            };

            const [freq1, freq2] = frequencies[level] || frequencies.INFO;
            
            oscillator.frequency.setValueAtTime(freq1, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(freq2, this.audioContext.currentTime + 0.3);

            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.5);
        } catch (error) {
            console.log('Error playing warning sound:', error);
        }
    }

    showCriticalAlert(warning) {
        const alertOverlay = document.createElement('div');
        alertOverlay.className = 'critical-alert-overlay';
        alertOverlay.innerHTML = `
            <div class="critical-alert-box">
                <div class="critical-alert-header">
                    <span class="critical-icon">🚨</span>
                    <span class="critical-title">CRITICAL TRAFFIC ALERT</span>
                </div>
                <div class="critical-alert-content">
                    <h3>${warning.title}</h3>
                    <p>${warning.message}</p>
                    <p><strong>Location:</strong> ${warning.location}</p>
                </div>
                <div class="critical-alert-actions">
                    <button class="btn critical-btn" onclick="this.parentElement.parentElement.parentElement.remove()">Acknowledge</button>
                    <button class="btn critical-btn" onclick="window.trafficMap.focusOnLocation('${warning.location}')">View on Map</button>
                </div>
            </div>
        `;

        alertOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            z-index: 5000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeInCritical 0.3s ease;
        `;

        document.body.appendChild(alertOverlay);
    }

    updateWarningDisplay() {
        const alertList = document.getElementById('alert-list');
        
        if (this.alerts.length === 0) {
            alertList.innerHTML = '<div class="no-alerts">No active warnings</div>';
            return;
        }

        const sortedAlerts = [...this.alerts].sort((a, b) => 
            this.alertLevels[a.level].priority - this.alertLevels[b.level].priority
        );

        alertList.innerHTML = sortedAlerts.slice(0, 10).map(alert => `
            <div class="alert-item alert-${alert.level.toLowerCase()}">
                <div class="alert-header">
                    <span class="alert-icon">${this.alertLevels[alert.level].icon}</span>
                    <span class="alert-title">${alert.title}</span>
                    <span class="alert-level">${alert.level}</span>
                </div>
                <div class="alert-message">${alert.message}</div>
                <div class="alert-meta">
                    <span class="alert-location">📍 ${alert.location}</span>
                    <span class="alert-time">${new Date(alert.timestamp).toLocaleTimeString()}</span>
                </div>
            </div>
        `).join('');

        this.updateWarningIndicators();
    }

    updateWarningIndicators() {
        const counts = {
            CRITICAL: 0,
            HIGH: 0,
            MEDIUM: 0,
            LOW: 0
        };

        this.alerts.forEach(alert => {
            if (counts.hasOwnProperty(alert.level)) {
                counts[alert.level]++;
            }
        });

        Object.keys(counts).forEach(level => {
            const countElement = document.getElementById(`${level.toLowerCase()}-count`);
            const indicatorElement = document.getElementById(`${level.toLowerCase()}-indicator`);
            
            if (countElement) {
                countElement.textContent = counts[level];
            }
            
            if (indicatorElement) {
                if (counts[level] > 0) {
                    indicatorElement.classList.add('active');
                } else {
                    indicatorElement.classList.remove('active');
                }
            }
        });
    }

    cleanupOldWarnings() {
        const now = new Date();
        this.alerts = this.alerts.filter(alert => {
            const alertTime = new Date(alert.timestamp);
            const ageMinutes = (now - alertTime) / (1000 * 60);
            return ageMinutes < 30; // Keep warnings for 30 minutes
        });
    }

    toggleMute() {
        this.muted = !this.muted;
        const muteButton = document.getElementById('mute-warnings');
        muteButton.textContent = this.muted ? '🔊 Unmute' : '🔇 Mute';
        muteButton.classList.toggle('muted', this.muted);
    }

    clearAllWarnings() {
        this.alerts = [];
        this.updateWarningDisplay();
        
        const notifications = document.querySelectorAll('.warning-notification');
        notifications.forEach(notification => {
            notification.remove();
        });
    }

    testWarningSystem() {
        const testWarning = {
            level: 'HIGH',
            title: 'Test Warning',
            message: 'This is a test of the warning system',
            location: 'Test Location',
            timestamp: new Date().toISOString(),
            type: 'test',
            severity: 1
        };

        this.triggerWarning(testWarning);
    }

    startMonitoring() {
        setInterval(async () => {
            try {
                const trafficData = await window.trafficMap.fetchLiveTraffic();
                const incidents = await window.trafficMap.fetchIncidents();
                const warnings = await this.analyzeTrafficData(trafficData, incidents);
                await this.processWarnings(warnings);
            } catch (error) {
                console.error('Error in warning monitoring:', error);
            }
        }, 60000); // Check every minute
    }
}

window.WarningSystem = WarningSystem;