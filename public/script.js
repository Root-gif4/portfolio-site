// ライト／ダークの切り替えと、画面写真の拡大表示
;(function () {
  'use strict'

  // ---- 明るさの切り替え ----
  var root = document.documentElement
  var toggle = document.getElementById('themeToggle')
  toggle.addEventListener('click', function () {
    var next = root.dataset.theme === 'dark' ? 'light' : 'dark'
    root.dataset.theme = next
    try { localStorage.setItem('pf-theme', next) } catch (e) { /* 保存できなくても切り替えはする */ }
  })

  // ---- ソースコードのリンク（data-repo に URL を書くと表示される） ----
  document.querySelectorAll('.code-link').forEach(function (p) {
    var url = p.getAttribute('data-repo')
    if (!url || !/^https:\/\/github\.com\//.test(url)) { p.remove(); return }
    var a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.textContent = 'ソースコード・設計書を見る（GitHub）'
    p.appendChild(a)
  })

  // ---- 写真の拡大表示 ----
  var viewer = document.getElementById('viewer')
  if (!viewer) return // 写真のないページ（個人情報の取り扱いなど）
  var img = document.getElementById('viewerImg')
  var cap = document.getElementById('viewerCap')
  var list = []
  var index = 0

  function show(i) {
    index = (i + list.length) % list.length
    var b = list[index]
    img.src = b.getAttribute('data-full')
    img.alt = b.querySelector('img').alt
    cap.textContent = b.getAttribute('data-caption') + '（' + (index + 1) + ' / ' + list.length + '）'
  }

  document.querySelectorAll('[data-gallery]').forEach(function (g) {
    var shots = Array.prototype.slice.call(g.querySelectorAll('.shot'))
    shots.forEach(function (b, i) {
      b.setAttribute('aria-label', b.getAttribute('data-caption') + '（拡大する）')
      b.addEventListener('click', function () {
        list = shots
        show(i)
        if (typeof viewer.showModal === 'function') viewer.showModal()
        else window.open(b.getAttribute('data-full'), '_blank', 'noopener')
      })
    })
  })

  viewer.querySelector('.viewer-close').addEventListener('click', function () { viewer.close() })
  viewer.querySelector('.prev').addEventListener('click', function () { show(index - 1) })
  viewer.querySelector('.next').addEventListener('click', function () { show(index + 1) })
  // 写真の外（暗い部分）を押したら閉じる
  viewer.addEventListener('click', function (e) { if (e.target === viewer) viewer.close() })
  viewer.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') show(index - 1)
    if (e.key === 'ArrowRight') show(index + 1)
  })
  // スマホの左右スワイプ
  var sx = null
  viewer.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX }, { passive: true })
  viewer.addEventListener('touchend', function (e) {
    if (sx === null) return
    var dx = e.changedTouches[0].clientX - sx
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1))
    sx = null
  })
  viewer.addEventListener('close', function () { img.removeAttribute('src') })
})()

// ---- 問い合わせフォーム：入力 → 確認 → 送信 ----
;(function () {
  'use strict'
  var form = document.getElementById('inquiryForm')
  if (!form) return
  var endpoint = form.getAttribute('data-endpoint') || ''
  var okEndpoint = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint)
  var steps = {}
  form.querySelectorAll('.iq-step').forEach(function (s) { steps[s.getAttribute('data-step')] = s })
  var $ = function (id) { return document.getElementById(id) }
  var EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[A-Za-z]{2,}$/

  // 送り先が設定されていないあいだは、フォームを使えないようにする
  if (!okEndpoint) {
    form.querySelector('.iq-off').hidden = false
    form.querySelectorAll('input, select, textarea, button').forEach(function (el) { el.disabled = true })
  }

  var msg = $('iqMessage')
  var count = function () { $('iqCount').textContent = msg.value.length }
  msg.addEventListener('input', count)
  count()

  function values() {
    return {
      name: $('iqName').value.trim(),
      email: $('iqEmail').value.trim(),
      kind: $('iqKind').value,
      budget: $('iqBudget').value,
      message: msg.value.trim(),
      agree: $('iqAgree').checked,
      website: $('iqWebsite').value
    }
  }

  function setErr(id, text) {
    var el = $(id + 'Err')
    el.textContent = text
    var input = $(id)
    if (text) input.setAttribute('aria-invalid', 'true')
    else input.removeAttribute('aria-invalid')
    input.setAttribute('aria-describedby', id + 'Err')
    return text ? 1 : 0
  }

  var RULES = {
    iqName: function (v) { return v.name ? '' : 'お名前を入れてください' },
    iqEmail: function (v) { return EMAIL.test(v.email) ? '' : 'メールアドレスの形を確かめてください（例：name@example.com）' },
    iqKind: function (v) { return v.kind ? '' : 'ご相談の種類を選んでください' },
    iqBudget: function (v) { return v.budget ? '' : '予算感を選んでください' },
    iqMessage: function (v) { return v.message.length >= 10 ? '' : '内容を 10 文字以上で入れてください' },
    iqAgree: function (v) { return v.agree ? '' : '送るには、個人情報の取り扱いへの同意が必要です' }
  }

  function validate(v) {
    var n = 0
    Object.keys(RULES).forEach(function (id) { n += setErr(id, RULES[id](v)) })
    return n === 0
  }

  // 一度エラーになった欄は、直したらすぐにエラーを消す
  function recheck(e) {
    var id = e.target.id
    if (RULES[id] && e.target.getAttribute('aria-invalid') === 'true') setErr(id, RULES[id](values()))
  }
  form.addEventListener('input', recheck)
  form.addEventListener('change', recheck)

  function go(name, focusId) {
    Object.keys(steps).forEach(function (k) { steps[k].hidden = k !== name })
    var f = focusId && $(focusId)
    if (f) f.focus()
    form.closest('.inquiry').scrollIntoView({ block: 'start' })
  }

  // 「確認する」
  form.addEventListener('submit', function (e) {
    e.preventDefault()
    if (!okEndpoint) return
    var v = values()
    if (!validate(v)) {
      var first = form.querySelector('[aria-invalid="true"]')
      if (first) first.focus()
      return
    }
    form.querySelectorAll('[data-show]').forEach(function (dd) { dd.textContent = v[dd.getAttribute('data-show')] })
    $('iqSendErr').textContent = ''
    go('confirm', 'iqConfirmTitle')
  })

  $('iqBack').addEventListener('click', function () { go('input', 'iqName') })

  // 「送信する」
  var sending = false
  $('iqSend').addEventListener('click', function () {
    if (sending || !okEndpoint) return
    sending = true
    var btn = this
    btn.disabled = true
    $('iqBack').disabled = true
    btn.textContent = '送信しています…'
    $('iqSendErr').textContent = ''
    // 文字列のまま送ると「text/plain」になり、Apps Script でもそのまま受け取れる
    fetch(endpoint, { method: 'POST', body: JSON.stringify(values()), redirect: 'follow' })
      .then(function (r) { return r.json() })
      .then(function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || '')
        $('iqNo').textContent = res.no ? '（受付番号：' + res.no + '）' : ''
        form.reset()
        count()
        go('done', 'iqDoneTitle')
      })
      .catch(function (err) {
        var text = err && err.message && !/fetch|network|JSON|Unexpected/i.test(err.message) ? err.message : 'うまく送れませんでした。通信の状態を確かめて、もう一度お試しください。'
        $('iqSendErr').textContent = text + '（何度も送れないときは、クラウドワークスからご連絡ください）'
      })
      .then(function () {
        sending = false
        btn.disabled = false
        $('iqBack').disabled = false
        btn.textContent = '送信する'
      })
  })
})()
