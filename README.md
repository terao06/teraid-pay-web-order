# teraid-pay-web-order

店舗に設置する注文端末向けの Vue 3 フロントエンドです。別途稼働する teraid-pay-api で端末を有効化・認証し、来店セッションを開始します。

## ローカルで開発

Node.js 22.12 以降と、起動済みの teraid-pay-api が必要です。Vite が表示するローカル URL を開きます。

~~~powershell
npm ci --ignore-scripts
npm run dev
~~~

開発サーバーとプレビューは、端末 API のリクエストを `.env` の `TERAID_PAY_API_TARGET` に転送します。環境ごとに接続先を変える場合は、Git の管理対象外の `.env.local` か、Vite を起動するプロセスの環境変数に同じ項目を設定してください。

## 注文端末の初期設定

1. 店舗管理画面で端末を登録し、有効化コードを発行します。
2. 注文端末の初期設定画面にコードを入力します。カメラとブラウザーが QR コードの読み取りに対応している場合は、店舗管理画面に表示された有効化用 QR コードも利用できます。
3. 「端末を有効化」を押します。端末の有効化と認証に成功すると、「注文を開始」画面が表示されます。

端末認証情報は利用したブラウザープロファイルの IndexedDB に暗号化して保存します。以降は起動時に保存済みの情報で認証します。アクセストークンはメモリーに保持し、有効期限前に更新します。

有効化コードは一度だけ利用できます。認証情報の保存に失敗した場合は、画面を開いたまま「再試行」を押してください。有効化の応答を受信できなかった場合や、ブラウザーのサイトデータを消去して認証情報を失った場合は、店舗管理者に端末の有効化状況を確認してください。現行 API では有効化済みの端末認証情報を再発行できません。

## 来店セッションの開始

1. 待機画面で「注文する」を押します。
2. 「一括決済」または「注文ごとの決済」を選ぶと、端末認証付きで `POST /device/visit-sessions` を呼び出します。
3. 開始に成功すると、開始完了と選択したお支払い方法が表示されます。

開始要求IDと決済方式を送信前にブラウザーへ保存します。応答を受け取れない場合は「再試行」で同じ開始要求IDを再送でき、ページ再読み込み後も再試行できます。開始完了後は、決済方式をセッションIDに紐づけて保存し、再読み込み時に開始結果を復元します。現在のセッションをサーバーと照合する機能と、メニュー表示以降の画面は今後のAPI連携範囲です。

## ディレクトリ構成

| 場所 | 役割 |
| --- | --- |
| src/features/device-setup/DeviceSetupPage.vue | 初期設定ページとステータス表示 |
| src/features/device-setup/ActivationForm.vue | 初期設定専用の有効化フォーム |
| src/components/qrcode/ | カメラで QR コードを読み取り、読み取った文字列を渡す共通部品 |
| src/features/device-setup/composables/ | 画面状態とトークン更新タイマー |
| src/features/device-setup/domain/ | 有効化コードと QR の形式 |
| src/features/device-setup/api/ | 初回有効化 API |
| src/features/device-setup/services/ | 有効化の順序、複数タブの排他、保存の再試行 |
| src/features/device-auth/deviceSession.js | 各画面から利用する端末認証の入口 |
| src/features/device-auth/api/ | トークン発行 API |
| src/features/device-auth/services/ | トークンの取得、キャッシュ、更新 |
| src/features/visit-session/ | 注文待機画面、決済方式の選択、来店セッション開始と保存 |
| src/shared/device-registration/ | 両機能が使う認証情報の形式、暗号化、IndexedDB 保存 |
| src/components/api/ | JSON 通信、タイムアウト、HTTP エラーの共通処理 |
| src/styles/ | 共通スタイル |
| test/features/ | 機能ごとのユニットテスト |
| test/shared/ | 共通処理のユニットテスト |
| test/components/api/ | API クライアントのユニットテスト |

初期設定画面が端末認証情報の保存を完了してから、端末認証にトークンを要求します。端末認証は保存済みの情報を読み取ってトークンを取得し、認証情報の書き込みは初期設定が担当します。

注文や決済などの画面を追加するときは、`src/features/` の下に機能フォルダーを作り、機能固有の画面部品は該当機能の配下に置きます。複数の機能で再利用できる画面部品は `src/components/` に置きます。API のパスとデータ形式は各機能の `api/` に置き、通信には `src/components/api/apiClient.js` の `requestJson()` を使います。端末認証が必要な API では `deviceSession.getAccessToken()` でトークンを取得し、`requestJson()` に `Authorization` ヘッダーを渡します。

## ビルドと配信

~~~powershell
npm test
npm run build
npm run preview
~~~

ビルド結果は dist/ に出力されます。本番では、HTTPS の同一オリジンから dist/ を配信し、`POST /device/activate`、`POST /device/auth/token`、`POST /device/visit-sessions` を teraid-pay-api へ転送します。転送時はパス、リクエスト本文、`Authorization` ヘッダー、レスポンスのステータスと `Cache-Control` ヘッダーを維持してください。ブラウザーでは JavaScript、サイトデータの保存、Web Crypto、Web Locks が利用できる必要があります。端末の登録と認証は配信元のオリジンに紐づきます。

## 初期設定画面のレイアウト

手入力と QR 読み取りを独立したエリアに配置し、広い画面では２列、狭い画面では手入力から縦に並べます。端末コードで登録する操作と、画面幅に応じた領域の配置を参考にしました。[Square for Restaurants の端末設定](https://squareup.com/help/us/en/article/6390-create-a-device-code-for-square-for-restaurants) · [Android Developers のアダプティブレイアウト](https://developer.android.com/design/ui/mobile/guides/layout-and-content/adapt-layout)
