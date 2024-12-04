/** @type {RTCPeerConnection} */
let yourConn;  // 用來處理 WebRTC 連線的物件
let localStream;  // 本地的音訊和視訊流
let connectedUser;  // 當前已連線的主播名稱

const peerConnectionConfig = {
    iceServers: [
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

let serverConnection = new WebSocket('wss://' + window.location.hostname + ':8080');

// 當 WebSocket 連線成功時執行
serverConnection.onopen = () => {
    console.log('已成功連接至伺服器');
};

// 當接收到伺服器訊息時處理
serverConnection.onmessage = gotMessageFromServer;

const remoteVideo = document.getElementById('remoteVideo');  // 顯示遠端視訊

function gotMessageFromServer(message) {
    console.log('收到訊息', message.data);
    const data = JSON.parse(message.data);

    switch (data.type) {
        case 'login':
            handleLogin(data.success, data.allUsers);  // 處理登入回應
            break;
        case 'offer':
            handleOffer(data.offer, data.viewer);  // 當伺服器通知有主播開始直播
            break;
        case 'candidate':
            handleCandidate(data.candidate);  // 處理 ICE 候選訊息
            break;
        default:
            break;
    }
}

// 當收到來自伺服器的主播開始分享媒體流的訊息時
function handleOffer(offer, viewer) {
    console.log(`${viewer} 開始直播！`);

    connectedUser = viewer;
    yourConn = new RTCPeerConnection(peerConnectionConfig);
    yourConn.ontrack = handleTrack;  // 處理遠端媒體流

    // 只需要接收遠端媒體流
    yourConn.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => yourConn.createAnswer())
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
    remoteVideo.srcObject = event.streams[0];  // 顯示遠端視訊
}

// 處理 ICE 候選
function handleCandidate(candidate) {
    yourConn.addIceCandidate(new RTCIceCandidate(candidate));
}

// 錯誤處理函式
function errorHandler(error) {
    console.error('錯誤發生:', error);
}

// 發送訊息至伺服器
function sendToServer(msg) {
    serverConnection.send(JSON.stringify(msg));  // 發送 JSON 格式的訊息
}
