<?php
// 偵錯用
//ini_set('display_errors', 1);
//error_reporting(E_ALL);

// 連接到資料庫
$servername = "localhost";  // 如果Apache與Mysql裝在一起，則填入localhost
$username = "root"; // 根據你的設定更改這裡
$password = "newpassword"; // 根據你的設定更改這裡
$dbname = ""; // 你的資料庫名稱

// 創建連接
//記得安裝php-mysqli
//sudo apt install php-mysqli
$conn = new mysqli($servername, $username, $password, $dbname);

// 檢查連接
if ($conn->connect_error) {
    die("連接失敗: " . $conn->connect_error);
}

// 設定 Content-Type 為 JSON 以便於前端處理返回的結果
header('Content-Type: application/json');

// 如果是 POST 請求
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // 取得表單數據
    $user_username = trim($_POST['username']);
    $user_email = trim($_POST['email']);
    $user_password = trim($_POST['userpassword']);
    $confirm_password = trim($_POST['confirm-password']);

    // 驗證資料
    $errors = [];

    if (strlen($user_username) < 3) {
        $errors[] = "使用者名稱至少需要 3 個字元";
    }

    if (!filter_var($user_email, FILTER_VALIDATE_EMAIL)) {
        $errors[] = "請提供有效的電子郵件地址";
    }

    if (strlen($user_password) < 8) {
        $errors[] = "密碼至少需要 8 個字符";
    }

    if ($user_password !== $confirm_password) {
        $errors[] = "密碼和確認密碼不匹配";
    }

    // 如果有錯誤，返回錯誤訊息
    if (count($errors) > 0) {
        echo json_encode(['status' => 'error', 'messages' => $errors]);
        exit();
    }

    // 防止 SQL 注入，使用預處理語句
    $stmt = $conn->prepare("SELECT * FROM users WHERE username=? OR email=?");
    $stmt->bind_param("ss", $user_username, $user_email); // 這裡是參數綁定
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        // 使用者名稱或電子郵件已存在
        echo json_encode(['status' => 'error', 'messages' => ['使用者名稱或電子郵件已被註冊']]);
    } else {
        // 將密碼加密後存入資料庫
        $hashed_password = password_hash($user_password, PASSWORD_DEFAULT);

        // 插入新使用者資料
        $insert_stmt = $conn->prepare("INSERT INTO users (username, email, userpassword) VALUES (?, ?, ?)");
        $insert_stmt->bind_param("sss", $user_username, $user_email, $hashed_password); // 這裡是參數綁定

        if ($insert_stmt->execute()) {
            // 註冊成功
            echo json_encode(['status' => 'success', 'message' => '註冊成功！']);
        } else {
            // 註冊失敗
            echo json_encode(['status' => 'error', 'messages' => ['註冊失敗: ' . $conn->error]]);
        }
    }

    // 關閉預處理語句
    $stmt->close();
    $insert_stmt->close();
}

$conn->close();
?>
