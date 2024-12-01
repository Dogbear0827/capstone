const WebSocket = require('ws');

// 建立 WebSocket 伺服器，監聽 8080 端口
const wss = new WebSocket.Server({ port: 8080 });

// 用來儲存用戶的 WebSocket 連接
let users = {};  // 儲存用戶名稱與對應的 WebSocket 連接
let allUsers = new Set();  // 儲存所有在線的用戶名稱（包括主播與觀眾）

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
            // 如果收到的訊息格式錯誤，發送錯誤回客戶端
            sendTo(ws, { type: 'error', message: 'Invalid message format' });
            return;  // 停止處理後續邏輯
        }

        console.log('received data:', data);

        // 根據訊息的類型進行相應處理
        switch (data.type) {
            // 當用戶嘗試登入時
            case 'login': {
                console.log('User login attempt:', data.name);

                // 如果用戶名稱已存在，返回登入失敗
                if (users[data.name]) {
                    sendTo(ws, { type: 'login', success: false, message: 'Username already taken' });
                    return;
                }

                // 如果用戶名稱不存在，儲存用戶的 WebSocket 連接並標記為在線
                users[data.name] = ws;
                allUsers.add(data.name);
                ws.name = data.name; // 記錄用戶名稱

                // 返回登入成功訊息及在線用戶列表
                sendTo(ws, {
                    type: 'login',
                    success: true,
                    allUsers: Array.from(allUsers),  // 傳送所有在線的用戶列表
                });

                // 通知其他用戶有新用戶加入
                notifyUsersChange(data.name);
                break;
            }

            // 當主播開始分享媒體時，通知所有觀眾
            case 'share': {
                if (ws.name) {
                    console.log(`${ws.name} started streaming`);

                    // 將主播的訊息發送給所有觀眾
                    for (const user in users) {
                        if (user !== ws.name) {
                            sendTo(users[user], {
                                type: 'stream',  // 訊息類型為「stream」，表示主播開始直播
                                streamer: ws.name,  // 轉發主播的名稱
                            });
                        }
                    }
                }
                break;
            }

            // ICE 候選的處理（目前是單向直播，這部分可以選擇性保留）
            case 'candidate': {
                // 若有處理 ICE 候選的需求，可以在此處加入邏輯
                break;
            }

            // 若收到其他未知命令，返回錯誤訊息
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

            // 通知其他用戶更新在線用戶列表
            notifyUsersChange(ws.name);
            console.log(`${ws.name} has disconnected`);
        }
    });
});

// 發送訊息給指定的 WebSocket 連接
function sendTo(connection, message) {
    try {
        // 發送 JSON 格式的訊息
        connection.send(JSON.stringify(message));
    } catch (error) {
        // 捕獲傳送錯誤並記錄
        console.error('Error sending message:', error);
        // 發送錯誤訊息給用戶
        connection.send(JSON.stringify({ type: 'error', message: 'Failed to send message' }));
    }
}

// 通知所有用戶在線用戶列表的變更
function notifyUsersChange(newUser) {
    // 遍歷所有用戶，並通知他們有用戶加入或退出
    for (const user of allUsers) {
        if (user !== newUser) {
            // 將在線用戶列表傳送給每個用戶
            sendTo(users[user], {
                type: 'users',  // 訊息類型為「users」，表示用戶列表更新
                users: Array.from(allUsers),  // 傳送所有用戶名稱
                updatedUser: newUser,  // 傳送更新的用戶名稱
            });
        }
    }
}

// 伺服器啟動後，輸出提示訊息
console.log('Server running. Visit https://localhost:8080');
