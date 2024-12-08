// 引入必要的模組
import { readFile, readFileSync } from 'fs'; // 檔案處理模組
import { extname } from 'path'; // 路徑處理模組
import { createServer } from 'https'; // HTTPS 伺服器模組
import WebSocket, { WebSocketServer } from 'ws'; // WebSocket 模組

// 設定 HTTPS 伺服器的端口
const HTTPS_PORT = 8080;

// 用來儲存用戶的 WebSocket 連接
let users = {};  // 儲存用戶名稱與對應的 WebSocket 連接
let allUsers = new Set();  // 儲存所有在線的用戶名稱（包括主播與觀眾）
let streamerSockets = {}; // 儲存每個主播的 WebSocket 連接
let roomStreamers = {};  // 儲存每個房間代碼對應的主播 WebSocket 連接

// 處理 HTTP 請求並回傳相應的靜態文件
function handleRequest(request, response) {
    console.log('request received: ' + request.url);

    let filePath;
    if (request.url === '/') {
        filePath = '/etc/www/html/webrtc/streamer.html'; // 根路徑請求返回 streamer.html
    } else if (request.url === '/viewer') {
        filePath = '/etc/www/html/webrtc/viewer.html'; // 當請求 /viewer 時返回 viewer.html
    } else {
        filePath = `/etc/www/html/webrtc${request.url}`;
    }

    const extName = extname(filePath); 
    let contentType = 'text/html'; 

    switch (extName) {
        case '.js':
            contentType = 'application/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
    }

    readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                response.writeHead(404, { 'Content-Type': 'text/html' });
                response.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                response.writeHead(500);
                response.end(`Server Error: ${error.code}`);
            }
        } else {
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf-8');
        }
    });
}

// 創建 HTTPS 伺服器並啟動
const httpsServer = createServer(
    {
        key: readFileSync('/etc/letsencrypt/live/stream-capstone.us.kg-0001/privkey.pem'),
        cert: readFileSync('/etc/letsencrypt/live/stream-capstone.us.kg-0001/cert.pem'),
    },
    handleRequest
);
httpsServer.listen(HTTPS_PORT, '0.0.0.0');

// 創建 WebSocket 伺服器，並與 HTTPS 伺服器一起運行
const wss = new WebSocketServer({ server: httpsServer });

// 當有用戶連接時，處理來自該用戶的訊息
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        let data;

        // 嘗試解析接收到的 JSON 格式的訊息
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.log('Invalid JSON');
            sendTo(ws, { type: 'error', message: 'Invalid message format' });
            return;
        }

        console.log('received data:', data);

        switch (data.type) {
            case 'login': {
                console.log('User login attempt:', data.name);

                if (users[data.name]) {
                    sendTo(ws, { type: 'login', success: false, message: 'Username already taken' });
                    return;
                }

                users[data.name] = ws;
                allUsers.add(data.name);
                ws.name = data.name;

                sendTo(ws, {
                    type: 'login',
                    success: true,
                    allUsers: Array.from(allUsers),
                });

                notifyUsersChange(data.name);
                break;
            }

            case 'share': {
                if (ws.name) {
                    console.log(`${ws.name} started streaming`);

                    const roomCode = ws.name; // 使用主播名稱作為房間代碼
                    roomStreamers[roomCode] = ws;

                    // 通知所有觀眾
                    for (const user in users) {
                        if (user !== ws.name) {
                            sendTo(users[user], {
                                type: 'stream',
                                streamer: ws.name,
                                roomCode: roomCode,
                            });
                        }
                    }
                }
                break;
            }

            case 'connect-to-streamer': {
                const roomCode = data.roomCode;  
                const streamerSocket = roomStreamers[roomCode];  

                if (streamerSocket) {
                    sendTo(streamerSocket, {
                        type: 'viewer-wants-to-connect',
                        viewer: ws.name
                    });
                    console.log(`${ws.name} 正在嘗試連接到 ${streamerSocket.name}`);
                } else {
                    sendTo(ws, {
                        type: 'error',
                        message: `找不到主播 ${roomCode}`
                    });
                }
                break;
            }

            case 'offer': {
                const roomCode = data.roomCode;
                const streamerSocket = roomStreamers[roomCode];

                if (streamerSocket) {
                    sendTo(streamerSocket, {
                        type: 'offer',
                        offer: data.offer,
                        streamer: ws.name,
                    });
                }
                break;
            }

            case 'answer': {
                const roomCode = data.roomCode;
                const streamerSocket = roomStreamers[roomCode];

                if (streamerSocket) {
                    sendTo(streamerSocket, {
                        type: 'answer',
                        answer: data.answer,
                        viewer: ws.name,
                    });
                }
                break;
            }

            case 'candidate': {
                const roomCode = data.roomCode;
                const streamerSocket = roomStreamers[roomCode];

                if (streamerSocket) {
                    sendTo(streamerSocket, {
                        type: 'candidate',
                        candidate: data.candidate,
                        streamer: ws.name,
                    });
                }
                break;
            }

            default: {
                sendTo(ws, { type: 'error', message: 'Command not found: ' + data.type });
            }
        }
    });

    ws.on('close', () => {
        if (ws.name && users[ws.name]) {
            delete users[ws.name];
            allUsers.delete(ws.name);
            delete streamerSockets[ws.name];

            // 清除房間代碼對應的主播 WebSocket
            for (const roomCode in roomStreamers) {
                if (roomStreamers[roomCode] === ws) {
                    delete roomStreamers[roomCode];
                }
            }

            notifyUsersChange(ws.name);
            console.log(`${ws.name} has disconnected`);
        }
    });
});

// 發送訊息給指定的 WebSocket 連接
function sendTo(connection, message) {
    try {
        connection.send(JSON.stringify(message));
    } catch (error) {
        console.error('Error sending message:', error);
        connection.send(JSON.stringify({ type: 'error', message: 'Failed to send message' }));
    }
}

// 通知所有用戶在線用戶列表的變更
function notifyUsersChange(newUser) {
    for (const user of allUsers) {
        if (user !== newUser) {
            sendTo(users[user], {
                type: 'users',
                users: Array.from(allUsers),
                updatedUser: newUser,
            });
        }
    }
}

// 伺服器啟動後，輸出提示訊息
console.log(`Server running. Visit https://localhost:${HTTPS_PORT}`);
