// 最初の表示でちらつかないよう、<head> で明るさを決める（保存した選択 → OS の設定の順）
(function () {
  var t = null
  try { t = localStorage.getItem('pf-theme') } catch (e) { /* 保存できない環境 */ }
  if (t !== 'light' && t !== 'dark') {
    t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  document.documentElement.dataset.theme = t
})()
