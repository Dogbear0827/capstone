/** @type {RTCPeerConnection} */
let yourConn;  // 用來處理 WebRTC 連線的物件
let localStream;  // 用來儲存本地媒體流（視訊/音訊）
let serverConnection = new WebSocket('wss://' + window.location.hostname + ':8080');  // 與伺服器建立 WebSocket 連線
let screenStream;  // 用來儲存螢幕分享的媒體流

// HTML 元素的按鈕監聽器：分享媒體、分享螢幕、停止分享
document.getElementById('shareMediaBtn').addEventListener('click', shareMedia);
document.getElementById('shareScreenBtn').addEventListener('click', shareScreen);
document.getElementById('stopSharingBtn').addEventListener('click', stopSharing);

// WebRTC ICE 伺服器配置，用於對等連線時發現對方
const peerConnectionConfig = {
    iceServers: [
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

// 當 WebSocket 連線建立時
serverConnection.onopen = () => {
    console.log('已成功連接至伺服器');
};

// 當接收到伺服器的訊息時處理
serverConnection.onmessage = gotMessageFromServer;

function gotMessageFromServer(message) {
    const data = JSON.parse(message.data);

    switch (data.type) {
        case 'login':
            handleLogin(data.success);  // 處理登入回應
            break;
        case 'viewer_request':
            handleViewerRequest(data.name);  // 當有觀眾請求連線時，回應觀眾
            break;
        case 'candidate':
            handleCandidate(data.candidate);  // 處理 ICE 候選訊息
            break;
        default:
            break;
    }
}

// 處理登入訊息
function handleLogin(success) {
    if (success) {
        console.log("成功登入");
    } else {
        alert('登入失敗');
    }
}

// 當有觀眾要求連線時（觀眾進入直播間）
function handleViewerRequest(viewerName) {
    console.log('觀眾加入: ' + viewerName);
    if (localStream) {
        createOffer(viewerName);  // 觀眾加入後，創建 offer 讓觀眾觀看直播
    }
}

// 創建 WebRTC 連線並向觀眾發送 offer
function createOffer(viewerName) {
    // 創建 RTCPeerConnection 物件
    yourConn = new RTCPeerConnection(peerConnectionConfig);
    yourConn.onicecandidate = handleICECandidate;  // 設定 ICE 候選處理函式
    yourConn.ontrack = handleTrack;  // 設定 track 事件的處理函式

    // 把本地媒體流的每個 track 加入到 WebRTC 連線
    localStream.getTracks().forEach(track => {
        yourConn.addTrack(track, localStream);
    });

    // 創建 WebRTC 連線的 offer 並設置本地描述
    yourConn.createOffer()
        .then(offer => {
            yourConn.setLocalDescription(offer);
            sendToServer({
                type: 'offer',  // 訊息類型為「offer」
                offer: offer,   // 傳送 offer 給伺服器
                viewer: viewerName  // 傳送觀眾名稱
            });
        })
        .catch(error => {
            console.error("創建 offer 時出錯:", error);
        });
}

// 處理 ICE 候選（用於 NAT 穿透）
function handleICECandidate(event) {
    if (event.candidate) {
        sendToServer({
            type: 'candidate',  // 訊息類型為「candidate」
            candidate: event.candidate  // 傳送 ICE 候選
        });
    }
}

// 發送訊息到伺服器
function sendToServer(msg) {
    serverConnection.send(JSON.stringify(msg));  // 發送 JSON 格式的訊息
}

// #region 控制按鈕功能

// 當點擊「分享媒體」按鈕時，開始分享本地媒體
function shareMedia() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            localStream = stream;  // 儲存本地媒體流
            // 設置本地視訊
            document.getElementById('localVideo').srcObject = stream;

            // 當媒體流準備好後，創建 WebRTC 連線
            localStream.getTracks().forEach(track => {
                yourConn.addTrack(track, localStream);  // 將本地的 track 加入到 WebRTC 連線
            });

            console.log('開始分享媒體');
        })
        .catch(err => {
            console.error("取得媒體失敗", err);  // 錯誤處理
        });
}

// 當點擊「分享螢幕」按鈕時，開始分享螢幕
function shareScreen() {
    navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        .then(screenStream => {
            // 假設需要將螢幕分享與本地的音訊流合併
            let combinedStream = new MediaStream();

            screenStream.getTracks().forEach(track => combinedStream.addTrack(track));  // 合併螢幕分享的 track
            if (localStream) {
                localStream.getTracks().forEach(track => combinedStream.addTrack(track));  // 合併本地媒體的 track
            }

            // 設置本地視訊顯示
            document.getElementById('localVideo').srcObject = combinedStream;

            // 創建 WebRTC 連線
            yourConn = new RTCPeerConnection(peerConnectionConfig);
            combinedStream.getTracks().forEach(track => {
                yourConn.addTrack(track, combinedStream);  // 將合併後的 track 加入 WebRTC 連線
            });

            console.log('開始分享螢幕');
        })
        .catch(err => {
            console.error("分享螢幕失敗", err);  // 錯誤處理
        });
}

// 當點擊「停止分享」按鈕時，停止分享
function stopSharing() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());  // 停止所有本地媒體流
        document.getElementById('localVideo').srcObject = null;  // 清空本地視訊顯示

        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());  // 停止螢幕分享
        }

        // 關閉 WebRTC 連線
        if (yourConn) {
            yourConn.close();
            yourConn = null;  // 清空 WebRTC 連線物件
        }

        console.log('已停止分享');
    }
}
