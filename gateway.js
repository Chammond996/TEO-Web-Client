const WebSocket = require("ws");
const net = require("net");

const WS_PORT = 63370;
const SERVER_HOST = "localhost";
const SERVER_PORT = 63369;

const wss = new WebSocket.Server({ port: WS_PORT });

let nextClientId = 1;
const clients = new Map();

console.log(`[Gateway] WebSocket server listening on port ${WS_PORT}`);
console.log(`[Gateway] Proxying to C++ server at ${SERVER_HOST}:${SERVER_PORT}`);

wss.on("connection", (ws) => {
    const clientId = nextClientId++;
    console.log(`[Gateway] New WebSocket connection: client-${clientId}`);

    // Create TCP connection to C++ server
    const tcpSocket = new net.Socket();
    const clientInfo = { ws, tcpSocket, clientId };
    clients.set(clientId, clientInfo);

    tcpSocket.connect(SERVER_PORT, SERVER_HOST, () => {
        console.log(`[Gateway] Connected to C++ server for client-${clientId}`);
    });

    // Handle incoming messages from WebSocket (browser)
    ws.on("message", (data) => {
        if (tcpSocket.writable) {
            tcpSocket.write(data);
            console.log(`[Gateway] WebSocket -> TCP (client-${clientId}): ${data.length} bytes`);
        }
    });

    // Handle data from TCP (C++ server)
    tcpSocket.on("data", (data) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(data, { binary: true });
            console.log(`[Gateway] TCP -> WebSocket (client-${clientId}): ${data.length} bytes`);
        }
    });

    // Handle errors
    ws.on("error", (error) => {
        console.error(`[Gateway] WebSocket error (client-${clientId}):`, error.message);
        tcpSocket.destroy();
        clients.delete(clientId);
    });

    ws.on("close", () => {
        console.log(`[Gateway] WebSocket closed (client-${clientId})`);
        tcpSocket.destroy();
        clients.delete(clientId);
    });

    tcpSocket.on("error", (error) => {
        console.error(`[Gateway] TCP error (client-${clientId}):`, error.message);
        ws.close();
        clients.delete(clientId);
    });

    tcpSocket.on("close", () => {
        console.log(`[Gateway] TCP connection closed (client-${clientId})`);
        if (ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
        clients.delete(clientId);
    });
});

console.log("[Gateway] Ready to accept connections");
