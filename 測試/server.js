// 引入必要的模組
import { readFile, readFileSync } from 'fs'; // 檔案處理模組
import { extname } from 'path'; // 路徑處理模組
import { createServer } from 'https'; // HTTPS 伺服器模組
import WebSocket, { WebSocketServer } from 'ws'; // WebSocket 模組

// 設定 HTTPS 伺服器的端口
const HTTPS_PORT = 8080;

// 用來儲存連線的用戶資訊
/**
 * @type {Map<string, WebSocket>}
 */
const users = new Map(); // 用戶名稱與 WebSocket 連接的對應
const allUsers = new Set(); // 儲存所有在線用戶的集合

// 處理 HTTP 請求並回傳相應的靜態文件
function handleRequest(request, response) {
    // 輸出收到的請求 URL
    console.log('Request received: ' + request.url);

    // 根據 URL 選擇文件路徑
    let filePath = request.url === '/' ? 'index.html' : `.${request.url}`;
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
        case '.html':
            contentType = 'text/html';
            break;
        case '.png':
            contentType = 'image/png';
            break;
        case '.jpg':
            contentType = 'image/jpeg';
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
      key: readFileSync('/var/www/html/key.pem'), // 將路徑改為生成的私鑰文件
      cert: readFileSync('/var/www/html/cert.pem'), // 將路徑改為生成的自簽名憑證
    },
    handleRequest
  );
  
httpsServer.listen(HTTPS_PORT, '0.0.0.0'); // 在所有網絡介面上監聽 HTTPS 端口

// ----------------------------------------------------------------------------------------

// 創建 WebSocket 伺服器，並與 HTTPS 伺服器一起運行
const wss = new WebSocketServer({ server: httpsServer });

wss.on('connection', (ws) => {
    // 當有用戶連接時，處理來自該用戶的訊息
    ws.on('message', (message) => {
        /** @type {{name :string}} */
        let data;

        // 接收 JSON 格式的訊息，若格式錯誤則捕獲異常
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.log('Invalid JSON');
            data = {};
        }

        console.log('Received data:', data);

        // 根據訊息類型處理相應的操作
        switch (data.type) {
            // 當用戶嘗試登入時
            case 'login': {
                console.log('User logged', data.name);
                if (users.has(data.name)) {
                    // 如果用戶已經存在，返回登入失敗
                    sendTo(ws, {
                        type: 'login',
                        success: false,
                    });
                } else {
                    // 否則儲存用戶的連接並標記為在線
                    console.log('Save user connection on the server');
                    users.set(data.name, ws);
                    allUsers.add(data.name);

                    ws.name = data.name; // 記錄用戶名稱

                    // 返回登入成功訊息及在線用戶列表
                    sendTo(ws, {
                        type: 'login',
                        success: true,
                        share: data.share,
                        allUsers: Array.from(allUsers),
                    });

                    // 通知其他用戶有新用戶加入
                    notifyUsersChange(data.name);
                }
                break;
            }
            case 'offer': {
                // 用戶發送呼叫請求
                console.log('Sending offer to: ', data.name);

                const conn = users.get(data.name); // 找到目標用戶的 WebSocket 連接

                if (conn !== undefined) {
                    // 如果目標用戶在線，發送 offer 訊息
                    ws.otherName = data.name;
                    sendTo(conn, {
                        type: 'offer',
                        offer: data.offer,
                        name: ws.name,
                    });
                } else {
                    // 否則返回錯誤訊息
                    sendTo(ws, {
                        type: 'decline',
                        message: 'No such user',
                    });
                }
                break;
            }
            case 'answer': {
                // 用戶回應對方的 offer
                console.log('Sending answer to: ', data.name);
                const conn = users.get(data.name);
                console.log('Answer: ', data.answer);

                if (conn !== undefined) {
                    ws.otherName = data.name;
                    // 發送 answer 訊息給對方
                    sendTo(conn, {
                        type: 'answer',
                        answer: data.answer,
                    });
                }
                break;
            }
            case 'decline': {
                // 用戶拒絕對方的呼叫
                console.log('Declining call from: ', data.name);
                const conn = users.get(data.name);
                sendTo(conn, {
                    type: 'decline',
                    message: `Declined by user: ${ws.name}`,
                });
                break;
            }
            case 'candidate': {
                // 發送 ICE candidate
                console.log('Sending candidate to:', data.name);
                const conn = users.get(data.name);

                if (conn !== undefined) {
                    // 發送 ICE candidate 訊息給目標用戶
                    sendTo(conn, {
                        type: 'candidate',
                        candidate: data.candidate,
                    });
                }
                break;
            }
            case 'hangup': {
                // 用戶掛斷通話
                console.log('Hanging up call from', data.name);
                const conn = users.get(users.get(data.name)?.otherName);

                if (conn !== undefined) {
                    // 發送掛斷訊息
                    sendTo(conn, {
                        type: 'hangup',
                    });
                }
                break;
            }
            default: {
                // 其他未知命令
                sendTo(ws, {
                    type: 'error',
                    message: 'Command not found: ' + data.type,
                });
            }
        }
    });

    // 當 WebSocket 連線關閉時，進行清理操作
    ws.on('close', () => {
        if (ws.name) {
            // 刪除用戶連接
            users.delete(ws.name);
            allUsers.delete(ws.name);

            // 如果該用戶正在與其他用戶通話，通知對方掛斷
            if (ws.otherName) {
                console.log('Disconnecting from ', ws.otherName);
                const conn = users.get(ws.otherName);

                if (conn !== undefined) {
                    sendTo(conn, {
                        type: 'leave',
                    });
                }
            }

            // 通知其他用戶更新在線用戶列表
            notifyUsersChange(ws.name);
        }
    });
});

// 發送訊息給指定的 WebSocket 連接
/**
 * 發送訊息至 WebSocket 連接
 * @param {WebSocket} connection - 要發送的 WebSocket 連接
 * @param {object} message - 要發送的訊息
 */
function sendTo(connection, message) {
    connection.send(JSON.stringify(message));
}

// 通知所有用戶在線用戶列表的變更
function notifyUsersChange(newUser) {
    for (const user of allUsers) {
        if (user !== newUser) {
            sendTo(users.get(user), {
                type: 'users',
                users: Array.from(allUsers),
            });
        }
    }
}

// 伺服器啟動提示
console.log(`Server running. Visit https://localhost:${HTTPS_PORT}`);
