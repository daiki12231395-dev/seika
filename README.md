# 大阪市GISアプリ スターターテンプレート

CRUXSYSTEM インターンシップ 2026 実習用テンプレートです。

---

## このテンプレートでできること

- 大阪市の地図を表示する（国土地理院タイル）
- CSVファイルから施設データを読み込んで地図にピンを立てる
- Claude Codeを使って機能を追加していく

---

## 使い方

### 1. VSCodeで開く

このフォルダをVSCodeで開いてください。

```
ファイル → フォルダーを開く → osaka-gis-starter を選択
```

### 2. Live Serverで起動する

VSCodeの右下の「Go Live」ボタンをクリックするか、
index.htmlを右クリックして「Open with Live Server」を選択してください。

> ⚠️ index.htmlをダブルクリックで開くとCSVが読み込めません。
> 必ずLive Serverを使って開いてください。

### 3. Claude Codeで開発する

ターミナルを開いて以下を実行してください：

```bash
claude
```

PROMPT_EXAMPLES.mdの指示例を参考に、機能を追加していきましょう。

---

## フォルダ構成

```
osaka-gis-starter/
├── index.html          メインページ（地図が表示されます）
├── style.css           スタイル
├── data/
│   ├── park.csv        公園データ（サンプル）
│   └── shelter.csv     避難所データ（サンプル）
├── .claude/
│   └── settings.json   Claude Codeの安全ガード（下記参照）
├── CLAUDE.md           Claude Codeへの設定・制限
├── PROMPT_EXAMPLES.md  Claude Codeへの指示例集
└── README.md           このファイル
```

## 安全ガードについて（チューター向け補足）

`.claude/settings.json` に、誤削除・外部送信等を防ぐdenyルールを設定しています。学生がClaude Codeの権限モードを「全承認」に変更しても、denyルールはモードに関わらず有効です（Claude Codeの仕様上、拒否ルールは全承認モードでも無効化されません）。追加の設置作業は不要で、このテンプレートを配布するだけで有効になります。

---

## データについて

`data/`フォルダにはサンプルデータが入っています。
実際のプロジェクトでは、大阪市オープンデータポータルから
テーマに合ったデータをダウンロードして使ってください。

**大阪市オープンデータポータル：**
https://www.city.osaka.lg.jp/contents/wdu290/opendata/

---

## 使用している技術

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Leaflet.js | 1.9.4 | 地図表示 |
| PapaParse | 5.4.1 | CSV読み込み |
| 国土地理院タイル | - | 地図データ（無料） |

---

## 困ったときは

1. まず `PROMPT_EXAMPLES.md` のエラー対処のセクションを確認
2. Claude Codeに「エラーが出ました：[エラー内容]」と伝える
3. 30分以上解決しない場合はチューターを呼ぶ
