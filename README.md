# teraid-pay-web-order

店舗に設置する注文端末向けの Vue 3 フロントエンドです。別途稼働する teraid-pay-api で端末を有効化・認証し、来店セッションを開始してメニューを表示し、カートの内容を注文として登録します。

## ローカルで開発

Node.js 22.12 以降と、起動済みの teraid-pay-api が必要です。

~~~powershell
npm ci --ignore-scripts
npm run dev
~~~

開発サーバーを起動したまま [http://localhost:4173/](http://localhost:4173/) を開きます。Vue や CSS を保存すると、Vite が開いている画面に変更を反映します。以前から開いていたプレビューのタブは、開発サーバーに切り替えた直後に一度再読み込みしてください。

開発サーバーとプレビューは、端末 API のリクエストを `.env` の `TERAID_PAY_API_TARGET` に転送します。環境ごとに接続先を変える場合は、Git の管理対象外の `.env.local` か、Vite を起動するプロセスの環境変数に同じ項目を設定してください。

プレビュー起動後に API の転送設定や接続先を変更した場合は、`npm run preview` を再起動して設定を読み込み直してください。

## 注文端末の初期設定

1. 店舗管理画面で端末を登録し、有効化コードを発行します。
2. 注文端末の初期設定画面にコードを入力します。カメラとブラウザーが QR コードの読み取りに対応している場合は、店舗管理画面に表示された有効化用 QR コードも利用できます。
3. 「端末を有効化」を押します。端末の有効化と認証に成功すると、「注文を開始」画面が表示されます。

端末認証情報は利用したブラウザープロファイルの IndexedDB に暗号化して保存します。以降は起動時に保存済みの情報で認証します。アクセストークンはメモリーに保持し、有効期限前に更新します。

有効化コードは一度だけ利用できます。認証情報の保存に失敗した場合は、画面を開いたまま「再試行」を押してください。有効化の応答を受信できなかった場合や、ブラウザーのサイトデータを消去して認証情報を失った場合は、店舗管理者に端末の有効化状況を確認してください。現行 API では有効化済みの端末認証情報を再発行できません。

## 来店セッションの開始

1. 待機画面で「注文する」を押すと、端末認証付きで `POST /device/visit-sessions` を呼び出します。
2. 開始に成功すると、`GET /device/menu/categories?visit_session_id=...` で店舗のカテゴリーを取得し、メニュー画面を表示します。
3. カテゴリーを押すと、`GET /device/menu/categories/{menu_category_id}/items?visit_session_id=...` で販売中の商品を取得し、画像と基本価格を表示します。
4. 商品を押すと、トッピングの選択画面に進みます。トッピングを選ぶと追加料金を小計に反映し、必要な選択がそろうと「カートに追加」を押せます。追加後は「カートに追加しました」と短く表示し、同じカテゴリーの商品一覧へ戻ります。
5. 画面右端の「カートを確認」を押すと、閲覧中のメニューの上にカートが開きます。商品、トッピング、数量、合計を確認でき、数量も変更できます。明細は確認ダイアログで「削除する」を押すと削除され、画面上部に「カートから削除しました」と短く表示されます。同じタブで再読み込みすると、来店セッションに対応するカートを復元します。「注文を確定して会計へ」を押すと、`POST /device/visit-sessions/{visit_session_id}/orders` でカートの内容を登録します。
6. 登録が完了すると自動でお会計に進みます。画面右端の「注文履歴」から、同じ来店セッションの注文を新しい順に確認できます。履歴の取得に失敗した場合は履歴画面から再試行できます。

送信前に `Idempotency-Key` と明細をタブの保存領域に保存します。応答を受け取れない場合は、同じタブを再読み込みした後も「注文を再試行」で同じキーと明細を送信できます。

開始要求IDを送信前にブラウザーへ保存します。応答を受け取れない場合は「再試行」で同じ開始要求IDを再送でき、ページ再読み込み後も再試行できます。開始完了後にページを再読み込みすると、保存済みのセッションIDから注文を再開します。

## 会計と来店セッションの終了

1. 注文確定後に `scope: all_unpaid` で会計を作成し、サーバーが確定した注文内容と合計金額を表示します。注文確定後は会計画面で支払いに進みます。会計画面に進む前に再読み込みした場合は、保存済みの注文受付結果から会計を再開します。
2. 「顔認証で支払う」でカメラを開き、支払者が「撮影して支払う」を押すと決済を送信します。撮影画像は送信に使用し、ブラウザーの保存領域に記録しません。
3. 決済試行IDを受け取ったら、確認中の画面を表示し、結果を3秒間隔で自動照会します。決済開始の応答を受け取れなかった場合は、同じ支払者を撮影し直して、保存済みの会計IDと冪等性キーで再送します。再読み込み時も保存済みの会計から再開します。
4. 決済が確定したら、支払い完了と注文番号を表示します。「追加注文する」を押すと同じ来店セッションのメニューに戻り、画面右端の「注文履歴」から支払い済みの注文を確認できます。追加注文の会計は、その時点で未払いの注文を対象にします。「注文を終了する」を押すと来店セッションを終了し、待機画面に戻ります。メニュー画面でも、フッターの「注文を終了する」から終了できます。セッションの終了が確認できた時点で、未確定のカートを消去します。

### 動作確認用の顔画像アップロード

検証用 API に接続するローカル開発環境で、`.env.local` に `VITE_FACE_PAYMENT_UPLOAD=true` を設定し、`npm run dev` を起動し直します。
会計画面の「顔画像で支払う（動作確認用）」から JPEG または PNG を選び、「この画像で決済を送信」を押すと、カメラ撮影時と同じ顔認証決済が開始されます。検証用の顔画像とアカウントを使ってください。
ファイルの選択だけでは送信せず、画像はブラウザーの保存領域に記録しません。設定を削除して開発サーバーを再起動すると無効になります。本番ビルドとそのプレビューでは表示されません。

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
| src/features/menu-categories/ | メニューカテゴリーと商品の選択、トッピングの選択と小計表示 |
| src/features/cart/ | カートの表示と保存、注文送信中の状態と受付結果 |
| src/features/order/ | 注文登録API、端末認証と応答の検証 |
| src/features/checkout/ | 会計明細、顔撮影、決済開始・結果照会・セッション終了 |
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

`npm run preview` は [http://localhost:4174/](http://localhost:4174/) でビルド済みの画面を確認するときに使います。

ビルド結果は dist/ に出力されます。本番では HTTPS の同一オリジンから dist/ を配信し、以下の端末 API を teraid-pay-api へ転送します。

- `POST /device/activate`
- `POST /device/auth/token`
- `POST /device/visit-sessions`
- `POST /device/visit-sessions/{visit_session_id}/orders`
- `GET /device/visit-sessions/{visit_session_id}/orders`
- `POST /device/visit-sessions/{visit_session_id}/checkouts`
- `POST /device/checkouts/{checkout_id}/payments/face`
- `POST /device/checkouts/{checkout_id}/payments/{payment_request_id}/verify`
- `POST /device/visit-sessions/{visit_session_id}/complete`
- `GET /device/menu/categories`
- `GET /device/menu/categories/{menu_category_id}/items`

転送時はパス、クエリ、リクエスト本文、`Authorization` と `Idempotency-Key` ヘッダー、レスポンスのステータスと `Cache-Control` ヘッダーを維持してください。カテゴリー画像と商品画像は、API が返す署名付き URL からブラウザーが取得します。本番では HTTPS の画像 URL を返すよう API を構成してください。ブラウザーでは JavaScript、サイトデータの保存、Web Crypto、Web Locks が利用できる必要があります。顔認証決済ではカメラの利用権限が必要です。端末の登録と認証は配信元のオリジンに紐づきます。

## 初期設定画面のレイアウト

手入力と QR 読み取りを独立したエリアに配置し、広い画面では２列、狭い画面では手入力から縦に並べます。端末コードで登録する操作と、画面幅に応じた領域の配置を参考にしました。[Square for Restaurants の端末設定](https://squareup.com/help/us/en/article/6390-create-a-device-code-for-square-for-restaurants) · [Android Developers のアダプティブレイアウト](https://developer.android.com/design/ui/mobile/guides/layout-and-content/adapt-layout)
