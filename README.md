# SVC MCP Server

IBM SAN Volume Controller (SVC) 用の Model Context Protocol (MCP) サーバーです。
このサーバーを使用すると、IBM Bob などの AI アシスタントから SVC ストレージシステムを操作できます。

## 機能

このMCPサーバーは以下の操作をサポートしています：

- **システムステータス確認** (`check_system_status`): SVCシステムの状態を確認（lssystemコマンドを実行）
- **汎用コマンド実行** (`execute_svc_command`): 任意のSVC CLIコマンドを直接実行できる汎用ツール。lsvdisk、lshost、mkvdiskなど、あらゆるSVCコマンドに対応

## 前提条件

- Node.js 18以上
- npm または yarn
- IBM SVC へのSSHアクセス権限

## インストール

1. リポジトリをクローン：
```bash
git clone <repository-url>
cd svc-mcp-server
```

2. 依存関係をインストール：
```bash
npm install
```

3. プロジェクトをビルド：
```bash
npm run build
```

## 設定方法

### 1. 環境変数の設定

`.env.template` をコピーして `.env` ファイルを作成します：

```bash
cp .env.template .env
```

`.env` ファイルを編集して、SVC接続情報を設定します：

```env
# SVC ホスト名またはIPアドレス（必須）
SVC_HOST=your-svc-host.example.com

# SVC SSHポート（デフォルト: 22）
SVC_PORT=22

# SVC SSH ユーザー名（デフォルト: superuser）
SVC_USERNAME=superuser

# SVC SSH パスワード（パスワード認証を使用する場合）
SVC_PASSWORD=your-password

# SVC SSH 秘密鍵のパス（鍵認証を使用する場合）
SVC_PRIVATE_KEY_PATH=/path/to/svc/private/key

# SSHプロキシ設定（SSHトンネル経由で接続する場合）
SVC_PROXY_HOST=proxy.example.com
SVC_PROXY_PORT=22
SVC_PROXY_USERNAME=proxy-user
SVC_PROXY_PASSWORD=proxy-password
SVC_PROXY_PRIVATE_KEY_PATH=/path/to/proxy/private/key
```

**SVC認証方法：**
- パスワード認証: `SVC_PASSWORD` を設定
- 鍵認証: `SVC_PRIVATE_KEY_PATH` を設定
- どちらか一方を設定してください

**SSHプロキシ認証方法：**
- パスワード認証: `SVC_PROXY_PASSWORD` を設定
- 鍵認証: `SVC_PROXY_PRIVATE_KEY_PATH` を設定
- どちらか一方を設定してください
- プロキシを使用しない場合は、これらの設定を省略できます

### 2. IBM Bob での設定

IBM Bob の設定ファイル（`.bob/mcp.json`）を作成します：

```bash
cp .bob/mcp.json.example .bob/mcp.json
```

`.bob/mcp.json` を編集して、SVC接続情報を設定します：

```json
{
  "mcpServers": {
    "svc": {
      "command": "node",
      "args": ["${PWD}/build/index.js"],
      "env": {
        "SVC_HOST": "your-svc-hostname",
        "SVC_PORT": "22",
        "SVC_USERNAME": "superuser",
        "SVC_PASSWORD": "your-password",
        "SVC_PRIVATE_KEY_PATH": "/path/to/svc/private/key",
        "SVC_PROXY_HOST": "your-proxy-hostname",
        "SVC_PROXY_PORT": "22",
        "SVC_PROXY_USERNAME": "proxy-username",
        "SVC_PROXY_PASSWORD": "proxy-password",
        "SVC_PROXY_PRIVATE_KEY_PATH": "/path/to/proxy/private/key"
      }
    }
  }
}
```

**SSHプロキシについて：**
- このMCPサーバーは、SSHトンネル（ポートフォワーディング）を使用してプロキシ経由でSVCに接続します
- プロキシサーバーへのSSH接続が確立された後、そのトンネルを通じてSVCへ接続します
- プロキシ認証は、パスワード認証または鍵認証のどちらかを使用できます
- プロキシを使用しない場合は、プロキシ関連の設定を省略してください

または、`.env` ファイルを使用する場合（環境変数が自動的に読み込まれます）：

```json
{
  "mcpServers": {
    "svc": {
      "command": "node",
      "args": ["${PWD}/build/index.js"]
    }
  }
}
```

### 3. IBM Bob を再起動

設定を反映するため、IBM Bob を再起動してください。

## 使用方法

IBM Bob で以下のようなプロンプトを使用できます：

### システムステータスの確認
```
SVCシステムのステータスを確認してください
```

### ボリューム操作
```
すべてのボリュームをリストアップしてください
```

```
pool1に100GBのボリュームを作成してください。名前はtest_vol01です
```

```
test_vol01という名前のボリュームの詳細情報を表示してください
```

### ホスト管理
```
登録されているすべてのホストを表示してください
```

```
host1という名前のホストの詳細情報を確認してください
```

### その他の操作
```
最新のイベントログを表示してください
```

```
すべてのストレージプールの使用状況を確認してください
```

**注意**: `execute_svc_command` ツールを使用することで、上記以外のあらゆるSVC CLIコマンドを実行できます。IBM Bobに自然言語で指示すると、適切なSVCコマンドに変換して実行します。

---

## 開発


### ビルド

```bash
npm run build
```

### 実行

```bash
npm start
```

## トラブルシューティング

### 接続エラー

- `SVC_HOST` が正しく設定されているか確認
- ネットワーク接続を確認
- SSHプロキシを使用する場合：
  - `SVC_PROXY_HOST` と `SVC_PROXY_PORT` が正しく設定されているか確認
  - プロキシへのSSH接続が可能か確認（`ssh user@proxy-host` でテスト）
  - プロキシ認証情報（パスワードまたは秘密鍵）が正しいか確認
  - プロキシサーバーからSVCホストへの接続が許可されているか確認

### 認証エラー

- ユーザー名とパスワード/秘密鍵が正しいか確認
- SSH接続が許可されているか確認

### コマンド実行エラー

- SVCユーザーに適切な権限があるか確認
- コマンド構文が正しいか確認

## セキュリティに関する注意

- `.env` ファイルは `.gitignore` に含まれており、Gitリポジトリにコミットされません
- パスワードや秘密鍵は安全に管理してください
- 本番環境では、秘密鍵認証の使用を推奨します

## 注意事項

本コードは現状有姿（AS-IS）で公開しており、動作保証はありません。検証環境等で十分テストの上、自己責任でご利用ください