export const SETUP_MESSAGES = {
  setupTitle: '注文端末の初期設定',
  checking: '端末の設定を確認しています。',
  activating: '端末を有効化して認証しています。',
  retryTitle: '端末の設定を確認してください',
  codeFormat: '英数字4文字ずつ、3組の有効化コードを入力してください。',
  activationInputErrors: {
    400: '有効化コードを利用できません。店舗管理画面でコードの有効期限と端末の有効化状況を確認してください。',
    422: '有効化コードの形式を確認してください。',
  },
  activationResultUnknown: '有効化の結果を確認できませんでした。店舗管理画面で端末の有効化状況を確認してください。',
  registrationSaveFailed: '端末認証情報を保存できませんでした。この画面で再試行してください。',
  storageUnavailable: '端末の保存領域を利用できません。ブラウザーでサイトデータの保存を許可し、HTTPS で開いて再試行してください。',
  authenticationRejected: 'この端末は認証できません。店舗管理者が端末の利用状態を確認してから再試行してください。',
  authenticationFailed: '端末の認証に失敗しました。接続を確認して再試行してください。',
  qrRead: 'QRコードを読み取りました。入力欄のコードを確認して有効化してください。',
  invalidQr: '店舗管理画面に表示された端末有効化用のQRコードを読み取ってください。',
  cameraUnavailable: 'カメラで読み取れませんでした。有効化コードを入力してください。',
}
