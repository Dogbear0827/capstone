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
    // 輸出收到的請求 URL
    console.log('request received: ' + request.url);

    // 根據 URL 選擇文件路徑
    let filePath = request.url === '/' ? 'index.html' : `client${request.url}`;
    const extName = extname(filePath); // 獲取文件的副檔名
    let contentType = 'text/html'; // 預設內容類型為 HTML

    // 根據副檔名決定對應的內容類型
    switch (extName) {
        case '.js':
            contentType = 'application/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
    }

    // 讀取對應的靜態文件並回傳
    readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // 檔案未找到
                response.writeHead(404, { 'Content-Type': 'text/html' });
                response.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                // 伺服器錯誤
                response.writeHead(500);
                response.end(`Server Error: ${error.code}`);
            }
        } else {
            // 成功讀取檔案並回傳
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf-8');
        }
    });
}

// 創建 HTTPS 伺服器並啟動
const httpsServer = createServer(
    {
        key: readFileSync('/etc/letsencrypt/live/stream-capstone.us.kg-0001/privkey.pem'), // SSL 私鑰
        cert: readFileSync('/etc/letsencrypt/live/stream-capstone.us.kg-0001/cert.pem'), // SSL 證書
    },
    handleRequest // 處理 HTTP 請求的回調函式
);
httpsServer.listen(HTTPS_PORT, '0.0.0.0'); // 在所有網絡介面上監聽 HTTPS 端口

// ----------------------------------------------------------------------------------------

// 創建 WebSocket 伺服器，並與 HTTPS 伺服器一起運行
const wss = new WebSocketServer({ server: httpsServer });

// 當有用戶連接時，處理來自該用戶的訊息
wss.on('connection', (ws) => {
    // 當用戶發送訊息時，處理收到的訊息
    ws.on('message', (message) => {
        let data;

        // 嘗試解析接收到的 JSON 格式的訊息，若格式錯誤則捕獲異常並返回錯誤訊息
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.log('Invalid JSON');
            sendTo(ws, { type: 'error', message: 'Invalid message format' });
            return;
        }

        console.log('received data:', data);

        switch (data.type) {
            // 當用戶嘗試登入時
            case 'login': {
                console.log('User login attempt:', data.name);

                // 如果用戶名稱已存在，返回登入失敗
                if (users[data.name]) {
                    sendTo(ws, { type: 'login', success: false, message: 'Username already taken' });
                    return;
                }

                // 儲存用戶的 WebSocket 連接並標記為在線
                users[data.name] = ws;
                allUsers.add(data.name);
                ws.name = data.name;

                // 返回登入成功訊息及在線用戶列表
                sendTo(ws, {
                    type: 'login',
                    success: true,
                    allUsers: Array.from(allUsers),
                });

                // 通知其他用戶有新用戶加入
                notifyUsersChange(data.name);
                break;
            }

            // 當主播開始分享媒體時，通知所有觀眾
            case 'share': {
                if (ws.name) {
                    console.log(`${ws.name} started streaming`);

                    // 儲存主播與房間代碼的對應關係
                    const roomCode = data.roomCode;
                    roomStreamers[roomCode] = ws;

                    // 將主播的訊息發送給所有觀眾
                    for (const user in users) {
                        if (user !== ws.name) {
                            sendTo(users[user], {
                                type: 'stream',  // 訊息類型為「stream」，表示主播開始直播
                                streamer: ws.name,  // 轉發主播的名稱
                                roomCode: roomCode, // 傳送房間代碼給觀眾
                            });
                        }
                    }
                }
                break;
            }

            // 處理觀眾嘗試連接到主播的請求
            case 'connect-to-streamer': {
                const roomCode = data.code;  // 獲取觀眾請求的房間代碼
                const streamerSocket = roomStreamers[roomCode];  // 根據房間代碼查找對應的主播 WebSocket

                if (streamerSocket) {
                    // 發送訊息通知主播有觀眾想要連接
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

            // 處理 offer，並轉發給觀眾
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

            // 處理 answer，並轉發給主播
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

            // ICE候選的處理
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

    // 當 WebSocket 連線關閉時，進行清理操作
    ws.on('close', () => {
        if (ws.name && users[ws.name]) {
            // 刪除用戶連接
            delete users[ws.name];
            allUsers.delete(ws.name);
            delete streamerSockets[ws.name];

            // 針對每個房間代碼，清理對應的主播 WebSocket
            for (const roomCode in roomStreamers) {
                if (roomStreamers[roomCode] === ws) {
                    delete roomStreamers[roomCode];
                }
            }

            // 通知其他用戶更新在線用戶列表
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
