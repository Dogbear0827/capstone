const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// 創建 HTTP 伺服器，用於提供靜態文件
const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './login.html'; // 預設加載 login.html
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('404: File Not Found', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('500: Internal Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// 創建 WebSocket 伺服器
const wss = new WebSocket.Server({ server });

// 存儲 streamer 和 watcher 的 socket
let streamerSocket = null;
const watchers = new Set();

wss.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('message', (message) => {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'register':
                if (data.role === 'streamer') {
                    streamerSocket = socket;
                    console.log('Streamer registered');
                } else if (data.role === 'watcher') {
                    watchers.add(socket);
                    console.log('Watcher registered');
                    // 如果有直播主存在，立即發送 offer 給新註冊的觀眾
                    if (streamerSocket && streamerSocket.readyState === WebSocket.OPEN) {
                        streamerSocket.send(JSON.stringify({ type: 'new-watcher' }));
                    }
                }
                break;
            case 'offer':
                // 將 offer 傳給所有的觀眾
                watchers.forEach(watcher => {
                    if (watcher.readyState === WebSocket.OPEN) {
                        watcher.send(JSON.stringify(data));
                    }
                });
                break;
            case 'candidate':
                // 將 ICE 候選者傳給對方
                if (data.role === 'streamer') {
                    // 如果是來自直播主，傳給所有觀眾
                    watchers.forEach(watcher => {
                        if (watcher.readyState === WebSocket.OPEN) {
                            watcher.send(JSON.stringify(data));
                        }
                    });
                } else if (data.role === 'watcher') {
                    // 如果是來自觀眾，傳給直播主
                    if (streamerSocket && streamerSocket.readyState === WebSocket.OPEN) {
                        streamerSocket.send(JSON.stringify(data));
                    }
                }
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    });

    socket.on('close', () => {
        console.log('Client disconnected');
        if (socket === streamerSocket) {
            console.log('Streamer disconnected');
            streamerSocket = null;
        } else if (watchers.has(socket)) {
            watchers.delete(socket);
            console.log('Watcher disconnected');
        }
    });
});

// 啟動伺服器，並綁定到指定的端口
server.listen(8080, () => {
    console.log('HTTP server and WebSocket server are running on http://localhost:8080');
});
