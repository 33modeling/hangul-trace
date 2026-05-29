// 공통 네비게이션
class Navigation {
  constructor(items, updateUI, updateFeedback, modeName, uiIds = {}) {
    this.items = items;
    this.currentIdx = 0;
    this.total = items.length;
    this.updateUI = updateUI;
    this.updateFeedback = updateFeedback;
    this.doneSet = new Set();
    this.modeName = modeName;
    this.strokeCount = 0;
    this.dotsId = uiIds.dotsId || 'dots';
    this.strokeHintId = uiIds.strokeHintId || 'stroke-hint';
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
    this.strokeCount = 0;
    this.updateUI(idx);
    this.renderDots();
  }
  
  addStroke() {
    this.strokeCount++;
    this.updateFeedback(this.strokeCount);
    
    const char = this.items[this.currentIdx];
    if (this.strokeCount >= char.strokes && !this.doneSet.has(this.currentIdx)) {
      this.doneSet.add(this.currentIdx);
      this.renderDots();
    }
  }
  
  clear() {
    this.strokeCount = 0;
    this.updateFeedback(this.strokeCount);
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
    
    // 히ंट 레이블 업데이트
    const hintEl = document.getElementById(this.strokeHintId);
    if (hintEl) {
      const currentChar = this.items[this.currentIdx];
      hintEl.innerHTML = `
        <span class="hint-pill">${currentChar.strokes}획</span>
        <span class="hint-pill">위에서 아래</span>
        <span class="hint-pill">왼쪽에서 오른쪽</span>
      `;
    }
  }
  
  updateLabel(charLabel, subLabel) {
    if (charLabel) {
      const currentChar = this.items[this.currentIdx];
      if (currentChar) {
        charLabel.textContent = `${currentChar.ch} · ${currentChar.name}`;
        if (subLabel) subLabel.textContent = `${this.modeName} ${this.currentIdx + 1} / ${this.total}`;
      }
    }
  }
  
  getIndex() {
    return {
      current: this.currentIdx,
      total: this.total
    };
  }
}
