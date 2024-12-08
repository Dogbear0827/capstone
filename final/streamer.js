// 初始化 WebSocket 與相關功能
const socket = new WebSocket('wss://' + window.location.hostname + ':8080');

let name; // 用戶名稱
let peerConnection; // WebRTC peer connection
let localStream; // 本地媒體流

// 主程序入口
async function main() {
    try {
        // 確認登入狀態
        const loginData = await checkLogin();
        name = loginData.username;
        console.log(`用戶名稱: ${name}`);

        // 初始化 WebSocket 事件
        setupWebSocket();

        // 初始化 DOM 和 WebRTC（不會預設啟動鏡頭）
        setupUIControls();
    } catch (error) {
        console.error('應用初始化錯誤:', error);
    }
}

// 確認登入狀態
async function checkLogin() {
    const response = await fetch('check-login.php');
    const data = await response.json();
    if (data.status !== "success") {
        throw new Error('未登入或無效用戶');
    }
    return data;
}

// 設置 WebSocket 事件
function setupWebSocket() {
    socket.onopen = () => {
        console.log("Connected to WebSocket server");
        socket.send(JSON.stringify({
            type: 'login',
            name: name,
        }));
    };

    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log("Received message: ", message);
        handleWebSocketMessage(message);
    };

    socket.onclose = () => {
        console.log("Disconnected from WebSocket server");
    };
}

// 處理 WebSocket 訊息
function handleWebSocketMessage(message) {
    switch (message.type) {
        case 'login':
            if (!message.success) {
                alert("Login failed: " + message.message);
            }
            break;

        case 'offer':
            handleOffer(message.offer, message.streamer, message.roomCode);
            break;

        case 'candidate':
            if (peerConnection) {
                peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
            }
            break;

        case 'answer':
            if (peerConnection) {
                peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
            }
            break;

        default:
            console.log("Unknown message type: ", message.type);
            break;
    }
}

// 設置 UI 控件的事件
function setupUIControls() {
    const screenShareButton = document.getElementById('screenShareButton');
    const cameraShareButton = document.getElementById('cameraShareButton');
    const stopButton = document.getElementById('stopButton');

    if (screenShareButton) {
        screenShareButton.addEventListener('click', shareScreen);
    }
    if (cameraShareButton) {
        cameraShareButton.addEventListener('click', shareMedia);
    }
    if (stopButton) {
        stopButton.addEventListener('click', stopSharing);
    }
}

// 分享螢幕
async function shareScreen() {
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        updateLocalStream(screenStream);
    } catch (error) {
        console.error("Error sharing screen: ", error);
    }
}

// 分享相機
async function shareMedia() {
    try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        updateLocalStream(mediaStream);
    } catch (error) {
        console.error("Error sharing media: ", error);
    }
}

// 停止分享
function stopSharing() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        const liveVideo = document.getElementById('liveVideo');
        if (liveVideo) liveVideo.srcObject = null;

        socket.send(JSON.stringify({
            type: 'stop',
            streamer: name,
            roomCode: name,
        }));

        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
    }
}

// 更新本地流並發送 offer
async function updateLocalStream(newStream) {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    localStream = newStream;

    const liveVideo = document.getElementById('liveVideo');
    if (liveVideo) {
        liveVideo.srcObject = newStream;
    }

    // 確保 peerConnection 已初始化
    if (!peerConnection) {
        setupPeerConnection();  // 若尚未初始化，初始化 peerConnection
    }

    const tracks = newStream.getTracks();
    if (peerConnection) {
        peerConnection.getSenders().forEach(sender => {
            const track = tracks.find(t => t.kind === sender.track.kind);
            if (track) sender.replaceTrack(track);
        });
    }

    // 創建 offer 並發送
    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // 發送 offer 到 WebSocket 伺服器
        socket.send(JSON.stringify({
            type: 'offer',
            offer: offer,
            streamer: name,
            roomCode: name,
        }));
    } catch (error) {
        console.error("Error creating offer: ", error);
    }
}

// 處理觀眾的 offer
async function handleOffer(offer, streamer, roomCode) {
    if (!peerConnection) setupPeerConnection();

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // 回傳 answer 給觀眾
    socket.send(JSON.stringify({
        type: 'answer',
        answer: answer,
        streamer: streamer,
        roomCode: roomCode,
    }));
}

// 初始化 peerConnection
function setupPeerConnection() {
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }, // Google STUN server
        ],
    };
    peerConnection = new RTCPeerConnection(configuration);

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.send(JSON.stringify({
                type: 'candidate',
                candidate: event.candidate,
                streamer: name,
                roomCode: name,
            }));
        }
    };

    peerConnection.ontrack = (event) => {
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo) {
            remoteVideo.srcObject = event.streams[0];
        }
    };

    if (localStream) {
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    }
}

// 啟動主程序
document.addEventListener('DOMContentLoaded', main);
