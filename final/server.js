const socket = new WebSocket('wss://' + window.location.hostname + ':8080'); // 連接到 WebSocket 伺服器

let peerConnections = {}; // 儲存每個直播主的 PeerConnection
let name; // 用戶名稱
let roomCode; // 房間代碼，從 URL 獲取

// 從 URL 中解析出房間代碼
const urlParams = new URLSearchParams(window.location.search);
roomCode = urlParams.get('code');

if (!roomCode) {
    alert("房間代碼無效或缺少");
    // 可以考慮跳轉到其他頁面或顯示更多提示
} else {
    console.log(`觀眾房間代碼: ${roomCode}`);
}

// 使用 async/await 處理登入邏輯
async function fetchLoginData() {
    try {
        const response = await fetch('check-login.php');
        const data = await response.json();
        if (data.status === "success") {
            name = data.username; // 設置用戶名稱
            console.log(`用戶名稱: ${name}`);
            initWebSocket();
        } else {
            alert('未登入或無效用戶');
        }
    } catch (error) {
        console.error('Error fetching login data:', error);
    }
}

// 初始化 WebSocket 事件
function initWebSocket() {
    socket.onopen = () => {
        console.log("Connected to WebSocket server");
        socket.send(JSON.stringify({
            type: 'login',
            name: name,
            roomCode: roomCode // 發送房間代碼
        }));
    };

    socket.onmessage = handleWebSocketMessage;
    socket.onclose = () => {
        console.log("Disconnected from WebSocket server");
        // 自動重連 WebSocket
        setTimeout(() => {
            console.log("Reconnecting to WebSocket...");
            initWebSocket();
        }, 3000); // 每 3 秒嘗試重連
    };

    // 初始化顯示所有直播主的視頻
    window.onload = async () => {
        // 當觀看者加載時，請求特定房間內的主播視頻流
        socket.send(JSON.stringify({
            type: 'connect-to-streamer', // 請求房間內的主播視訊流
            roomCode: roomCode, // 發送房間代碼
        }));
    };
}

// 處理 WebSocket 訊息
function handleWebSocketMessage(event) {
    const message = JSON.parse(event.data);
    console.log("Received message: ", message);

    switch (message.type) {
        case 'login':
            if (message.success) {
                console.log("Logged in successfully");
            } else {
                alert("Login failed: " + message.message);
            }
            break;

        case 'offer':
            handleOffer(message.offer, message.streamer);
            break;

        case 'candidate':
            if (peerConnections[message.streamer]) {
                peerConnections[message.streamer].addIceCandidate(new RTCIceCandidate(message.candidate));
            }
            break;

        case 'answer':
            if (peerConnections[message.streamer]) {
                peerConnections[message.streamer].setRemoteDescription(new RTCSessionDescription(message.answer));
            }
            break;

        default:
            console.log("Unknown message type: ", message.type);
            break;
    }
}

// 處理來自直播主的 offer
async function handleOffer(offer, streamer) {
    const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.send(JSON.stringify({
                type: 'candidate',
                candidate: event.candidate,
                streamer: streamer,
                roomCode: roomCode, // 發送房間代碼
            }));
        }
    };

    peerConnection.ontrack = (event) => {
        const remoteStream = event.streams[0];

        // 動態創建並顯示每個直播主的視訊
        let videoContainer = document.getElementById('video-container');
        let videoElement = document.createElement('video');
        videoElement.id = `video-${streamer}`;
        videoElement.autoplay = true;
        videoElement.controls = true;
        videoElement.srcObject = remoteStream;

        videoContainer.appendChild(videoElement);
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.send(JSON.stringify({
        type: 'answer',
        answer: answer,
        streamer: streamer,
        roomCode: roomCode, // 發送房間代碼
    }));

    // 儲存 PeerConnection
    peerConnections[streamer] = peerConnection;
}

// 啟動主程序
fetchLoginData();
