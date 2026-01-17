# NairobiFlow - 🚦 Intelligent Traffic Management System

[![Docker](https://img.shields.io/badge/Docker-Ready-blue?style=flat-square&logo=docker)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

A comprehensive, production-ready intelligent traffic management system designed specifically for Nairobi metropolitan area. Combines real-time traffic monitoring, predictive analytics, advanced warning systems, and interactive visualization.

## 🌍 Features

### **Live Traffic Mapping**
- Real-time traffic flow visualization with animated indicators
- Color-coded congestion levels (low, medium, high, severe)
- Live incident reporting and alerts
- Traffic hotspot identification
- Interactive traffic density heatmap overlay

### **Advanced Warning System**
- Multi-level alert system (Critical, High, Medium, Low, Info)
- Real-time warning notifications with audio alerts
- Predictive traffic warnings using ML models
- Critical alert overlays for emergency situations
- Automated congestion and incident detection

### **Visual Traffic Analytics**
- Animated traffic flow direction indicators
- Speed-based particle system visualization
- Real-time traffic density gradients
- Dynamic traffic line animations showing flow intensity
- Interactive speed indicators on road segments

### **Nairobi-Specific Data**
- Complete metropolitan area boundaries
- Major roads and highways (Thika Superhighway, Mombasa Road, etc.)
- Key landmarks (JKIA, KICC, shopping malls, parks)
- Traffic hotspots (CBD, Githurai, Westlands)
- Suburban area mapping

### **Interactive Map Controls**
- Layer toggles for different map features
- Route planning with traffic-aware calculations
- Click-to-set waypoints for routing
- Zoom and pan controls with Nairobi bounds

### **Real-Time Data Integration**
- TomTom Traffic API integration
- Live incident data feeds
- Automatic data refresh (30-second intervals)
- WebSocket updates for real-time changes
- Data caching for performance

### **Analytics & Statistics**
- Average speed calculations
- Congestion level analysis
- Incident counting and severity tracking
- Data age monitoring
- Traffic pattern predictions

## 🚀 Quick Start with Docker

### 🐳 One-Command Setup
```bash
# Clone the repository
git clone https://github.com/bucky-ops/nairobiflow-traffic-management.git
cd nairobiflow-traffic-management

# Quick start (interactive)
chmod +x quick-start.sh
./quick-start.sh
```

### 🛠️ Manual Setup
```bash
# Setup environment
cp .env.docker .env
# Edit .env with your API keys

# Development
docker-compose -f docker-compose.dev.yml up -d --build

# Production
docker-compose up -d --build
```

### 🌐 Access Services
- **Application:** http://localhost:3000
- **Database:** localhost:5432 (production) / 5433 (development)
- **Redis:** localhost:6379 (production) / 6380 (development)
- **PgAdmin:** http://localhost:5050 (dev with admin)
- **Monitoring:** http://localhost:9090 (Prometheus) / 3001 (Grafana)

### **Installation**
```bash
# Clone and install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your API keys
# TOMTOM_API_KEY=your_tomtom_api_key
# GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### **Running the System**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

Visit `http://localhost:3000` to access the system.

## 🗺️ API Endpoints

### **Map Data**
- `GET /api/nairobi/boundaries` - Metropolitan area boundaries
- `GET /api/nairobi/landmarks` - Major landmarks and points of interest
- `GET /api/nairobi/roads` - Major road network
- `GET /api/nairobi/hotspots` - Traffic congestion hotspots

### **Live Traffic**
- `GET /api/traffic/live` - Real-time traffic data
- `GET /api/traffic/incidents` - Current traffic incidents
- `GET /api/traffic/route` - Traffic-aware route planning

### **System**
- `GET /api/health` - System health status

## 📍 Nairobi Coverage

### **Metropolitan Boundaries**
- **Coordinates**: -1.4449°S to -1.1629°S, 36.6786°E to 37.0990°E
- **Area**: 696 km²
- **Population**: 10+ million

### **Major Roads Mapped**
- Thika Superhighway (A2) - 8 lanes, 110 km/h
- Mombasa Road (A109) - 6 lanes, 100 km/h  
- Waiyaki Way (A104) - 6 lanes, 80 km/h
- Uhuru Highway - 6 lanes, 70 km/h
- Langata Road, Ngong Road, Jogoo Road
- Outer Ring Road bypass

### **Key Landmarks**
- Jomo Kenyatta International Airport (JKIA)
- Kenyatta International Convention Centre (KICC)
- Nairobi Railway Station
- Nairobi National Park
- Major shopping malls (Two Rivers, Thika Road Mall)
- Tourist attractions (Giraffe Centre, Karen Blixen Museum)

### **Traffic Hotspots**
- CBD Area (High congestion, 7-9am & 5-7pm peaks)
- Thika Road - Githurai (Severe congestion)
- Mombasa Road - Nyayo Stadium (High congestion)
- Waiyaki Way - Westlands (Medium congestion)

## 🔧 Configuration

### **Environment Variables**
```bash
PORT=3000
TOMTOM_API_KEY=your_tomtom_api_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
MAPBOX_ACCESS_TOKEN=your_mapbox_access_token
CACHE_TTL=300
WS_PORT=3001
```

### **API Setup**
1. **TomTom API**: Get free API key at https://developer.tomtom.com/
2. **Google Maps**: Optional backup, get key at https://developers.google.com/maps
3. **Mapbox**: Optional alternative tiles, get token at https://mapbox.com/

## 🎮 Usage Guide

### **Map Navigation**
- **Zoom**: Mouse wheel or +/- buttons
- **Pan**: Click and drag
- **Bounds**: Automatically limited to Nairobi metropolitan area

### **Layer Controls**
- **Live Traffic**: Real-time traffic flow overlay
- **Road Network**: Major roads and highways
- **Landmarks**: Points of interest and landmarks
- **Traffic Incidents**: Current accidents and disruptions
- **Traffic Hotspots**: Known congestion areas

### **Route Planning**
1. Click "Starting point" input or click on map
2. Click "Destination" input or click on map  
3. Click "Calculate Route" for traffic-aware routing
4. View travel time, distance, and delay information

### **Keyboard Shortcuts**
- `Ctrl+R`: Refresh data
- `Ctrl+L`: Toggle traffic layer
- `Ctrl+I`: Toggle incidents layer
- `Escape`: Clear current route

## 📊 Data Sources

### **Primary: TomTom Traffic API**
- Real-time traffic flow data
- Incident reporting
- Route calculations
- 30-second refresh intervals

### **Fallback Systems**
- Cached data when API unavailable
- Static Nairobi mapping data
- Historical traffic patterns

## 🔄 Real-Time Features

### **WebSocket Updates**
- Live traffic updates every 30 seconds
- Instant incident notifications
- Real-time statistics refresh
- Automatic map layer updates
- **Predictive Analytics**: ML-based traffic predictions up to 60 minutes ahead
- **Advanced Visualizations**: Animated traffic flow with particle effects
- **Warning System**: Multi-tier alert system with audio notifications

### **Data Caching**
- 5-minute cache TTL for API responses
- Reduces API calls and improves performance
- Fallback to cached data during outages

## 🛠️ Technologies Used

### **Backend**
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Socket.io** - Real-time WebSocket communication
- **Axios** - HTTP client for API calls
- **NodeCache** - In-memory caching

### **Frontend**
- **Leaflet.js** - Interactive mapping
- **OpenStreetMap** - Base map tiles
- **Socket.io Client** - Real-time updates
- **Vanilla JavaScript** - No framework dependencies

### **Data APIs**
- **TomTom Traffic API** - Primary traffic data
- **Google Maps API** - Optional backup
- **OpenStreetMap** - Base mapping data

## 📱 Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues and questions:
- Create GitHub issue
- Check API key configuration
- Verify network connectivity
- Review browser console for errors# nairobiflow-traffic-management
