class UIManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupKeyboardShortcuts();
        this.setupResponsiveDesign();
        this.addAnimations();
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'r':
                        e.preventDefault();
                        this.refreshData();
                        break;
                    case 'l':
                        e.preventDefault();
                        this.toggleLayer('traffic');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.toggleLayer('incidents');
                        break;
                }
            }

            if (e.key === 'Escape') {
                this.clearRoute();
            }
        });
    }

    setupResponsiveDesign() {
        const handleResize = () => {
            const isMobile = window.innerWidth < 768;
            const sidebar = document.querySelector('.sidebar');
            
            if (isMobile) {
                sidebar.style.width = '100%';
                sidebar.style.position = 'absolute';
                sidebar.style.zIndex = '999';
                sidebar.style.transform = 'translateX(-100%)';
                sidebar.style.transition = 'transform 0.3s ease';
            } else {
                sidebar.style.width = '350px';
                sidebar.style.position = 'relative';
                sidebar.style.transform = 'translateX(0)';
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize();
    }

    addAnimations() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }

            .layer-item {
                transition: all 0.3s ease;
            }

            .layer-item:hover {
                transform: translateX(5px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }

            .stat-item {
                transition: transform 0.2s ease;
            }

            .stat-item:hover {
                transform: scale(1.05);
            }

            .incident-item {
                animation: fadeInUp 0.5s ease;
            }

            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .btn {
                transition: all 0.2s ease;
            }

            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 12px rgba(102, 126, 234, 0.3);
            }

            .btn:active {
                transform: translateY(0);
            }

            .toggle-switch {
                transition: background 0.3s ease;
            }

            .toggle-switch:hover {
                opacity: 0.8;
            }

            .loading-overlay {
                transition: opacity 0.3s ease;
            }

            .legend {
                animation: slideInRight 0.5s ease;
            }

            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }

    refreshData() {
        window.trafficMap.updateTrafficData();
        window.trafficMap.updateIncidents();
        window.trafficManager.refreshData();
        
        this.showNotification('Data refreshed', 'success');
    }

    toggleLayer(layerName) {
        const toggleElement = document.getElementById(`${layerName}-toggle`);
        if (toggleElement) {
            toggleElement.click();
        }
    }

    clearRoute() {
        window.trafficManager.clearRoute();
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span>${this.getNotificationIcon(type)}</span>
                <span>${message}</span>
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${this.getNotificationColor(type)};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 3000;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            animation: slideIn 0.3s ease;
            min-width: 250px;
            font-size: 14px;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    getNotificationColor(type) {
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#667eea'
        };
        return colors[type] || colors.info;
    }

    updateTheme(theme) {
        if (theme === 'dark') {
            document.body.style.background = '#1a1a1a';
            document.body.style.color = '#ffffff';
        } else {
            document.body.style.background = '#ffffff';
            document.body.style.color = '#333333';
        }
    }

    exportData() {
        const data = {
            timestamp: new Date().toISOString(),
            trafficData: window.trafficMap.currentData,
            incidents: window.trafficManager.incidents,
            statistics: window.trafficManager.statistics
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nairobi-traffic-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('Data exported successfully', 'success');
    }

    printMap() {
        window.print();
        this.showNotification('Print dialog opened', 'info');
    }

    shareLocation() {
        if (navigator.share) {
            navigator.share({
                title: 'Nairobi Traffic Analysis',
                text: 'Check out the current traffic conditions in Nairobi',
                url: window.location.href
            }).then(() => {
                this.showNotification('Location shared successfully', 'success');
            }).catch((error) => {
                console.log('Share failed:', error);
            });
        } else {
            navigator.clipboard.writeText(window.location.href).then(() => {
                this.showNotification('Link copied to clipboard', 'success');
            });
        }
    }

    addCustomControls() {
        const customControls = L.control({ position: 'topright' });
        
        customControls.onAdd = (map) => {
            const div = L.DomUtil.create('div', 'custom-controls');
            div.style.cssText = `
                background: rgba(45, 45, 45, 0.9);
                padding: 10px;
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                gap: 5px;
            `;

            const buttons = [
                { text: '🔄 Refresh', action: () => this.refreshData() },
                { text: '📊 Export', action: () => this.exportData() },
                { text: '🖨️ Print', action: () => this.printMap() },
                { text: '🔗 Share', action: () => this.shareLocation() }
            ];

            buttons.forEach(button => {
                const btn = document.createElement('button');
                btn.textContent = button.text;
                btn.style.cssText = `
                    background: #667eea;
                    color: white;
                    border: none;
                    padding: 5px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: background 0.2s;
                `;
                
                btn.addEventListener('click', button.action);
                btn.addEventListener('mouseenter', () => {
                    btn.style.background = '#764ba2';
                });
                btn.addEventListener('mouseleave', () => {
                    btn.style.background = '#667eea';
                });

                div.appendChild(btn);
            });

            return div;
        };

        window.trafficMap.map.addControl(customControls);
    }
}

window.UIManager = UIManager;