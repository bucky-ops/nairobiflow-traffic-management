class TrafficVisualizer {
    constructor(map) {
        this.map = map;
        this.flowIndicators = [];
        this.heatmapLayer = null;
        this.particleSystem = null;
        this.animationFrame = null;
        this.trafficColors = {
            low: '#10b981',
            medium: '#f59e0b', 
            high: '#ef4444',
            severe: '#7c2d12'
        };
        this.init();
    }

    init() {
        this.createParticleSystem();
        this.setupHeatmap();
        this.startAnimation();
    }

    createParticleSystem() {
        this.particleSystem = {
            particles: [],
            maxParticles: 200,
            spawnRate: 0.1
        };
    }

    setupHeatmap() {
        this.heatmapLayer = L.layerGroup();
    }

    updateTrafficVisualization(trafficData) {
        if (!trafficData || !trafficData.segments) return;

        this.clearFlowIndicators();
        this.updateHeatmap(trafficData.segments);
        this.updateFlowParticles(trafficData.segments);
        this.addAnimatedTrafficLines(trafficData.segments);
    }

    addAnimatedTrafficLines(segments) {
        segments.forEach((segment, index) => {
            const coordinates = segment.coordinates.map(coord => [coord[1], coord[0]]);
            const color = this.trafficColors[segment.trafficLevel] || '#6b7280';
            
            // Create animated traffic line
            const trafficLine = L.polyline(coordinates, {
                color: color,
                weight: 6,
                opacity: 0.8,
                className: `traffic-line traffic-${segment.trafficLevel}`
            });

            // Add flow animation
            this.addFlowAnimation(trafficLine, segment, index);
            
            // Add direction indicators
            this.addDirectionIndicators(coordinates, segment);
            
            // Add speed indicators
            this.addSpeedIndicators(coordinates, segment);

            this.flowIndicators.push(trafficLine);
        });
    }

    addFlowAnimation(line, segment, index) {
        const dashArray = '10, 10';
        const dashOffset = -20;
        
        line.setStyle({
            dashArray: dashArray,
            dashOffset: dashOffset
        });

        // Animate the dash offset to create flow effect
        let offset = dashOffset;
        const animationSpeed = Math.max(1, 10 - segment.currentSpeed / 10);
        
        const animate = () => {
            offset -= animationSpeed;
            line.setStyle({ dashOffset: offset });
            
            if (this.flowIndicators.includes(line)) {
                requestAnimationFrame(animate);
            }
        };
        
        setTimeout(() => animate(), index * 100);
    }

    addDirectionIndicators(coordinates, segment) {
        if (coordinates.length < 2) return;

        // Calculate direction
        const start = coordinates[0];
        const end = coordinates[coordinates.length - 1];
        const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
        
        // Add arrow markers along the path
        const arrowCount = Math.min(3, Math.floor(coordinates.length / 5));
        
        for (let i = 1; i <= arrowCount; i++) {
            const position = Math.floor((coordinates.length / (arrowCount + 1)) * i);
            const point = coordinates[position];
            
            const arrowIcon = L.divIcon({
                className: 'traffic-arrow',
                html: `<div style="
                    transform: rotate(${angle}rad);
                    color: ${this.trafficColors[segment.trafficLevel]};
                    font-size: 16px;
                    text-shadow: 0 0 3px rgba(0,0,0,0.5);
                ">➤</div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            
            const arrowMarker = L.marker(point, { icon: arrowIcon });
            this.flowIndicators.push(arrowMarker);
        }
    }

    addSpeedIndicators(coordinates, segment) {
        // Add speed indicator at midpoint
        const midIndex = Math.floor(coordinates.length / 2);
        const midpoint = coordinates[midIndex];
        
        const speedColor = this.getSpeedColor(segment.currentSpeed);
        const speedIcon = L.divIcon({
            className: 'speed-indicator',
            html: `<div style="
                background: ${speedColor};
                color: white;
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 10px;
                font-weight: bold;
                border: 1px solid white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">${segment.currentSpeed} km/h</div>`,
            iconSize: [60, 20],
            iconAnchor: [30, 10]
        });
        
        const speedMarker = L.marker(midpoint, { icon: speedIcon });
        this.flowIndicators.push(speedMarker);
    }

    updateFlowParticles(segments) {
        // Clear old particles
        this.particleSystem.particles = this.particleSystem.particles.filter(p => p.life > 0);
        
        // Spawn new particles on busy segments
        segments.forEach(segment => {
            if (segment.trafficLevel === 'high' || segment.trafficLevel === 'severe') {
                if (Math.random() < this.particleSystem.spawnRate) {
                    this.spawnTrafficParticle(segment);
                }
            }
        });
        
        // Update existing particles
        this.particleSystem.particles.forEach(particle => {
            this.updateParticle(particle);
        });
    }

    spawnTrafficParticle(segment) {
        if (this.particleSystem.particles.length >= this.particleSystem.maxParticles) return;
        
        const coordinates = segment.coordinates.map(coord => [coord[1], coord[0]]);
        const startPoint = coordinates[0];
        const endPoint = coordinates[coordinates.length - 1];
        
        const particle = {
            position: [...startPoint],
            target: [...endPoint],
            speed: segment.currentSpeed / 10,
            color: this.trafficColors[segment.trafficLevel],
            size: Math.random() * 4 + 2,
            life: 100,
            maxLife: 100,
            path: coordinates,
            pathIndex: 0
        };
        
        this.particleSystem.particles.push(particle);
    }

    updateParticle(particle) {
        particle.life--;
        
        if (particle.pathIndex < particle.path.length - 1) {
            const current = particle.path[particle.pathIndex];
            const next = particle.path[particle.pathIndex + 1];
            
            const dx = next[0] - current[0];
            const dy = next[1] - current[1];
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                particle.position[0] += (dx / distance) * particle.speed * 0.01;
                particle.position[1] += (dy / distance) * particle.speed * 0.01;
                
                const distToNext = Math.sqrt(
                    Math.pow(next[0] - particle.position[0], 2) + 
                    Math.pow(next[1] - particle.position[1], 2)
                );
                
                if (distToNext < 0.01) {
                    particle.pathIndex++;
                }
            }
        }
        
        // Create visual particle
        this.createParticleElement(particle);
    }

    createParticleElement(particle) {
        const opacity = particle.life / particle.maxLife;
        const size = particle.size * opacity;
        
        const particleElement = L.divIcon({
            className: 'traffic-particle',
            html: `<div style="
                width: ${size}px;
                height: ${size}px;
                background: ${particle.color};
                border-radius: 50%;
                opacity: ${opacity};
                box-shadow: 0 0 ${size * 2}px ${particle.color};
                animation: pulse 1s infinite;
            "></div>`,
            iconSize: [size, size],
            iconAnchor: [size/2, size/2]
        });
        
        const marker = L.marker(particle.position, { icon: particleElement });
        this.map.addLayer(marker);
        
        // Remove marker after short time
        setTimeout(() => {
            this.map.removeLayer(marker);
        }, 100);
    }

    updateHeatmap(segments) {
        this.heatmapLayer.clearLayers();
        
        const heatData = segments.map(segment => {
            const coordinates = segment.coordinates.map(coord => [coord[1], coord[0]]);
            const centerPoint = coordinates[Math.floor(coordinates.length / 2)];
            
            const intensity = this.getHeatmapIntensity(segment.trafficLevel, segment.currentSpeed);
            
            return L.circle(centerPoint, {
                radius: 200,
                fillColor: this.getHeatmapColor(intensity),
                fillOpacity: intensity * 0.6,
                stroke: false,
                className: 'heatmap-circle'
            });
        });
        
        heatData.forEach(circle => {
            this.heatmapLayer.addLayer(circle);
        });
    }

    getHeatmapIntensity(trafficLevel, speed) {
        const baseIntensity = {
            low: 0.2,
            medium: 0.5,
            high: 0.8,
            severe: 1.0
        };
        
        const speedFactor = Math.max(0, 1 - (speed / 80));
        return Math.min(1, baseIntensity[trafficLevel] + speedFactor * 0.3);
    }

    getHeatmapColor(intensity) {
        if (intensity < 0.3) return '#10b981';
        if (intensity < 0.6) return '#f59e0b';
        if (intensity < 0.8) return '#ef4444';
        return '#7c2d12';
    }

    getSpeedColor(speed) {
        if (speed > 60) return '#10b981';
        if (speed > 40) return '#f59e0b';
        if (speed > 20) return '#ef4444';
        return '#7c2d12';
    }

    startAnimation() {
        const animate = () => {
            this.updateParticles();
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }

    updateParticles() {
        // Update particle positions and visual effects
        this.particleSystem.particles.forEach(particle => {
            if (particle.life > 0) {
                particle.life--;
            }
        });
        
        // Remove dead particles
        this.particleSystem.particles = this.particleSystem.particles.filter(p => p.life > 0);
    }

    clearFlowIndicators() {
        this.flowIndicators.forEach(indicator => {
            this.map.removeLayer(indicator);
        });
        this.flowIndicators = [];
    }

    toggleHeatmap() {
        if (this.map.hasLayer(this.heatmapLayer)) {
            this.map.removeLayer(this.heatmapLayer);
        } else {
            this.map.addLayer(this.heatmapLayer);
        }
    }

    toggleParticles() {
        this.particleSystem.enabled = !this.particleSystem.enabled;
    }

    addTrafficDensityOverlay(segments) {
        const densityData = this.calculateTrafficDensity(segments);
        this.createDensityGradient(densityData);
    }

    calculateTrafficDensity(segments) {
        const gridSize = 0.01; // ~1km grid
        const densityMap = new Map();
        
        segments.forEach(segment => {
            const coordinates = segment.coordinates.map(coord => [coord[1], coord[0]]);
            
            coordinates.forEach(coord => {
                const gridX = Math.floor(coord[0] / gridSize);
                const gridY = Math.floor(coord[1] / gridSize);
                const key = `${gridX},${gridY}`;
                
                if (!densityMap.has(key)) {
                    densityMap.set(key, {
                        count: 0,
                        totalSpeed: 0,
                        congestionLevels: []
                    });
                }
                
                const cell = densityMap.get(key);
                cell.count++;
                cell.totalSpeed += segment.currentSpeed;
                cell.congestionLevels.push(segment.trafficLevel);
            });
        });
        
        return densityMap;
    }

    createDensityGradient(densityMap) {
        densityMap.forEach((cell, key) => {
            const [gridX, gridY] = key.split(',').map(Number);
            const lat = gridY * 0.01;
            const lng = gridX * 0.01;
            
            const avgSpeed = cell.totalSpeed / cell.count;
            const congestionScore = this.calculateCongestionScore(cell.congestionLevels);
            
            const gradient = L.rectangle([
                [lat, lng],
                [lat + 0.01, lng + 0.01]
            ], {
                fillColor: this.getDensityColor(congestionScore, avgSpeed),
                fillOpacity: 0.4,
                stroke: false,
                className: 'density-gradient'
            });
            
            this.heatmapLayer.addLayer(gradient);
        });
    }

    calculateCongestionScore(levels) {
        const scores = { low: 1, medium: 2, high: 3, severe: 4 };
        const totalScore = levels.reduce((sum, level) => sum + (scores[level] || 0), 0);
        return totalScore / levels.length;
    }

    getDensityColor(congestionScore, avgSpeed) {
        if (congestionScore > 3) return '#7c2d12';
        if (congestionScore > 2) return '#ef4444';
        if (congestionScore > 1.5) return '#f59e0b';
        if (avgSpeed < 30) return '#ef4444';
        if (avgSpeed < 50) return '#f59e0b';
        return '#10b981';
    }

    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        this.clearFlowIndicators();
        this.heatmapLayer.clearLayers();
    }
}

window.TrafficVisualizer = TrafficVisualizer;