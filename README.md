# teraid-pay-web-order

Vue 3 と Vite で構成したフロントエンドの雛形です。Vue のテンプレートはビルド時にコンパイルします。

## ローカルで開発

Node.js 22.12 以上のサポート中のバージョンが必要です。このディレクトリで以下を実行し、Vite が表示するローカル URL を開きます。

~~~powershell
npm ci --ignore-scripts
npm run dev
~~~

開発サーバーは 127.0.0.1 で待ち受けます。開発時の CSP では、自動更新に使う WebSocket を同じローカルポートに限って許可します。

## ビルドと確認

~~~powershell
npm run build
npm run preview
~~~

ビルド結果は dist/ に出力されます。公開時はこのディレクトリを静的ファイルとして配信します。初期ページの CSP は、同一オリジンからのスクリプトとスタイルシートの読み込みを許可します。
