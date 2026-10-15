// Q-LINK 共通設定・ユーティリティ
const QLINK = {
  SCHOOL_NAME:   '大阪市立桜丘中学校',
  DEMO_PASSWORD: 'pass1234',
  OSAKA_CENTER:  [34.6937, 135.5023],
  DEFAULT_ZOOM:  13,
};

// localStorage からログイン状態を取得
function getLoginState() {
  return {
    role:   localStorage.getItem('qlink_role'),
    school: localStorage.getItem('qlink_school'),
    class:  localStorage.getItem('qlink_class'),
    group:  localStorage.getItem('qlink_group'),
  };
}

// ログイン必須チェック（未ログインならindex.htmlへリダイレクト）
function requireLogin(expectedRole) {
  const state = getLoginState();
  if (!state.role || (expectedRole && state.role !== expectedRole)) {
    window.location.href = 'index.html';
    return null;
  }
  return state;
}

// ログアウト
function logout() {
  localStorage.removeItem('qlink_role');
  localStorage.removeItem('qlink_school');
  localStorage.removeItem('qlink_class');
  localStorage.removeItem('qlink_group');
  window.location.href = 'index.html';
}
