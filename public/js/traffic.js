class TrafficManager {
    constructor() {
        this.currentData = null;
        this.incidents = [];
        this.statistics = {
            averageSpeed: 0,
            congestionLevel: 'low',
            incidentCount: 0,
            dataAge: 0
        };
        this.init();
    }

    init() {
        this.setupRoutePlanner();
        this.startPeriodicUpdates();
    }

    setupRoutePlanner() {
        const planButton = document.getElementById('plan-route');
        planButton.addEventListener('click', () => {
            this.calculateRoute();
        });
    }

    async calculateRoute() {
        const startPoint = document.getElementById('start-point').value;
        const endPoint = document.getElementById('end-point').value;

        if (!startPoint || !endPoint) {
            this.showNotification('Please select both start and end points', 'error');
            return;
        }

        try {
            this.showLoading(true);
            
            const routeData = await this.fetchRoute(startPoint, endPoint);
            this.displayRoute(routeData);
            
        } catch (error) {
            console.error('Error calculating route:', error);
            this.showNotification('Failed to calculate route', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async fetchRoute(start, end, alternatives = true) {
        const params = new URLSearchParams({
            start: start,
            end: end,
            alternatives: alternatives
        });

        const response = await fetch(`/api/traffic/route?${params}`);
        if (!response.ok) {
            throw new Error('Route calculation failed');
        }

        return await response.json();
    }

    displayRoute(routeData) {
        if (!routeData || !routeData.routes) {
            this.showNotification('No route found', 'warning');
            return;
        }

        window.trafficMap.clearRoute();
        
        const mainRoute = routeData.routes[0];
        const coordinates = this.decodePolyline(mainRoute.geometry);

        const routeLine = L.polyline(coordinates, {
            color: '#667eea',
            weight: 5,
            opacity: 0.8
        }).addTo(window.trafficMap.map);

        window.trafficMap.routeLine = routeLine;

        const bounds = routeLine.getBounds();
        window.trafficMap.map.fitBounds(bounds, { padding: [50, 50] });

        this.displayRouteInfo(mainRoute);
    }

    decodePolyline(encoded) {
        const points = [];
        let index = 0, len = encoded.length;
        let lat = 0, lng = 0;

        while (index < len) {
            let b, shift = 0, result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            lat += ((result & 1) ? ~(result >> 1) : (result >> 1));

            shift = result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            lng += ((result & 1) ? ~(result >> 1) : (result >> 1));

            points.push([lat / 1e5, lng / 1e5]);
        }

        return points;
    }

    displayRouteInfo(route) {
        const travelTime = this.formatTravelTime(route.summary.travelTimeInSeconds);
        const distance = (route.summary.lengthInMeters / 1000).toFixed(1);
        const delay = route.summary.trafficDelayInSeconds || 0;

        const popupContent = `
            <div style="min-width: 200px;">
                <h4 style="margin: 0 0 10px 0; color: #333;">Route Information</h4>
                <p style="margin: 5px 0; color: #666;">📏 Distance: ${distance} km</p>
                <p style="margin: 5px 0; color: #666;">⏱️ Travel Time: ${travelTime}</p>
                <p style="margin: 5px 0; color: #666;">🚦 Traffic Delay: ${this.formatTravelTime(delay)}</p>
                <p style="margin: 5px 0; color: #666;">🚗 Avg Speed: ${this.calculateAverageSpeed(route.summary.lengthInMeters, route.summary.travelTimeInSeconds)} km/h</p>
            </div>
        `;

        L.popup()
            .setLatLng(routeLine.getBounds().getCenter())
            .setContent(popupContent)
            .openOn(window.trafficMap.map);
    }

    formatTravelTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }

    calculateAverageSpeed(distanceInMeters, travelTimeInSeconds) {
        if (travelTimeInSeconds === 0) return 0;
        const speedInMetersPerSecond = distanceInMeters / travelTimeInSeconds;
        return Math.round(speedInMetersPerSecond * 3.6);
    }

    updateStatistics(trafficData) {
        if (!trafficData || !trafficData.segments) {
            return;
        }

        const segments = trafficData.segments;
        const totalSpeed = segments.reduce((sum, segment) => sum + segment.currentSpeed, 0);
        this.statistics.averageSpeed = Math.round(totalSpeed / segments.length);

        this.statistics.congestionLevel = this.calculateOverallCongestion(segments);
        this.statistics.dataAge = this.calculateDataAge(trafficData.timestamp);

        this.updateStatisticsDisplay();
    }

    calculateOverallCongestion(segments) {
        const congestionLevels = segments.map(segment => segment.trafficLevel);
        const levelCounts = {
            low: 0,
            medium: 0,
            high: 0,
            severe: 0
        };

        congestionLevels.forEach(level => {
            levelCounts[level]++;
        });

        const total = segments.length;
        if (levelCounts.severe / total > 0.3) return 'severe';
        if (levelCounts.high / total > 0.4) return 'high';
        if (levelCounts.medium / total > 0.5) return 'medium';
        return 'low';
    }

    calculateDataAge(timestamp) {
        const now = new Date();
        const dataTime = new Date(timestamp);
        const ageInMinutes = Math.floor((now - dataTime) / (1000 * 60));
        return ageInMinutes;
    }

    updateStatisticsDisplay() {
        document.getElementById('avg-speed').textContent = this.statistics.averageSpeed;
        document.getElementById('congestion-level').textContent = this.statistics.congestionLevel.toUpperCase();
        document.getElementById('data-age').textContent = this.statistics.dataAge;

        const congestionElement = document.getElementById('congestion-level');
        congestionElement.style.color = this.getCongestionColor(this.statistics.congestionLevel);
    }

    updateIncidentList(incidents) {
        this.incidents = incidents;
        this.statistics.incidentCount = incidents.length;
        document.getElementById('incidents-count').textContent = this.statistics.incidentCount;

        const incidentList = document.getElementById('incident-list');
        
        if (incidents.length === 0) {
            incidentList.innerHTML = '<div class="incident-item"><div>No active incidents</div></div>';
            return;
        }

        incidentList.innerHTML = incidents.slice(0, 5).map(incident => `
            <div class="incident-item">
                <div>${incident.description || 'Traffic incident'}</div>
                <span class="incident-severity severity-${incident.severity || 'medium'}">${incident.severity || 'medium'}</span>
            </div>
        `).join('');
    }

    getCongestionColor(level) {
        const colors = {
            low: '#10b981',
            medium: '#f59e0b',
            high: '#ef4444',
            severe: '#7c2d12'
        };
        return colors[level] || '#6b7280';
    }

    startPeriodicUpdates() {
        setInterval(() => {
            this.refreshData();
        }, 30000);
    }

    async refreshData() {
        try {
            const [trafficData, incidents] = await Promise.all([
                this.fetchTrafficData(),
                this.fetchIncidents()
            ]);

            this.updateStatistics(trafficData);
            this.updateIncidentList(incidents);

            // Trigger warning system analysis
            if (window.warningSystem) {
                const warnings = await window.warningSystem.analyzeTrafficData(trafficData, incidents);
                await window.warningSystem.processWarnings(warnings);
            }
            
        } catch (error) {
            console.error('Error refreshing data:', error);
        }
    }

    async fetchTrafficData() {
        const response = await fetch('/api/traffic/live');
        return await response.json();
    }

    async fetchIncidents() {
        const response = await fetch('/api/traffic/incidents');
        return await response.json();
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (show) {
            loading.classList.add('active');
        } else {
            loading.classList.remove('active');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#667eea'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 3000;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    clearRoute() {
        if (window.trafficMap.routeLine) {
            window.trafficMap.map.removeLayer(window.trafficMap.routeLine);
            window.trafficMap.routeLine = null;
        }

        if (window.trafficMap.markers.start) {
            window.trafficMap.map.removeLayer(window.trafficMap.markers.start);
            window.trafficMap.markers.start = null;
        }

        if (window.trafficMap.markers.end) {
            window.trafficMap.map.removeLayer(window.trafficMap.markers.end);
            window.trafficMap.markers.end = null;
        }

        document.getElementById('start-point').value = '';
        document.getElementById('end-point').value = '';
    }
}

window.TrafficManager = TrafficManager;