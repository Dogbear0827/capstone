<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GoodStream</title>
    <style>
        body {
            background-color: #f8eeee;
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            display: flex;
            height: 100vh;
        }

        .left-sidebar {
            width: 400px;
            height: 100vh;
            background-color: #ffffff;
            border-right: 1px solid #ccc;
            box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
            position: fixed;
            top: 0;
            left: 0;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            padding: 20px;
        }

        .sidebar-item {
            padding: 10px;
            margin-bottom: 10px;
            background-color: #f0f0f0;
            border-radius: 5px;
            cursor: pointer;
            transition: background-color 0.3s;
        }

        .sidebar-item:hover {
            background-color: #e0e0e0;
        }

        .main-content {
            flex-grow: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            margin-left: 420px;
            margin-right: 420px;
        }

        .button-container {
            display: flex;
        }

        button {
            width: 60px;
            height: 40px;
            font-size: 14px;
            margin: 0 10px;
            cursor: pointer;
            border: none;
            color: white;
            border-radius: 5px;
        }

        .subscribe-btn { background-color: #6fe4f8; }
        .follow-btn { background-color: #28A745; }
        .share-btn { background-color: #DC3545; }
        .ring-btn {
            background-color: #6F42C1;
            width: 40px;
            height: 40px;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .bell-icon {
            width: 20px;
            height: 20px;
        }

        button:hover { opacity: 0.8; }

        .chat-box {
            width: 400px;
            height: 100vh;
            background-color: #ffffff;
            border-left: 1px solid #ccc;
            padding: 10px;
            box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
            position: fixed;
            top: 0;
            right: 0;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            border-top-left-radius: 20px;
            border-bottom-left-radius: 20px;
            overflow: hidden;
        }

        #messages {
            flex-grow: 1;
            overflow-y: auto;
            border: 1px solid #ddd;
            padding: 5px;
            margin-bottom: 10px;
        }

        #chat-input {
            width: 100%;
            padding: 5px;
            margin-bottom: 5px;
            box-sizing: border-box;
        }

        #send-button {
            width: 100%;
        }
    </style>
</head>
<body>
    <div class="left-sidebar">
        <div class="sidebar-item">項目 1</div>
        <div class="sidebar-item">項目 2</div>
        <div class="sidebar-item">項目 3</div>
        <div class="sidebar-item">項目 4</div>
        <div class="sidebar-item">項目 5</div>
    </div>

    <div class="main-content">
        <div class="button-container">
            <button class="subscribe-btn" type="button">訂閱</button>
            <button class="ring-btn" type="button" onclick="alert('鈴鐺按鈕被點擊！')">
                <img src="https://img.icons8.com/ios-filled/50/ffffff/bell.png" alt="鈴鐺" class="bell-icon">
            </button>
            <button class="share-btn" type="button">分享</button>
            <button class="follow-btn" type="button">追隨</button>
        </div>
    </div>

    <div class="chat-box">
        <h2>聊天室</h2>
        <div id="messages">
            <!-- 聊天消息會在這裡顯示 -->
        </div>
        <input type="text" id="chat-input" placeholder="輸入消息...">
        <button id="send-button" type="button">發送</button>
    </div>

    <script>
        document.getElementById('send-button').addEventListener('click', function() {
            var input = document.getElementById('chat-input');
            var message = input.value;
            if (message) {
                var messagesDiv = document.getElementById('messages');
                messagesDiv.innerHTML += '<p>' + message + '</p>';
                input.value = '';
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }
        });
    </script>
</body>
</html>
