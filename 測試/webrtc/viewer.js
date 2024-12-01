/** @type {RTCPeerConnection} */
let yourConn;  // 用來處理 WebRTC 連線的物件
let localStream;  // 本地的音訊和視訊流
let connectedUser;  // 當前已連線的主播名稱

// WebRTC ICE 伺服器配置，用於發現對等方
const peerConnectionConfig = {
    iceServers: [
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

// WebSocket 連線，用於和伺服器進行訊號交換
let serverConnection = new WebSocket('wss://' + window.location.hostname + ':8080');

// 當 WebSocket 連線成功時執行
serverConnection.onopen = () => {
    console.log('已成功連接至伺服器');
};

// 當接收到伺服器訊息時處理
serverConnection.onmessage = gotMessageFromServer;

const remoteVideo = document.getElementById('remoteVideo');  // 顯示遠端視訊
const remoteAudio = document.getElementById('remoteAudio');  // 顯示遠端音訊
const showRemoteUsername = document.getElementById('showRemoteUsername');  // 顯示主播名稱

// 可選的；用戶登錄
/*function login(username) {
    sendToServer({
        type: 'login',  // 訊息類型
        name: username   // 觀眾名稱
    });
}*/

// 當伺服器發送訊息時，處理不同類型的訊息
function gotMessageFromServer(message) {
    console.log('收到訊息', message.data);
    const data = JSON.parse(message.data);

    switch (data.type) {
        case 'login':
            handleLogin(data.success, data.allUsers);  // 處理登入回應
            break;
        case 'stream':
            handleStream(data.streamer);  // 當伺服器通知有主播開始直播
            break;
        default:
            break;
    }

    serverConnection.onerror = errorHandler;  // 處理錯誤
}

// 當收到來自伺服器的主播開始分享媒體流的訊息時
function handleStream(streamer) {
    console.log(`${streamer} 開始直播！`);

    // 設置 WebRTC 連線
    connectedUser = streamer;
    yourConn = new RTCPeerConnection(peerConnectionConfig);
    yourConn.ontrack = handleTrack;  // 處理遠端媒體流

    // 只需要接收遠端媒體流
    yourConn.createAnswer()
        .then(answer => {
            yourConn.setLocalDescription(answer);  // 設置本地描述
            sendToServer({
                type: 'answer',  // 訊息類型為「answer」
                name: connectedUser,  // 傳送主播名稱
                answer: answer  // 傳送本地的 answer
            });
        })
        .catch(errorHandler);  // 處理錯誤
}

// 處理遠端 track，顯示遠端的媒體流（視訊或音訊）
function handleTrack(event) {
    console.log('收到遠端媒體流', event.streams[0]);
    showRemoteUsername.innerHTML = connectedUser;  // 顯示主播名稱

    // 根據 track 類型顯示遠端視訊或音訊
    if (event.track.kind === 'video') {
        remoteVideo.srcObject = event.streams[0];  // 顯示遠端視訊
        remoteVideo.hidden = false;
    } else if (event.track.kind === 'audio') {
        remoteAudio.srcObject = event.streams[0];  // 顯示遠端音訊
        remoteAudio.hidden = false;
    }
}

// 錯誤處理函式
function errorHandler(error) {
    console.error('錯誤發生:', error);
}

// 發送訊息至伺服器
function sendToServer(msg) {
    console.log('發送訊息至伺服器:', msg);
    serverConnection.send(JSON.stringify(msg));  // 發送 JSON 格式的訊息
}

// 登入處理函式
function handleLogin(success, allUsers) {
    if (success) {
        console.log('登入成功！');
    } else {
        console.log('登入失敗，請重新登入！');
    }
}

// 頁面卸載時關閉 WebSocket 連線
window.addEventListener('beforeunload', () => {
    serverConnection.close();  // 關閉 WebSocket 連線
});
