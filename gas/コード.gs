// ポートフォリオサイトの問い合わせフォームを受け取る Google Apps Script
// ・届いた内容をシート「問い合わせ」に記録し、このスクリプトを作った人の Gmail に通知する
// ・送り先のメールアドレスはどこにも書かない（Session.getEffectiveUser() で自分を使う）
// ・ウェブアプリとして「次のユーザーとして実行：自分」「アクセスできるユーザー：全員」で公開する
// 設置の手順は docs/問い合わせフォームの設置.md

var SHEET = '問い合わせ';
var HEAD = ['受付日時', '受付番号', 'お名前', 'メールアドレス', 'ご相談の種類', '予算感', '内容', '同意'];
var KINDS = ['システム開発', '業務の自動化（CSV・Excel・スプレッドシートなど）', 'Webサイト・Webアプリ', 'その他'];
var BUDGETS = ['5万円未満', '5万〜10万円', '10万〜30万円', '30万〜50万円', '50万円以上', '未定・相談して決めたい'];
var LIMIT_PER_HOUR = 20;   // 1 時間に受け付ける最大の件数（いたずらの連続送信で Gmail の上限を使い切らないように）
var SAME_EMAIL_SECONDS = 120; // 同じメールアドレスからの続けての送信を受け付けない秒数

// 最初に一度、エディタから実行する（シートの準備と、メール送信の権限の許可）
function setup() {
  sheet_();
  Logger.log('準備ができました。通知の送り先：' + Session.getEffectiveUser().getEmail());
}

// 送れるかを確かめる（自分あてにテストのメールが届く）
function testMail() {
  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    subject: '【ポートフォリオ】問い合わせフォームのテスト',
    body: 'このメールが届いていれば、通知の設定はできています。'
  });
}

function doGet() {
  return json_({ ok: true, message: '問い合わせフォームの受け口です' });
}

function doPost(e) {
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    // ロボット対策：人には見えない欄に何か入っていたら、受け付けたふりをして捨てる
    if (d.website) return json_({ ok: true });

    var f = {
      name: text_(d.name, 50),
      email: text_(d.email, 254).toLowerCase(),
      kind: text_(d.kind, 60),
      budget: text_(d.budget, 30),
      message: text_(d.message, 3000, true),
      agree: d.agree === true
    };
    var err = check_(f);
    if (err) return json_({ ok: false, error: err });

    var cache = CacheService.getScriptCache();
    var hourKey = 'count:' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHH');
    var count = Number(cache.get(hourKey) || 0);
    if (count >= LIMIT_PER_HOUR) return json_({ ok: false, error: 'ただいま混み合っています。時間をおいてもう一度お送りください。' });
    var mailKey = 'mail:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, f.email));
    if (cache.get(mailKey)) return json_({ ok: false, error: '続けて送られたため受け付けませんでした。少し時間をおいてお送りください。' });

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    var no;
    try {
      var sh = sheet_();
      no = 'Q' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyMMdd') + '-' + ('000' + sh.getLastRow()).slice(-3);
      sh.appendRow([new Date(), no, f.name, f.email, f.kind, f.budget, f.message, '同意する'].map(cell_));
    } finally {
      lock.releaseLock();
    }
    cache.put(hourKey, String(count + 1), 3600);
    cache.put(mailKey, '1', SAME_EMAIL_SECONDS);

    MailApp.sendEmail({
      to: Session.getEffectiveUser().getEmail(),
      replyTo: f.email,
      name: 'ポートフォリオの問い合わせ',
      subject: '【ポートフォリオ】お問い合わせ ' + no + '（' + f.kind + '）',
      body: [
        'ポートフォリオサイトの問い合わせフォームから、新しいお問い合わせが届きました。',
        'このメールに返信すると、お問い合わせの方に届きます。',
        '',
        '受付番号：' + no,
        'お名前：' + f.name,
        'メールアドレス：' + f.email,
        'ご相談の種類：' + f.kind,
        '予算感：' + f.budget,
        '',
        '――― 内容 ―――',
        f.message,
        '',
        '（スプレッドシートの「' + SHEET + '」にも記録しています）'
      ].join('\n')
    });
    return json_({ ok: true, no: no });
  } catch (ex) {
    // 中のくわしい様子は画面に出さず、実行ログにだけ残す
    console.error(ex);
    return json_({ ok: false, error: 'うまく送れませんでした。時間をおいてもう一度お試しください。' });
  }
}

function check_(f) {
  if (!f.name) return 'お名前を入れてください。';
  if (!/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[A-Za-z]{2,}$/.test(f.email)) return 'メールアドレスの形を確かめてください。';
  if (KINDS.indexOf(f.kind) < 0) return 'ご相談の種類を選んでください。';
  if (BUDGETS.indexOf(f.budget) < 0) return '予算感を選んでください。';
  if (f.message.length < 10) return '内容を 10 文字以上で入れてください。';
  if (!f.agree) return '個人情報の取り扱いへの同意が必要です。';
  return '';
}

// 文字の整理：前後の空白を取り、制御文字を消し、長さを切る（複数行は改行だけ残す）
function text_(v, max, multiline) {
  var s = String(v == null ? '' : v).replace(/\r\n?/g, '\n');
  s = multiline ? s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '') : s.replace(/[\u0000-\u001F\u007F]/g, ' ');
  return s.trim().slice(0, max);
}

// シートに書くとき、数式として動かないようにする
function cell_(v) {
  if (typeof v !== 'string') return v;
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties();
  if (!ss) ss = SpreadsheetApp.openById(props.getProperty('SSID'));
  else props.setProperty('SSID', ss.getId());
  var sh = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEAD);
    sh.getRange(1, 1, 1, HEAD.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
