<?php
session_start();

// 檢查是否已登入
if (isset($_SESSION['username'])) {
    echo json_encode(['status' => 'success', 'username' => $_SESSION['username']]);
} else {
    echo json_encode(['status' => 'error']);
}
?>
