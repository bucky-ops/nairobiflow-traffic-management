class PredictiveWarningSystem {
    constructor() {
        this.historicalData = [];
        this.predictions = [];
        this.models = {
            congestion: new CongestionModel(),
            incident: new IncidentModel(),
            speed: new SpeedModel()
        };
        this.predictionHorizon = 60; // 60 minutes ahead
        this.init();
    }

    init() {
        this.startDataCollection();
        this.setupPredictionEngine();
    }

    startDataCollection() {
        // Collect historical data every 5 minutes
        setInterval(async () => {
            try {
                const trafficData = await window.trafficMap.fetchLiveTraffic();
                const incidents = await window.trafficMap.fetchIncidents();
                
                this.storeHistoricalData(trafficData, incidents);
                this.updatePredictions();
            } catch (error) {
                console.error('Error collecting predictive data:', error);
            }
        }, 300000); // 5 minutes
    }

    storeHistoricalData(trafficData, incidents) {
        const timestamp = new Date().toISOString();
        const dataPoint = {
            timestamp: timestamp,
            trafficSegments: trafficData.segments || [],
            incidentCount: incidents.length,
            incidents: incidents,
            averageSpeed: this.calculateAverageSpeed(trafficData.segments),
            congestionLevel: this.calculateOverallCongestion(trafficData.segments),
            hour: new Date().getHours(),
            dayOfWeek: new Date().getDay(),
            weather: 'clear' // Could be enhanced with weather API
        };

        this.historicalData.push(dataPoint);
        
        // Keep only last 7 days of data
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        this.historicalData = this.historicalData.filter(d => 
            new Date(d.timestamp) > weekAgo
        );
    }

    async updatePredictions() {
        if (this.historicalData.length < 10) return; // Need minimum data

        const currentConditions = this.getCurrentConditions();
        const predictions = await this.generatePredictions(currentConditions);
        
        this.predictions = predictions;
        this.processPredictiveWarnings(predictions);
    }

    getCurrentConditions() {
        const latest = this.historicalData[this.historicalData.length - 1];
        return {
            timestamp: latest.timestamp,
            averageSpeed: latest.averageSpeed,
            congestionLevel: latest.congestionLevel,
            incidentCount: latest.incidentCount,
            hour: new Date().getHours(),
            dayOfWeek: new Date().getDay(),
            recentTrend: this.calculateRecentTrend()
        };
    }

    calculateRecentTrend() {
        const recent = this.historicalData.slice(-6); // Last 30 minutes
        if (recent.length < 3) return 'stable';

        const speeds = recent.map(d => d.averageSpeed);
        const firstHalf = speeds.slice(0, Math.floor(speeds.length / 2));
        const secondHalf = speeds.slice(Math.floor(speeds.length / 2));

        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        const change = (secondAvg - firstAvg) / firstAvg;

        if (change < -0.2) return 'deteriorating';
        if (change > 0.2) return 'improving';
        return 'stable';
    }

    async generatePredictions(currentConditions) {
        const predictions = [];

        // Generate predictions for next 60 minutes in 15-minute intervals
        for (let minutesAhead = 15; minutesAhead <= 60; minutesAhead += 15) {
            const predictionTime = new Date(Date.now() + minutesAhead * 60 * 1000);
            const hour = predictionTime.getHours();
            
            const congestionPrediction = this.models.congestion.predict(
                currentConditions, 
                hour, 
                this.historicalData
            );
            
            const speedPrediction = this.models.speed.predict(
                currentConditions,
                hour,
                this.historicalData
            );

            const incidentProbability = this.models.incident.predict(
                currentConditions,
                hour,
                this.historicalData
            );

            predictions.push({
                timestamp: predictionTime.toISOString(),
                minutesAhead: minutesAhead,
                congestionLevel: congestionPrediction.level,
                confidence: congestionPrediction.confidence,
                predictedSpeed: speedPrediction.speed,
                incidentProbability: incidentProbability.probability,
                riskLevel: this.calculateOverallRisk(congestionPrediction, incidentProbability),
                factors: this.identifyRiskFactors(currentConditions, congestionPrediction)
            });
        }

        return predictions;
    }

    calculateOverallRisk(congestionPred, incidentPred) {
        const congestionRisk = this.mapCongestionToRisk(congestionPred.level);
        const incidentRisk = incidentPred.probability;
        
        const combinedRisk = (congestionRisk * 0.7) + (incidentRisk * 0.3);
        
        if (combinedRisk > 0.8) return 'CRITICAL';
        if (combinedRisk > 0.6) return 'HIGH';
        if (combinedRisk > 0.4) return 'MEDIUM';
        return 'LOW';
    }

    mapCongestionToRisk(congestionLevel) {
        const riskMap = {
            low: 0.2,
            medium: 0.4,
            high: 0.7,
            severe: 0.9
        };
        return riskMap[congestionLevel] || 0.3;
    }

    identifyRiskFactors(currentConditions, prediction) {
        const factors = [];

        if (currentConditions.hour >= 7 && currentConditions.hour <= 9) {
            factors.push('Morning rush hour');
        }
        
        if (currentConditions.hour >= 17 && currentConditions.hour <= 19) {
            factors.push('Evening rush hour');
        }

        if (currentConditions.recentTrend === 'deteriorating') {
            factors.push('Deteriorating traffic conditions');
        }

        if (currentConditions.incidentCount > 2) {
            factors.push('Multiple active incidents');
        }

        if (prediction.confidence < 0.6) {
            factors.push('Low prediction confidence');
        }

        // Day of week factors
        if (currentConditions.dayOfWeek === 1 || currentConditions.dayOfWeek === 5) { // Monday or Friday
            factors.push('High traffic day');
        }

        return factors;
    }

    async processPredictiveWarnings(predictions) {
        const highRiskPredictions = predictions.filter(p => 
            p.riskLevel === 'CRITICAL' || p.riskLevel === 'HIGH'
        );

        for (const prediction of highRiskPredictions) {
            const warning = {
                level: prediction.riskLevel === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
                title: 'Predictive Traffic Alert',
                message: `${prediction.riskLevel} traffic conditions expected in ${prediction.minutesAhead} minutes`,
                location: 'City-wide forecast',
                timestamp: new Date().toISOString(),
                type: 'predictive',
                predictionTime: prediction.timestamp,
                factors: prediction.factors,
                confidence: Math.round(prediction.confidence * 100)
            };

            if (window.warningSystem) {
                await window.warningSystem.processWarnings([warning]);
            }
        }
    }

    calculateAverageSpeed(segments) {
        if (!segments || segments.length === 0) return 0;
        const totalSpeed = segments.reduce((sum, segment) => sum + segment.currentSpeed, 0);
        return Math.round(totalSpeed / segments.length);
    }

    calculateOverallCongestion(segments) {
        if (!segments || segments.length === 0) return 'low';
        
        const levelCounts = { low: 0, medium: 0, high: 0, severe: 0 };
        segments.forEach(segment => {
            if (levelCounts.hasOwnProperty(segment.trafficLevel)) {
                levelCounts[segment.trafficLevel]++;
            }
        });

        const total = segments.length;
        if (levelCounts.severe / total > 0.3) return 'severe';
        if (levelCounts.high / total > 0.4) return 'high';
        if (levelCounts.medium / total > 0.5) return 'medium';
        return 'low';
    }

    getPredictionDashboard() {
        if (this.predictions.length === 0) {
            return {
                status: 'Insufficient data for predictions',
                message: 'Collecting historical data...',
                predictions: []
            };
        }

        const nextPrediction = this.predictions[0];
        const riskTrend = this.calculateRiskTrend();

        return {
            status: 'Predictive system active',
            nextPrediction: nextPrediction,
            riskTrend: riskTrend,
            allPredictions: this.predictions,
            dataPoints: this.historicalData.length,
            lastUpdate: new Date().toISOString()
        };
    }

    calculateRiskTrend() {
        if (this.predictions.length < 2) return 'stable';
        
        const risks = this.predictions.map(p => {
            const riskValues = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
            return riskValues[p.riskLevel] || 2;
        });

        const firstHalf = risks.slice(0, Math.floor(risks.length / 2));
        const secondHalf = risks.slice(Math.floor(risks.length / 2));

        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        if (secondAvg > firstAvg + 0.5) return 'increasing';
        if (secondAvg < firstAvg - 0.5) return 'decreasing';
        return 'stable';
    }

    setupPredictionEngine() {
        // Update predictions every 15 minutes
        setInterval(() => {
            this.updatePredictions();
        }, 900000);
    }
}

class CongestionModel {
    predict(currentConditions, targetHour, historicalData) {
        // Find similar historical conditions
        const similarConditions = historicalData.filter(d => 
            Math.abs(d.hour - targetHour) <= 1 &&
            d.dayOfWeek === currentConditions.dayOfWeek
        );

        if (similarConditions.length === 0) {
            return { level: 'medium', confidence: 0.3 };
        }

        // Calculate average congestion for similar conditions
        const congestionLevels = similarConditions.map(d => d.congestionLevel);
        const levelCounts = { low: 0, medium: 0, high: 0, severe: 0 };
        
        congestionLevels.forEach(level => {
            if (levelCounts.hasOwnProperty(level)) {
                levelCounts[level]++;
            }
        });

        const maxCount = Math.max(...Object.values(levelCounts));
        const predictedLevel = Object.keys(levelCounts).find(key => 
            levelCounts[key] === maxCount
        );

        const confidence = Math.min(0.9, similarConditions.length / 20);

        return { 
            level: predictedLevel, 
            confidence: confidence 
        };
    }
}

class SpeedModel {
    predict(currentConditions, targetHour, historicalData) {
        const similarConditions = historicalData.filter(d => 
            Math.abs(d.hour - targetHour) <= 1 &&
            d.dayOfWeek === currentConditions.dayOfWeek
        );

        if (similarConditions.length === 0) {
            return { speed: currentConditions.averageSpeed, confidence: 0.3 };
        }

        const speeds = similarConditions.map(d => d.averageSpeed);
        const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
        
        // Adjust based on current trend
        let adjustedSpeed = avgSpeed;
        if (currentConditions.recentTrend === 'deteriorating') {
            adjustedSpeed *= 0.9;
        } else if (currentConditions.recentTrend === 'improving') {
            adjustedSpeed *= 1.1;
        }

        const confidence = Math.min(0.9, similarConditions.length / 20);

        return { 
            speed: Math.round(adjustedSpeed), 
            confidence: confidence 
        };
    }
}

class IncidentModel {
    predict(currentConditions, targetHour, historicalData) {
        const similarConditions = historicalData.filter(d => 
            Math.abs(d.hour - targetHour) <= 1 &&
            d.dayOfWeek === currentConditions.dayOfWeek
        );

        if (similarConditions.length === 0) {
            return { probability: 0.1, confidence: 0.3 };
        }

        const incidentCounts = similarConditions.map(d => d.incidentCount);
        const avgIncidents = incidentCounts.reduce((a, b) => a + b, 0) / incidentCounts.length;
        
        // Base probability on historical average
        let probability = Math.min(0.8, avgIncidents * 0.1);
        
        // Increase probability during rush hours
        if ((targetHour >= 7 && targetHour <= 9) || (targetHour >= 17 && targetHour <= 19)) {
            probability *= 1.5;
        }

        // Adjust based on current conditions
        if (currentConditions.incidentCount > 2) {
            probability *= 1.2;
        }

        const confidence = Math.min(0.9, similarConditions.length / 20);

        return { 
            probability: Math.min(0.9, probability), 
            confidence: confidence 
        };
    }
}

window.PredictiveWarningSystem = PredictiveWarningSystem;