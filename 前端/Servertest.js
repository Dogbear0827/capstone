import { readFileSync } from 'fs'; // 檔案處理模組
import { extname } from 'path'; // 路徑處理模組
import { createServer } from 'https'; // HTTPS 伺服器模組
import WebSocket, { WebSocketServer } from 'ws'; // WebSocket 模組
import mysql from 'mysql2'; // 引入 MySQL 模組

const HTTPS_PORT = 8080;

// 資料庫配置
const db = mysql.createPool({
    host: 'localhost',
    user: 'your_db_user',
    password: 'your_db_password',
    database: 'your_database_name'
});

const users = new Map();  // 用戶名稱與 WebSocket 連接的對應
const allUsers = new Set();  // 儲存所有在線用戶的集合

// 處理 HTTP 請求並回傳相應的靜態文件
function handleRequest(request, response) {
    let filePath = request.url === '/' ? 'index.html' : `client${request.url}`;
    const extName = extname(filePath); // 獲取文件的副檔名
    let contentType = 'text/html'; // 預設內容類型為 HTML

    switch (extName) {
        case '.js': contentType = 'application/javascript'; break;
        case '.css': contentType = 'text/css'; break;
    }

    readFile(filePath, (error, content) => {
        if (error) {
            response.writeHead(404);
            response.end('<h1>404 Not Found</h1>');
        } else {
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf-8');
        }
    });
}

// 創建 HTTPS 伺服器
const httpsServer = createServer(
    {
        key: readFileSync('/etc/letsencrypt/live/yourdomain.com/privkey.pem'),
        cert: readFileSync('/etc/letsencrypt/live/yourdomain.com/cert.pem'),
    },
    handleRequest
);
httpsServer.listen(HTTPS_PORT, '0.0.0.0');

// 創建 WebSocket 伺服器
const wss = new WebSocketServer({ server: httpsServer });

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        let data;

        try {
            data = JSON.parse(message);
        } catch (e) {
            console.log('Invalid JSON');
            return;
        }

        switch (data.type) {
            case 'login':
                db.execute('SELECT * FROM users WHERE username = ?', [data.name], (err, results) => {
                    if (err || results.length === 0) {
                        sendTo(ws, { type: 'login', success: false });
                    } else {
                        users[data.name] = ws;
                        allUsers.add(data.name);
                        ws.name = data.name;
                        sendTo(ws, {
                            type: 'login',
                            success: true,
                            allUsers: Array.from(allUsers),
                        });
                        notifyUsersChange(data.name);
                    }
                });
                break;
            case 'offer':
                const conn = users[data.name];
                if (conn) {
                    sendTo(conn, {
                        type: 'offer',
                        offer: data.offer,
                        name: ws.name,
                    });
                }
                break;
            case 'answer':
                const connAnswer = users[data.name];
                if (connAnswer) {
                    sendTo(connAnswer, {
                       
