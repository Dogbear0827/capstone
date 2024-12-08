<?php
// 資料庫連線設定
$host = 'localhost'; // 資料庫主機
$dbname = 'user_management'; // 資料庫名稱
$username = 'root'; // 資料庫使用者名稱
$password = ''; // 資料庫密碼

try {
    // 建立資料庫連線
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // 確認請求方法是否為 POST
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // 接收前端傳來的資料
        $user = $_POST['username'] ?? '匿名'; // 預設為 "匿名"
        $message = $_POST['message'] ?? '';

        // 檢查留言是否為空
        if (!empty($message)) {
            // 插入留言到資料庫
            $stmt = $pdo->prepare("INSERT INTO chat_messages (username, message) VALUES (:username, :message)");
            $stmt->execute(['username' => $user, 'message' => $message]);

            // 回傳成功訊息
            echo json_encode(['success' => true, 'message' => '留言已儲存']);
        } else {
            // 回傳錯誤訊息
            echo json_encode(['success' => false, 'message' => '留言內容不能為空']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => '不支援的請求方法']);
    }
} catch (PDOException $e) {
    // 捕捉錯誤並回傳
    echo json_encode(['success' => false, 'message' => '資料庫連線失敗: ' . $e->getMessage()]);
}
