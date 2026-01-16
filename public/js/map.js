class NairobiTrafficMap {
    constructor() {
        this.map = null;
        this.layers = {
            traffic: null,
            roads: null,
            landmarks: null,
            incidents: null,
            hotspots: null
        };
        this.layerGroups = {
            traffic: L.layerGroup(),
            flowAnimation: L.layerGroup(),
            heatmap: L.layerGroup(),
            roads: L.layerGroup(),
            landmarks: L.layerGroup(),
            incidents: L.layerGroup(),
            hotspots: L.layerGroup()
        };
        this.markers = {
            start: null,
            end: null
        };
        this.routeLine = null;
        this.socket = null;
        this.init();
    }

    async init() {
        await this.initializeMap();
        await this.loadNairobiData();
        this.setupEventListeners();
        this.connectWebSocket();
        this.startDataRefresh();
    }

    async initializeMap() {
        const boundaries = await this.fetchNairobiBoundaries();
        
        this.map = L.map('map', {
            center: boundaries.center,
            zoom: boundaries.defaultZoom,
            zoomControl: true,
            attributionControl: false
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(this.map);

        L.control.attribution({
            position: 'bottomleft'
        }).addTo(this.map);

        const bounds = [
            [boundaries.bounds.southwest.lat, boundaries.bounds.southwest.lng],
            [boundaries.bounds.northeast.lat, boundaries.bounds.northeast.lng]
        ];
        this.map.setMaxBounds(bounds);
    }

    async loadNairobiData() {
        try {
            this.showLoading(true);

            const [landmarks, roads, hotspots] = await Promise.all([
                this.fetchLandmarks(),
                this.fetchRoads(),
                this.fetchHotspots()
            ]);

            this.addLandmarks(landmarks);
            this.addRoads(roads);
            this.addHotspots(hotspots);

            this.layerGroups.roads.addTo(this.map);
            this.layerGroups.landmarks.addTo(this.map);
            this.layerGroups.hotspots.addTo(this.map);

        } catch (error) {
            console.error('Error loading Nairobi data:', error);
        } finally {
            this.showLoading(false);
        }
    }

    addLandmarks(landmarks) {
        landmarks.features.forEach(feature => {
            const { name, type, description } = feature.properties;
            const [lng, lat] = feature.geometry.coordinates;

            const icon = this.getLandmarkIcon(type);
            const marker = L.marker([lat, lng], { icon })
                .bindPopup(`
                    <div style="text-align: center;">
                        <h4 style="margin: 0 0 5px 0; color: #333;">${name}</h4>
                        <p style="margin: 0; color: #666; font-size: 12px;">${description}</p>
                        <span style="background: #667eea; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">${type}</span>
                    </div>
                `);

            this.layerGroups.landmarks.addLayer(marker);
        });
    }

    addRoads(roads) {
        roads.features.forEach(feature => {
            const { name, type, lanes, speed_limit } = feature.properties;
            const coordinates = feature.geometry.coordinates.map(coord => [coord[1], coord[0]]);

            const color = this.getRoadColor(type);
            const weight = this.getRoadWeight(type);

            const polyline = L.polyline(coordinates, {
                color: color,
                weight: weight,
                opacity: 0.8
            }).bindPopup(`
                <div style="min-width: 200px;">
                    <h4 style="margin: 0 0 5px 0; color: #333;">${name}</h4>
                    <p style="margin: 2px 0; color: #666; font-size: 12px;">Type: ${type}</p>
                    <p style="margin: 2px 0; color: #666; font-size: 12px;">Lanes: ${lanes}</p>
                    <p style="margin: 2px 0; color: #666; font-size: 12px;">Speed Limit: ${speed_limit}</p>
                </div>
            `);

            this.layerGroups.roads.addLayer(polyline);
        });
    }

    addHotspots(hotspots) {
        hotspots.features.forEach(feature => {
            const { name, congestion_level, peak_hours, description } = feature.properties;
            const [lng, lat] = feature.geometry.coordinates;

            const color = this.getCongestionColor(congestion_level);
            const circle = L.circle([lat, lng], {
                radius: 500,
                fillColor: color,
                color: color,
                weight: 2,
                opacity: 0.6,
                fillOpacity: 0.3
            }).bindPopup(`
                <div style="min-width: 200px;">
                    <h4 style="margin: 0 0 5px 0; color: #333;">${name}</h4>
                    <p style="margin: 2px 0; color: #666; font-size: 12px;">${description}</p>
                    <p style="margin: 2px 0; color: #666; font-size: 12px;">Peak Hours: ${peak_hours}</p>
                    <span style="background: ${color}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; text-transform: uppercase;">${congestion_level}</span>
                </div>
            `);

            this.layerGroups.hotspots.addLayer(circle);
        });
    }

    async updateTrafficData() {
        try {
            const trafficData = await this.fetchLiveTraffic();
            this.updateTrafficLayers(trafficData);
            this.updateStatistics(trafficData);
        } catch (error) {
            console.error('Error updating traffic data:', error);
        }
    }

    updateTrafficLayers(trafficData) {
        this.layerGroups.traffic.clearLayers();

        if (trafficData.segments) {
            // Update traffic visualizer if available
            if (window.trafficVisualizer) {
                window.trafficVisualizer.updateTrafficVisualization(trafficData);
            }

            trafficData.segments.forEach(segment => {
                const color = this.getTrafficColor(segment.trafficLevel);
                const coordinates = segment.coordinates.map(coord => [coord[1], coord[0]]);

                const polyline = L.polyline(coordinates, {
                    color: color,
                    weight: 6,
                    opacity: 0.8
                }).bindPopup(`
                    <div style="min-width: 180px;">
                        <p style="margin: 2px 0; color: #333; font-size: 12px;">Current Speed: ${segment.currentSpeed} km/h</p>
                        <p style="margin: 2px 0; color: #333; font-size: 12px;">Free Flow: ${segment.freeFlowSpeed} km/h</p>
                        <p style="margin: 2px 0; color: #333; font-size: 12px;">Travel Time: ${segment.currentTravelTime}s</p>
                        <span style="background: ${color}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; text-transform: uppercase;">${segment.trafficLevel}</span>
                    </div>
                `);

                this.layerGroups.traffic.addLayer(polyline);
            });
        }
    }

    async updateIncidents() {
        try {
            const incidents = await this.fetchIncidents();
            this.updateIncidentLayers(incidents);
            this.updateIncidentList(incidents);
        } catch (error) {
            console.error('Error updating incidents:', error);
        }
    }

    updateIncidentLayers(incidents) {
        this.layerGroups.incidents.clearLayers();

        incidents.forEach(incident => {
            const [lng, lat] = incident.geometry.coordinates;
            const severity = incident.severity || 'medium';
            const color = this.getSeverityColor(severity);

            const marker = L.marker([lat, lng], {
                icon: L.divIcon({
                    className: 'incident-marker',
                    html: `<div style="background: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                    iconSize: [20, 20]
                })
            }).bindPopup(`
                <div style="min-width: 200px;">
                    <h4 style="margin: 0 0 5px 0; color: #333;">Traffic Incident</h4>
                    <p style="margin: 2px 0; color: #666; font-size: 12px;">${incident.description}</p>
                    <p style="margin: 2px 0; color: #666; font-size: 12px;">Severity: ${severity}</p>
                    <p style="margin: 2px 0; color: #666; font-size: 12px;">Delay: ${incident.delayInSeconds}s</p>
                </div>
            `);

            this.layerGroups.incidents.addLayer(marker);
        });
    }

    setupEventListeners() {
        document.getElementById('traffic-toggle').addEventListener('click', (e) => {
            this.toggleLayer('traffic', e.target);
        });

        document.getElementById('flow-animation-toggle').addEventListener('click', (e) => {
            this.toggleLayer('flow-animation', e.target);
            if (window.trafficVisualizer) {
                window.trafficVisualizer.toggleParticles();
            }
        });

        document.getElementById('heatmap-toggle').addEventListener('click', (e) => {
            this.toggleLayer('heatmap', e.target);
            if (window.trafficVisualizer) {
                window.trafficVisualizer.toggleHeatmap();
            }
        });

        document.getElementById('roads-toggle').addEventListener('click', (e) => {
            this.toggleLayer('roads', e.target);
        });

        document.getElementById('landmarks-toggle').addEventListener('click', (e) => {
            this.toggleLayer('landmarks', e.target);
        });

        document.getElementById('incidents-toggle').addEventListener('click', (e) => {
            this.toggleLayer('incidents', e.target);
        });

        document.getElementById('hotspots-toggle').addEventListener('click', (e) => {
            this.toggleLayer('hotspots', e.target);
        });

        this.map.on('click', (e) => {
            this.handleMapClick(e);
        });
    }

    toggleLayer(layerName, toggleElement) {
        toggleElement.classList.toggle('active');
        
        if (toggleElement.classList.contains('active')) {
            this.map.addLayer(this.layerGroups[layerName]);
        } else {
            this.map.removeLayer(this.layerGroups[layerName]);
        }
    }

    handleMapClick(e) {
        const startPointInput = document.getElementById('start-point');
        const endPointInput = document.getElementById('end-point');

        if (startPointInput.value === '') {
            startPointInput.value = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
            this.addRouteMarker('start', e.latlng);
        } else if (endPointInput.value === '') {
            endPointInput.value = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
            this.addRouteMarker('end', e.latlng);
        }
    }

    addRouteMarker(type, latlng) {
        if (this.markers[type]) {
            this.map.removeLayer(this.markers[type]);
        }

        const icon = L.divIcon({
            className: 'route-marker',
            html: `<div style="background: ${type === 'start' ? '#10b981' : '#ef4444'}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
            iconSize: [12, 12]
        });

        this.markers[type] = L.marker(latlng, { icon }).addTo(this.map);
    }

    connectWebSocket() {
        this.socket = io();
        
        this.socket.on('traffic-update', (data) => {
            this.updateTrafficLayers(data);
            this.updateLastUpdateTime();
        });

        this.socket.on('connect', () => {
            console.log('Connected to traffic updates');
        });
    }

    startDataRefresh() {
        this.updateTrafficData();
        this.updateIncidents();

        setInterval(() => {
            this.updateTrafficData();
            this.updateIncidents();
        }, 60000);
    }

    getLandmarkIcon(type) {
        const icons = {
            airport: '✈️',
            park: '🌳',
            landmark: '🏛️',
            transport: '🚉',
            shopping: '🛍️',
            museum: '🏛️',
            attraction: '🦁'
        };

        return L.divIcon({
            className: 'landmark-icon',
            html: `<div style="background: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${icons[type] || '📍'}</div>`,
            iconSize: [30, 30]
        });
    }

    getRoadColor(type) {
        const colors = {
            highway: '#667eea',
            arterial: '#f59e0b',
            bypass: '#10b981',
            local: '#6b7280'
        };
        return colors[type] || '#6b7280';
    }

    getRoadWeight(type) {
        const weights = {
            highway: 4,
            arterial: 3,
            bypass: 3,
            local: 2
        };
        return weights[type] || 2;
    }

    getTrafficColor(level) {
        const colors = {
            low: '#10b981',
            medium: '#f59e0b',
            high: '#ef4444',
            severe: '#7c2d12'
        };
        return colors[level] || '#6b7280';
    }

    getCongestionColor(level) {
        const colors = {
            low: '#10b98130',
            medium: '#f59e0b30',
            high: '#ef444430',
            severe: '#7c2d1230'
        };
        return colors[level] || '#6b728030';
    }

    getSeverityColor(severity) {
        const colors = {
            low: '#10b981',
            medium: '#f59e0b',
            high: '#ef4444',
            severe: '#7c2d12'
        };
        return colors[severity] || '#f59e0b';
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (show) {
            loading.classList.add('active');
        } else {
            loading.classList.remove('active');
        }
    }

    updateLastUpdateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        document.getElementById('last-update').textContent = `Last update: ${timeString}`;
    }

    async fetchNairobiBoundaries() {
        const response = await fetch('/api/nairobi/boundaries');
        return await response.json();
    }

    async fetchLandmarks() {
        const response = await fetch('/api/nairobi/landmarks');
        return await response.json();
    }

    async fetchRoads() {
        const response = await fetch('/api/nairobi/roads');
        return await response.json();
    }

    async fetchHotspots() {
        const response = await fetch('/api/nairobi/hotspots');
        return await response.json();
    }

    async fetchLiveTraffic() {
        const response = await fetch('/api/traffic/live');
        return await response.json();
    }

    async fetchIncidents() {
        const response = await fetch('/api/traffic/incidents');
        return await response.json();
    }
}

window.NairobiTrafficMap = NairobiTrafficMap;