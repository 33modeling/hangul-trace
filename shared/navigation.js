// 공통 네비게이션
class Navigation {
  // updateFeedback·modeName 은 위치 인자 호환을 위해 시그니처에 남겨두지만
  // 현재 Navigation 내부에서는 쓰지 않는다(획 카운트·라벨은 각 모드가 직접 관리).
  constructor(items, updateUI, updateFeedback, modeName, uiIds = {}) {
    this.items = items;
    this.currentIdx = 0;
    this.total = items.length;
    this.updateUI = updateUI;
    this.doneSet = new Set();
    this.dotsId = uiIds.dotsId || 'dots';
    if (this.total > 0) this.renderDots();
  }

  prev() {
    this.goTo((this.currentIdx - 1 + this.total) % this.total);
  }

  next() {
    this.goTo((this.currentIdx + 1) % this.total);
  }

  goTo(idx) {
    this.currentIdx = idx;
    this.updateUI(idx);
    this.renderDots();
  }

  getIsDone() {
    return this.doneSet.has(this.currentIdx);
  }

  renderDots() {
    const dotsEl = document.getElementById(this.dotsId);
    if (!dotsEl) return;

    dotsEl.innerHTML = '';

    this.items.forEach((item, idx) => {
      const done = this.doneSet.has(idx);
      // <button> 으로 만들어 키보드 포커스/스크린리더 접근 가능하게 한다
      // (이전엔 클릭만 되는 <div> 라 키보드/AT 로 글자 이동이 불가능했음).
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'dot' +
        (idx === this.currentIdx ? ' active' : '') +
        (done ? ' done' : '');
      const label = item.name || item.ch || String(idx + 1);
      dot.title = label;
      dot.setAttribute('aria-label', `${idx + 1}번 ${label}${done ? ' (완료)' : ''}`);
      if (idx === this.currentIdx) dot.setAttribute('aria-current', 'true');
      dot.addEventListener(
        'click',
        (ev) => {
          ev.preventDefault();
          this.goTo(idx);
        },
        { passive: false }
      );
      dotsEl.appendChild(dot);
    });

    // 획수 힌트(#stroke-hint)는 각 모드의 updateUI 가 단독으로 그린다 —
    // 과거엔 여기서도 같은 pill 을 써서 이동마다 이중 렌더링됐다(제거).
  }
}
