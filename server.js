const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' }));
// CSV ヘッダーテンプレート
const CSV_TEMPLATES = {
  'members.csv':             'student_no,name,role,is_leader\n',
  'memo.csv':                'memo_id,timestamp,author,content\n',
  'message.csv':             'msg_id,timestamp,sender,message\n',
  'progress.csv':            'log_id,timestamp,checkpoint_id,status\n',
  'mapmemo.csv':             'map_id,timestamp,lat,lng,note\n',
  'gakushuu/notes.csv':      'note_id,timestamp,student,area,content\n',
  'gakushuu/quiz_answers.csv':'answer_id,timestamp,student,question_id,answer,is_correct\n',
};

const KANRI_DIR = path.join(__dirname, 'data', 'kanri');

// 【ヘルパー関数】表示用名や数値からフォルダ名を正規化する
function normalizeClassDir(className) {
  const match = String(className).match(/\d+/);
  const num = match ? match[0] : '1';
  return `class${num}`;
}

function normalizeGroupDir(group) {
  const match = String(group).match(/\d+/);
  const num = match ? match[0] : '1';
  return `group${num}`;
}

// 【ヘルパー関数】学校名または学校IDから対象の schoolID ("school1" 等) を探す
function resolveSchoolId(schoolInput) {
  if (!fs.existsSync(KANRI_DIR) || !schoolInput) return null;

  const cleanInput = String(schoolInput).trim().toLowerCase();
  const entries = fs.readdirSync(KANRI_DIR);

  for (const entry of entries) {
    if (entry.toLowerCase() === cleanInput) return entry;

    const jsonPath = path.join(KANRI_DIR, entry, 'school.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        if (
          (data.school_id && data.school_id.toLowerCase() === cleanInput) ||
          (data.school_name && data.school_name.trim().toLowerCase() === cleanInput)
        ) {
          return entry;
        }
      } catch (e) {}
    }
  }
  return null;
}

// ===================================================
// 1. 学校登録・フォルダ一括自動生成 API
// ===================================================
app.post('/api/register', (req, res) => {
  const { school, teacher, password, studentPassword, grade, classes } = req.body;

  if (!school || !teacher || !password || !studentPassword) {
    return res.status(400).json({ error: '必要な情報が不足しています' });
  }

  if (!fs.existsSync(KANRI_DIR)) {
    fs.mkdirSync(KANRI_DIR, { recursive: true });
  }

  // 同名の学校がないかチェック
  let targetSchoolId = resolveSchoolId(school);

  // 新規登録なら登録順（school1, school2...）で自動採番
  if (!targetSchoolId) {
    const existingDirs = fs.readdirSync(KANRI_DIR).filter(d => d.startsWith('school'));
    let maxId = 0;
    existingDirs.forEach(d => {
      const num = parseInt(d.replace('school', ''), 10);
      if (!isNaN(num) && num > maxId) maxId = num;
    });
    targetSchoolId = `school${maxId + 1}`;
  }

  const schoolDir = path.join(KANRI_DIR, targetSchoolId);

  const cleanTeacherNames = String(teacher)
    .split(/[,，、]/)               // カンマや読点で分割
    .map(name => name.trim())       // 前後の不要なスペースを削除
    .filter(name => name !== '')    // 空文字のゴミを排除
    .join(',');                     // 半角カンマで繋ぎ直す (例: "山田先生,田中先生")

  // school.json の保存
  const schoolData = { 
    school_id: targetSchoolId, 
    school_name: school, 
    grade: grade || '1年', 
    teacher: cleanTeacherNames,
    password, 
    student_password: studentPassword, 
    classes: classes || [], 
    groups: [],
    updated_at: new Date().toISOString()
  };

  fs.mkdirSync(schoolDir, { recursive: true });
  fs.writeFileSync(
    path.join(schoolDir, 'school.json'),
    JSON.stringify(schoolData, null, 2),
    'utf8'
  );

  // teacher.csv の作成
  const teacherCsvPath = path.join(schoolDir, 'teacher.csv');
  if (!fs.existsSync(teacherCsvPath)) {
    fs.writeFileSync(teacherCsvPath, 'teacher_name,password\n', 'utf8');
  }

  // クラス・班フォルダおよびファイルの自動生成処理
  const classList = Array.isArray(classes) && classes.length > 0 ? classes : [{ name: '1組', groupCount: 1 }];

  classList.forEach((cls, classIdx) => {
    const classNum = classIdx + 1;
    const rawCount = typeof cls === 'object' ? cls.groupCount : 1;
    const groupCount = Math.max(1, parseInt(rawCount, 10) || 1);

    for (let g = 1; g <= groupCount; g++) {
      const groupDir    = path.join(schoolDir, `class${classNum}`, `group${g}`);
      const photosDir   = path.join(groupDir, 'photos');
      const gakushuuDir = path.join(groupDir, 'gakushuu');

      fs.mkdirSync(photosDir, { recursive: true });
      fs.mkdirSync(gakushuuDir, { recursive: true });

      Object.entries(CSV_TEMPLATES).forEach(([relPath, header]) => {
        const filePath = path.join(groupDir, ...relPath.split('/'));
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, header, 'utf8');
        }
      });
    }
  });

  console.log(`[生成完了] フォルダ構造作成成功: ${targetSchoolId} (${school})`);
  res.json({ success: true, school_id: targetSchoolId });
});

// ===================================================
// 2. 教員ログイン API
// ===================================================
app.post('/api/login/teacher', (req, res) => {
  const { school_id, teacher, password } = req.body;

  if (!school_id || !teacher || !password) {
    return res.json({ success: false, error: '学校ID、教員名、パスワードをすべて入力してください' });
  }

  if (!fs.existsSync(KANRI_DIR)) {
    return res.json({ success: false, error: '登録されている学校データがありません' });
  }

  const matchedDir = resolveSchoolId(school_id);

  if (!matchedDir) {
    return res.json({ success: false, error: '指定された学校IDが見つかりません' });
  }

  try {
    const schoolFile = path.join(KANRI_DIR, matchedDir, 'school.json');
    if (!fs.existsSync(schoolFile)) {
      return res.json({ success: false, error: '学校の設定データが見つかりません' });
    }

    const data = JSON.parse(fs.readFileSync(schoolFile, 'utf8'));

    if (data.password !== password) {
      return res.json({ success: false, error: 'パスワードが一致しません' });
    }

    const teacherList = String(data.teacher)
      .split(',')
      .map(name => name.trim().toLowerCase());

    const inputTeacher = String(teacher).trim().toLowerCase();

    if (!teacherList.includes(inputTeacher)) {
      return res.json({ success: false, error: '指定された教員名が登録されていません' });
    }

    res.json({
      success: true,
      school_id: data.school_id || matchedDir,
      school_name: data.school_name,
      teacher: inputTeacher 
    });

  } catch (e) {
    res.json({ success: false, error: 'データの読み込みに失敗しました' });
  }
});

// ===================================================
// 3. 生徒ログイン API（学校ID＋パスワード認証）
// ===================================================
app.post('/api/login/student', (req, res) => {
  const { school_id, className, group, password } = req.body;

  if (!school_id || !className || !group || !password) {
    return res.json({ success: false, error: 'すべての項目を入力してください' });
  }

  const matchedDir = resolveSchoolId(school_id);

  if (!matchedDir) {
    return res.json({ success: false, error: '指定された学校IDが存在しません' });
  }

  try {
    const schoolFile = path.join(KANRI_DIR, matchedDir, 'school.json');
    const data = JSON.parse(fs.readFileSync(schoolFile, 'utf8'));

    if (data.student_password !== password) {
      return res.json({ success: false, error: 'パスワードが一致しません' });
    }

    const classDir = normalizeClassDir(className);
    const groupDir = normalizeGroupDir(group);
    const groupPath = path.join(KANRI_DIR, matchedDir, classDir, groupDir);

    if (!fs.existsSync(groupPath)) {
      return res.json({ success: false, error: '指定された組または班が見つかりません' });
    }

    res.json({ 
      success: true, 
      school_id: data.school_id || matchedDir,
      school_name: data.school_name,
      class: className,
      group: group,
      data_path: `data/kanri/${matchedDir}/${classDir}/${groupDir}`
    });

  } catch (err) {
    res.json({ success: false, error: 'データの読み込みに失敗しました' });
  }
});

// ===================================================
// 4. 学校一覧取得 API
// ===================================================
app.get('/api/schools', (req, res) => {
  if (!fs.existsSync(KANRI_DIR)) return res.json([]);
  const schools = fs.readdirSync(KANRI_DIR).filter(name => {
    return fs.existsSync(path.join(KANRI_DIR, name, 'school.json'));
  }).map(name => {
    const data = JSON.parse(fs.readFileSync(path.join(KANRI_DIR, name, 'school.json'), 'utf8'));
    return {
      school_id: data.school_id || name,
      school_name: data.school_name,
      grade: data.grade,
      classes: data.classes
    };
  });
  res.json(schools);
});

// ===================================================
// 5. チャット API
// ===================================================
function getChatCsvPath(school, className, group) {
  const schoolId = resolveSchoolId(school) || school;
  const classDir = normalizeClassDir(className);
  const groupDir = normalizeGroupDir(group);

  return path.join(KANRI_DIR, schoolId, classDir, groupDir, 'message.csv');
}

app.get('/api/chat', (req, res) => {
  const { school, className, group } = req.query;
  if (!school || !className || !group) {
    return res.status(400).json({ error: 'パラメータ不足' });
  }
  const csvPath = getChatCsvPath(school, className, group);
  if (!fs.existsSync(csvPath)) {
    return res.json([]);
  }
  const lines = fs.readFileSync(csvPath, 'utf8').split('\n').filter(Boolean);
  const messages = lines.slice(1).map(line => {
    const cols = line.split(',');
    return {
      id:     cols[0] || '',
      time:   cols[1] || '',
      sender: cols[2] || '',
      text:   cols.slice(3).join(',')
    };
  });
  res.json(messages);
});

app.post('/api/chat', (req, res) => {
  const { school, className, group, sender, text } = req.body;
  if (!school || !className || !group || !sender || !text) {
    return res.status(400).json({ error: 'パラメータ不足' });
  }
  const csvPath = getChatCsvPath(school, className, group);

  fs.mkdirSync(path.dirname(csvPath), { recursive: true });
  if (!fs.existsSync(csvPath)) {
    fs.writeFileSync(csvPath, 'msg_id,timestamp,sender,message\n', 'utf8');
  }
  const timestamp = new Date().toLocaleString('ja-JP', { hour12: false });
  const msgId = Date.now().toString();
  const safeSender = sender.includes(',') ? `"${sender}"` : sender;
  const safeText   = text.includes(',')   ? `"${text}"`   : text;
  const row = `${msgId},${timestamp},${safeSender},${safeText}\n`;
  fs.appendFileSync(csvPath, row, 'utf8');
  res.json({ success: true });
});
// ---------------------------------------------------
// 6. memo.csv への位置情報送信 API
// ---------------------------------------------------
app.post('/api/memo/location', (req, res) => {
  const { school, className, group, author, lat, lng } = req.body;
  if (!school || !className || !group || !lat || !lng) {
    return res.status(400).json({ error: 'パラメータ不足' });
  }

  const schoolId = resolveSchoolId(school) || school;
  const classDir = normalizeClassDir(className);
  const groupDir = normalizeGroupDir(group);

  const csvPath = path.join(KANRI_DIR, schoolId, classDir, groupDir, 'memo.csv');

  // フォルダおよびヘッダーの存在確認・自動生成
  fs.mkdirSync(path.dirname(csvPath), { recursive: true });
  if (!fs.existsSync(csvPath)) {
    fs.writeFileSync(csvPath, CSV_TEMPLATES['memo.csv'], 'utf8');
  }

  const memoId = Date.now().toString();
  const timestamp = new Date().toLocaleString('ja-JP', { hour12: false });
  const safeAuthor = author ? (author.includes(',') ? `"${author}"` : author) : '自動送信';
  const content = `[現在地] 緯度:${lat}, 経度:${lng}`;
  const safeContent = content.includes(',') ? `"${content}"` : content;

  // memo.csv (memo_id,timestamp,author,content) に書き込み
  const row = `${memoId},${timestamp},${safeAuthor},${safeContent}\n`;
  fs.appendFileSync(csvPath, row, 'utf8');

  res.json({ success: true });
});


// 追加: 全班一斉送信API
app.post('/api/chat/broadcast', (req, res) => {
  const { school, className, sender, text } = req.body;
  if (!school || !className || !sender || !text) {
    return res.status(400).json({ error: 'パラメータ不足' });
  }
  const schoolId = resolveSchoolId(school) || school;
  const schoolDir = path.join(KANRI_DIR, schoolId);

  if (!fs.existsSync(schoolDir)) {
    return res.status(404).json({ error: '学校データが見つかりません' });
  }

  const timestamp = new Date().toLocaleString('ja-JP', { hour12: false });
  const safeSender = sender.includes(',') ? `"${sender}"` : sender;
  const safeText   = text.includes(',')   ? `"${text}"`   : text;

  try {
    const classDirs = fs.readdirSync(schoolDir).filter(d => d.startsWith('class'));
    classDirs.forEach(cDir => {
      const cPath = path.join(schoolDir, cDir);
      if (fs.statSync(cPath).isDirectory()) {
        const groupDirs = fs.readdirSync(cPath).filter(g => g.startsWith('group'));
        groupDirs.forEach(gDir => {
          const csvPath = path.join(cPath, gDir, 'message.csv');
          fs.mkdirSync(path.dirname(csvPath), { recursive: true });
          if (!fs.existsSync(csvPath)) {
            fs.writeFileSync(csvPath, 'msg_id,timestamp,sender,message\n', 'utf8');
          }
          const msgId = Date.now().toString();
          const row = `${msgId},${timestamp},${safeSender},${safeText}\n`;
          fs.appendFileSync(csvPath, row, 'utf8');
        });
      }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '一斉送信エラー' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Q-LINK サーバー起動中: http://localhost:${PORT}`);
});
// ===================================================
// 7. 写真アップロード API (data/kanri/.../photos へ保存)
// ===================================================
app.post('/api/photos/upload', (req, res) => {
  const { school, className, group, image } = req.body;

  if (!school || !className || !group || !image) {
    return res.status(400).json({ error: '必要なデータが不足しています' });
  }

  try {
    const schoolId = resolveSchoolId(school) || school;
    const classDir = normalizeClassDir(className);
    const groupDir = normalizeGroupDir(group);

    // 保存先フォルダパス: data/kanri/schoolX/classY/groupZ/photos
    const photosDir = path.join(KANRI_DIR, schoolId, classDir, groupDir, 'photos');
    fs.mkdirSync(photosDir, { recursive: true });

    // Base64データから画像バイナリへ変換
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // ユニークなファイル名を生成 (例: photo_1710000000000.jpg)
    const fileName = `photo_${Date.now()}.jpg`;
    const filePath = path.join(photosDir, fileName);

    // ファイル書き込み
    fs.writeFileSync(filePath, buffer);

    console.log(`[写真保存成功] ${filePath}`);
    res.json({ success: true, fileName: fileName });

  } catch (err) {
    console.error('写真保存エラー:', err);
    res.status(500).json({ error: '画像の保存に失敗しました' });
  }
});

// server.js の末尾付近（他のAPI定義の近く）に追加

// ===================================================
// 6-2. memo.csv から位置情報メモの取得 API
// ===================================================
app.get('/api/memo/location', (req, res) => {
  const { school, className, group } = req.query;
  if (!school) {
    return res.status(400).json({ error: '学校IDが必要です' });
  }

  const schoolId = resolveSchoolId(school) || school;
  const schoolDir = path.join(KANRI_DIR, schoolId);

  if (!fs.existsSync(schoolDir)) {
    return res.json([]);
  }

  const results = [];

  try {
    // 学校内の全クラスを取得
    const classDirs = fs.readdirSync(schoolDir).filter(d => d.startsWith('class'));
    
    classDirs.forEach(cDir => {
      // 特定のクラス指定がある場合はスキップ判定
      if (className && normalizeClassDir(className) !== cDir) return;

      const cPath = path.join(schoolDir, cDir);
      if (!fs.statSync(cPath).isDirectory()) return;

      const groupDirs = fs.readdirSync(cPath).filter(g => g.startsWith('group'));
      groupDirs.forEach(gDir => {
        // 特定の班指定がある場合はスキップ判定
        if (group && normalizeGroupDir(group) !== gDir) return;

        const csvPath = path.join(cPath, gDir, 'memo.csv');
        if (!fs.existsSync(csvPath)) return;

        const lines = fs.readFileSync(csvPath, 'utf8').split('\n').filter(Boolean);
        // ヘッダー(memo_id,timestamp,author,content)を除外して解析
        lines.slice(1).forEach(line => {
          // CSVのカンマ区切りを正規表現で分解
          const cols = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
          if (cols.length >= 4) {
            const memoId = cols[0].replace(/^"|"$/g, '');
            const timestamp = cols[1].replace(/^"|"$/g, '');
            const author = cols[2].replace(/^"|"$/g, '');
            const content = cols.slice(3).join(',').replace(/^"|"$/g, '');

            // content から緯度・経度を抽出 (" [現在地] 緯度:34.xxxx, 経度:135.xxxx " の形式)
            const match = content.match(/緯度:\s*([\d.]+),\s*経度:\s*([\d.]+)/);
            if (match) {
              results.push({
                memo_id: memoId,
                timestamp: timestamp,
                author: author,
                class_id: cDir,
                group_id: gDir,
                lat: parseFloat(match[1]),
                lng: parseFloat(match[2]),
                content: content
              });
            }
          }
        });
      });
    });

    res.json(results);
  } catch (err) {
    console.error('Memo get error:', err);
    res.status(500).json({ error: 'データの読み込みに失敗しました' });
  }
});
