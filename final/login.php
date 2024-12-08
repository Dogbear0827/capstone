<?php
// 連接到資料庫，請根據設定更改
$servername = "localhost";  // 資料庫伺服器位置
$username = "root";  // 資料庫使用者名稱
$password = "00000000";  // 資料庫密碼
$dbname = "account";  // 使用的資料庫名稱

// 建立+連結資料庫
$conn = new mysqli($servername, $username, $password, $dbname);  // 建立資料庫連接
if ($conn->connect_error) {  // 檢查資料庫連接是否成功
    error_log("資料庫連接失敗: " . $conn->connect_error);  // 如果連接失敗，記錄錯誤訊息
    die(json_encode(['status' => 'error', 'message' => '資料庫連接失敗，請稍後再試。']));  // 回傳錯誤訊息並終止執行
}

// 設定回應格式為JSON
header('Content-Type: application/json');  

// 讀取表單內容
if ($_SERVER["REQUEST_METHOD"] == "POST") {  // 檢查是否為POST請求
    $user_username = trim($_POST['username']);  // 取得並去除使用者名稱的前後空白
    $user_password = trim($_POST['password']);  // 取得並去除密碼的前後空白
    $errors = [];  // 用來儲存錯誤訊息的陣列

    // 驗證使用者名稱是否為空
    if (empty($user_username)) {
        $errors[] = "請提供使用者名稱";  // 若為空，加入錯誤訊息
    }

    // 驗證密碼是否為空
    if (empty($user_password)) {
        $errors[] = "請提供密碼";  // 若為空，加入錯誤訊息
    }

    // 如果有錯誤，回傳錯誤訊息並停止程式
    if (count($errors) > 0) {
        echo json_encode(['status' => 'error', 'messages' => $errors]);  // 回傳錯誤訊息
        exit();  // 停止後續程式執行
    }

    // 準備SQL查詢，檢查使用者名稱是否存在
    $stmt = $conn->prepare("SELECT * FROM users WHERE username=?");  // 使用預處理語句以防SQL注入
    $stmt->bind_param("s", $user_username);  // 綁定使用者名稱參數
    $stmt->execute();  // 執行查詢
    $result = $stmt->get_result();  // 取得查詢結果

    // 如果找到對應的使用者
    if ($result->num_rows > 0) {
        $user = $result->fetch_assoc();  // 取得使用者資料

        // 驗證密碼是否正確
        if (password_verify($user_password, $user['userpassword'])) {  // 密碼驗證
            session_start();  // 開始會話
            session_regenerate_id();  // 重新生成會話ID
            $_SESSION['username'] = $user['username'];  // 將使用者名稱儲存在會話中
            echo json_encode(['status' => 'success', 'message' => '登入成功！']);  // 回傳登入成功訊息
        } else {
            echo json_encode(['status' => 'error', 'messages' => ['密碼錯誤，請再試一次']]);  // 密碼錯誤，回傳錯誤訊息
        }
    } else {
        echo json_encode(['status' => 'error', 'messages' => ['找不到此使用者名稱']]);  // 找不到使用者名稱，回傳錯誤訊息
    }

    $stmt->close();  // 關閉SQL語句
}

// 關閉資料庫連接
$conn->close();  // 關閉資料庫連接
?>
