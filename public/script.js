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
