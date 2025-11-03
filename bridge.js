// PreSonus API Bridge Process
// This runs as a separate Node.js process with the real PreSonus API
// Communicates with C# wrapper via stdio JSON-RPC

const { Client, Discovery } = require('./dist/cjs/api.js');
const domain = require('domain');

class PreSonusApiBridge {
    constructor() {
        this.clients = new Map(); // clientId -> Client instance
        this.discoveries = new Map(); // discoveryId -> Discovery instance
        this.requestId = 0;
        
        // Set up stdio communication
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (data) => {
            try {
                const lines = data.trim().split('\n');
                for (const line of lines) {
                    if (line.trim()) {
                        this.handleRequest(JSON.parse(line));
                    }
                }
            } catch (error) {
                this.sendError(null, `Parse error: ${error.message}`);
            }
        });
        
        this.sendResponse(null, { 
            type: 'ready', 
            message: 'PreSonus API Bridge ready',
            pid: process.pid
        });
    }
    
    handleRequest(request) {
        const { id, method, params = {} } = request;
        
        try {
            switch (method) {
                case 'discovery.start':
                    this.startDiscovery(id, params);
                    break;
                    
                case 'discovery.stop':
                    this.stopDiscovery(id, params);
                    break;
                    
                case 'client.create':
                    this.createClient(id, params);
                    break;
                    
                case 'client.connect':
                    this.connectClient(id, params);
                    break;
                    
                case 'client.close':
                    this.closeClient(id, params);
                    break;
                    
                case 'client.setMute':
                    this.setMute(id, params);
                    break;
                    
                case 'client.getMute':
                    this.getMute(id, params);
                    break;
                    
                case 'client.setChannelVolume':
                    this.setChannelVolume(id, params);
                    break;
                    
                case 'mixer.setChannelProperty':
                    this.setChannelProperty(id, params);
                    break;
                    
                case 'mixer.getChannelProperty':
                    this.getChannelProperty(id, params);
                    break;
                    
                case 'mixer.setChannelPan':
                    this.setChannelPan(id, params);
                    break;
                    
                case 'mixer.getChannelPan':
                    this.getChannelPan(id, params);
                    break;
                    
                default:
                    this.sendError(id, `Unknown method: ${method}`);
            }
        } catch (error) {
            this.sendError(id, `Method error: ${error.message}`);
        }
    }
    
    async startDiscovery(requestId, { discoveryId, timeout = 10000 }) {
        try {
            // Use static Client.discover method that we know works
            const devices = await Client.discover(timeout);
            const deviceArray = Object.values(devices);
            
            this.sendResponse(requestId, {
                type: 'discovery.devices',
                discoveryId,
                devices: deviceArray.map(d => ({
                    name: d.name,
                    ip: d.ip,
                    port: d.port,
                    serial: d.serial
                }))
            });
        } catch (error) {
            this.sendError(requestId, `Discovery failed: ${error.message}`);
        }
    }
    
    stopDiscovery(requestId, { discoveryId }) {
        // Discovery automatically stops after timeout
        this.sendResponse(requestId, { 
            type: 'discovery.stopped', 
            discoveryId 
        });
    }
    
    createClient(requestId, { clientId, host, port, options = {} }) {
        try {
            // Create a domain to isolate client operations and catch all errors
            const clientDomain = domain.create();
            const bridge = this;
            
            clientDomain.on('error', (error) => {
                console.error(`Client ${clientId} domain error:`, error.message);
                console.error('Stack:', error.stack);
                
                // Send error event but don't crash the bridge
                bridge.sendEvent('client.processing.error', { 
                    clientId, 
                    error: error.message,
                    stack: error.stack
                });
                
                // Clean up client if error is fatal
                if (bridge.clients.has(clientId)) {
                    const client = bridge.clients.get(clientId);
                    try {
                        client.close();
                    } catch (closeError) {
                        console.error(`Error closing client ${clientId}:`, closeError.message);
                    }
                    bridge.clients.delete(clientId);
                    bridge.sendEvent('client.closed', { clientId, reason: 'error' });
                }
            });
            
            // Run client creation within the domain
            clientDomain.run(() => {
                const client = new Client({ host, port }, {
                    autoreconnect: false,
                    logLevel: 'error', // Use 'error' instead of 'silent' 
                    timeout: 5000, // Shorter timeout to avoid hanging on bad data
                    receiveTimeout: 5000, // Timeout for data reception
                    ...options
                });
                
                // Set up event forwarding
                client.on('connected', () => {
                    this.sendEvent('client.connected', { clientId });
                });
                
                client.on('closed', () => {
                    this.sendEvent('client.closed', { clientId });
                    this.clients.delete(clientId);
                });
                
                client.on('error', (error) => {
                    this.sendEvent('client.error', { 
                        clientId, 
                        error: error.message 
                    });
                });
                
                // Store both client and domain
                client._domain = clientDomain;
                this.clients.set(clientId, client);
                
                this.sendResponse(requestId, { 
                    type: 'client.created', 
                    clientId 
                });
            });
        } catch (error) {
            this.sendError(requestId, `Client creation failed: ${error.message}`);
        }
    }
    
    async connectClient(requestId, { clientId, subscriptionOptions = {} }) {
        try {
            const client = this.clients.get(clientId);
            if (!client) {
                throw new Error(`Client ${clientId} not found`);
            }
            
            // Run connect operation within the client's domain
            const connectPromise = client._domain ? 
                client._domain.bind(async () => {
                    return await client.connect({
                        clientDescription: 'PreSonus C# Wrapper Bridge',
                        ...subscriptionOptions
                    });
                })() :
                client.connect({
                    clientDescription: 'PreSonus C# Wrapper Bridge',
                    ...subscriptionOptions
                });
            
            await connectPromise;
            
            this.sendResponse(requestId, { 
                type: 'client.connected', 
                clientId 
            });
        } catch (error) {
            this.sendError(requestId, `Client connect failed: ${error.message}`);
        }
    }
    
    async closeClient(requestId, { clientId }) {
        try {
            const client = this.clients.get(clientId);
            if (client) {
                await client.close();
                this.clients.delete(clientId);
            }
            
            this.sendResponse(requestId, { 
                type: 'client.closed', 
                clientId 
            });
        } catch (error) {
            this.sendError(requestId, `Client close failed: ${error.message}`);
        }
    }
    
    setMute(requestId, { clientId, selector, muted }) {
        try {
            const client = this.clients.get(clientId);
            if (!client) {
                throw new Error(`Client ${clientId} not found`);
            }
            
            // Run within client's domain if available
            if (client._domain) {
                client._domain.run(() => {
                    client.setMute(selector, muted);
                });
            } else {
                client.setMute(selector, muted);
            }
            
            this.sendResponse(requestId, { 
                type: 'client.mute.set', 
                clientId, 
                selector, 
                muted 
            });
        } catch (error) {
            this.sendError(requestId, `Set mute failed: ${error.message}`);
        }
    }
    
    getMute(requestId, { clientId, selector }) {
        try {
            const client = this.clients.get(clientId);
            if (!client) {
                throw new Error(`Client ${clientId} not found`);
            }
            
            let muted;
            
            // Run within client's domain if available
            if (client._domain) {
                client._domain.run(() => {
                    muted = client.getMute(selector);
                });
            } else {
                muted = client.getMute(selector);
            }
            
            this.sendResponse(requestId, { 
                type: 'client.mute.status', 
                clientId, 
                selector, 
                muted 
            });
        } catch (error) {
            this.sendError(requestId, `Get mute failed: ${error.message}`);
        }
    }
    
    async setChannelVolume(requestId, { clientId, selector, level, duration }) {
        try {
            const client = this.clients.get(clientId);
            if (!client) {
                throw new Error(`Client ${clientId} not found`);
            }
            
            await client.setChannelVolumeLinear(selector, level, duration);
            
            this.sendResponse(requestId, { 
                type: 'client.volume.set', 
                clientId, 
                selector, 
                level 
            });
        } catch (error) {
            this.sendError(requestId, `Set volume failed: ${error.message}`);
        }
    }
    
    // Enhanced mixer control methods using real UBJSON parsing infrastructure
    
    async setChannelProperty(requestId, { clientId, channelType, channelNumber, property, value }) {
        try {
            const client = this.clients.get(clientId);
            if (!client) {
                throw new Error(`Client ${clientId} not found`);
            }
            
            // Create property path based on scene file structure
            // e.g., "line.ch1.mute", "line.ch2.volume", "line.ch3.pan"
            const propertyPath = `${channelType}.ch${channelNumber}.${property}`;
            console.log(`🎛️  Setting ${propertyPath} = ${value}`);
            
            // Use the working client infrastructure to set the property
            // This leverages our successful UBJSON parsing 
            if (client._domain) {
                client._domain.run(() => {
                    client.setPropertyValue(propertyPath, value);
                });
            } else {
                client.setPropertyValue(propertyPath, value);
            }
            
            this.sendResponse(requestId, { 
                type: 'mixer.property.set', 
                clientId, 
                channelType,
                channelNumber,
                property,
                value,
                path: propertyPath
            });
            
        } catch (error) {
            this.sendError(requestId, `Set channel property failed: ${error.message}`);
        }
    }
    
    async getChannelProperty(requestId, { clientId, channelType, channelNumber, property }) {
        try {
            const client = this.clients.get(clientId);
            if (!client) {
                throw new Error(`Client ${clientId} not found`);
            }
            
            // Create property path based on scene file structure
            const propertyPath = `${channelType}.ch${channelNumber}.${property}`;
            console.log(`📊 Getting ${propertyPath}`);
            
            let value;
            
            // Use the working client infrastructure to get the property
            // This leverages our successful UBJSON parsing
            if (client._domain) {
                client._domain.run(() => {
                    value = client.getPropertyValue(propertyPath);
                });
            } else {
                value = client.getPropertyValue(propertyPath);
            }
            
            this.sendResponse(requestId, { 
                type: 'mixer.property.get', 
                clientId, 
                channelType,
                channelNumber,
                property,
                value,
                path: propertyPath
            });
            
        } catch (error) {
            this.sendError(requestId, `Get channel property failed: ${error.message}`);
        }
    }
    
    async setChannelPan(requestId, { clientId, channelNumber, panPosition }) {
        try {
            const client = this.clients.get(clientId);
            if (!client) {
                throw new Error(`Client ${clientId} not found`);
            }
            
            // Use specific pan setting method based on scene file structure
            const selector = { type: 'LINE', channel: channelNumber };
            
            if (client._domain) {
                client._domain.run(() => {
                    client.setChannelPan(selector, panPosition);
                });
            } else {
                client.setChannelPan(selector, panPosition);
            }
            
            this.sendResponse(requestId, { 
                type: 'mixer.pan.set', 
                clientId, 
                channelNumber,
                panPosition 
            });
            
        } catch (error) {
            this.sendError(requestId, `Set channel pan failed: ${error.message}`);
        }
    }
    
    async getChannelPan(requestId, { clientId, channelNumber }) {
        try {
            const client = this.clients.get(clientId);
            if (!client) {
                throw new Error(`Client ${clientId} not found`);
            }
            
            const selector = { type: 'LINE', channel: channelNumber };
            let panPosition;
            
            if (client._domain) {
                client._domain.run(() => {
                    panPosition = client.getChannelPan(selector);
                });
            } else {
                panPosition = client.getChannelPan(selector);
            }
            
            this.sendResponse(requestId, { 
                type: 'mixer.pan.get', 
                clientId, 
                channelNumber,
                panPosition 
            });
            
        } catch (error) {
            this.sendError(requestId, `Get channel pan failed: ${error.message}`);
        }
    }
    
    sendResponse(requestId, result) {
        const response = { 
            id: requestId, 
            result,
            timestamp: Date.now()
        };
        console.log(JSON.stringify(response));
    }
    
    sendError(requestId, error) {
        const response = { 
            id: requestId, 
            error,
            timestamp: Date.now()
        };
        console.log(JSON.stringify(response));
    }
    
    sendEvent(event, data) {
        const message = { 
            type: 'event', 
            event, 
            data,
            timestamp: Date.now()
        };
        console.log(JSON.stringify(message));
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.error('Bridge shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.error('Bridge shutting down...');
    process.exit(0);
});

// Start the bridge
const bridge = new PreSonusApiBridge();

// Handle uncaught exceptions to prevent bridge crashes
process.on('uncaughtException', (error, origin) => {
    console.error('Uncaught Exception in PreSonus API Bridge:', error.message);
    console.error('Origin:', origin);
    console.error('Stack:', error.stack);
    
    // Send error event if bridge is available, but don't crash
    try {
        if (bridge) {
            bridge.sendEvent('bridge.error', {
                type: 'uncaught_exception',
                message: error.message,
                stack: error.stack,
                origin: origin
            });
        }
    } catch (eventError) {
        console.error('Failed to send error event:', eventError.message);
    }
    
    // CRITICAL: Prevent process exit by not calling process.exit()
    // Note: This keeps the process running despite the exception
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection in PreSonus API Bridge:', reason);
    
    // Send error event if bridge is available, but don't crash
    try {
        if (bridge) {
            bridge.sendEvent('bridge.error', {
                type: 'unhandled_rejection',
                message: reason?.message || String(reason),
                stack: reason?.stack
            });
        }
    } catch (eventError) {
        console.error('Failed to send error event:', eventError.message);
    }
    
    // Continue running - don't exit the process
});

// Handle warning events to catch any other issues
process.on('warning', (warning) => {
    console.warn('Process Warning:', warning.name, warning.message);
    if (bridge) {
        try {
            bridge.sendEvent('bridge.warning', {
                type: 'process_warning',
                name: warning.name,
                message: warning.message,
                stack: warning.stack
            });
        } catch (eventError) {
            console.error('Failed to send warning event:', eventError.message);
        }
    }
});