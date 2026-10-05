/**
 * The Work filter row, shared by the desktop Work panel and the mobile Work
 * sheet: filter chips on one line (extras fold into "More") and a quiet sort
 * dropdown on the right. Buttons call window.display.filterWork / sortWork,
 * which each page defines.
 */

/**
 * Fill `row` with the chips and sort menu, keeping keyboard focus on the same
 * control across the rebuild.
 * @param {HTMLElement} row
 * @param {{ filters: {value,label}[], active: string, sorts: [string,string][], sort: string, showSort: boolean, scroller?: HTMLElement }} o
 */
export function renderFilterRow(row, { filters, active, sorts, sort, showSort, scroller }) {
  let chipIndex = 0;
  const chip = (value, label) =>
    `<button class="fb${active === value ? ' active' : ''}" aria-pressed="${active === value}" data-i="${chipIndex++}" onclick="window.display?.filterWork?.(this, '${value}')">${label}</button>`;
  const sortLabel = (sorts.find(([v]) => v === sort) || sorts[0])[1];
  const sortHTML = showSort ? `<div class="wf-dd wf-sort">
      <button class="wf-dd-btn wf-sort-btn" aria-expanded="false" aria-controls="wf-sort-menu" aria-label="Sort: ${sortLabel}">${sortLabel} <span class="wf-caret" aria-hidden="true">▾</span></button>
      <div class="wf-menu wf-menu-right" id="wf-sort-menu">${sorts.map(([v, l]) =>
        `<button class="wf-opt${sort === v ? ' active' : ''}" aria-pressed="${sort === v}" onclick="window.display?.sortWork?.('${v}')">${l}</button>`).join('')}</div>
    </div>` : '';
  // Rebuilding the row drops keyboard focus; put it back on the same control afterwards
  const refocus = row.contains(document.activeElement) || document.activeElement === document.body ? row._focusKey : null;
  // Filters stay as chips; any that don't fit on one line fold into "More" (see fitWorkFilters)
  row.innerHTML = `<div class="wf-chips" role="group" aria-label="Filter work">${chip('all', 'All') + filters.map(f => chip(f.value, f.label)).join('')}</div>
    <div class="wf-dd wf-more" hidden><button class="fb wf-dd-btn" aria-expanded="false" aria-controls="wf-more-menu"></button><div class="wf-menu" id="wf-more-menu" role="group" aria-label="More filters"></div></div>`
    + sortHTML;
  bindWorkFilterRow(row, scroller);
  fitWorkFilters(row);
  if (refocus) {
    const el = [...row.querySelectorAll('button')].find(b => filterControlKey(b) === refocus);
    // A choice inside a (now closed) menu hands focus to that menu's button
    (el?.getClientRects().length ? el : el?.closest('.wf-dd')?.querySelector('.wf-dd-btn'))?.focus({ preventScroll: true });
  }
}

/**
 * Keep the filter chips on one line: chips that don't fit move, last first,
 * into the "More" menu. If the active filter is in there, the button shows it.
 */
export function fitWorkFilters(row) {
  const chipsEl = row.querySelector('.wf-chips');
  const more = row.querySelector('.wf-more');
  if (!chipsEl || !more) return;
  const menu = more.querySelector('.wf-menu');
  const btn = more.querySelector('.wf-dd-btn');
  // Start from every chip back on the line, in order
  [...menu.children].forEach(el => chipsEl.appendChild(el));
  [...chipsEl.children].sort((a, b) => a.dataset.i - b.dataset.i).forEach(el => chipsEl.appendChild(el));
  more.hidden = true;
  if (!row.clientWidth) return; // not laid out yet; the resize observer fits it later
  if (chipsEl.scrollWidth <= chipsEl.clientWidth + 1) return;
  more.hidden = false;
  btn.innerHTML = 'More <span aria-hidden="true">▾</span>';
  // Never fold "All"
  while (chipsEl.children.length > 1 && chipsEl.scrollWidth > chipsEl.clientWidth + 1) {
    menu.prepend(chipsEl.lastElementChild);
  }
  const active = menu.querySelector('.fb.active');
  btn.classList.toggle('active', !!active);
  if (active) btn.innerHTML = `${active.textContent} <span aria-hidden="true">▾</span>`;
}

// Identifies a filter-row button across re-renders (chips and options by their action)
const filterControlKey = b => b.getAttribute('onclick')
  || (b.classList.contains('wf-dd-btn') ? (b.closest('.wf-sort') ? 'dd:sort' : 'dd:more') : '');

/** Open/close the filter row's dropdowns; re-fit the chips when the row resizes. */
function bindWorkFilterRow(row, scroller = row.closest('.pb')) {
  if (row.dataset.bound) return;
  row.dataset.bound = '1';
  row.addEventListener('focusin', e => { row._focusKey = filterControlKey(e.target); });
  // A thin line under the pinned filter row once the grid scrolls beneath it
  if (scroller) scroller.addEventListener('scroll', () => row.classList.toggle('is-stuck', scroller.scrollTop > 8), { passive: true });
  // Dropdowns are disclosure buttons: aria-expanded follows the open class
  const setOpen = (dd, open) => {
    dd.classList.toggle('open', open);
    dd.querySelector('.wf-dd-btn')?.setAttribute('aria-expanded', String(open));
  };
  const closeAll = except => row.querySelectorAll('.wf-dd.open').forEach(el => { if (el !== except) setOpen(el, false); });
  row.addEventListener('click', e => {
    const toggle = e.target.closest('.wf-dd-btn');
    const dd = toggle?.closest('.wf-dd');
    closeAll(dd);
    if (dd) setOpen(dd, !dd.classList.contains('open'));
  });
  document.addEventListener('click', e => {
    if (!row.contains(e.target)) { closeAll(); row._focusKey = null; }
  });
  // Keyboard: Escape closes an open menu (not the panel) and returns to its button;
  // tabbing out of a menu closes it
  row.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const dd = e.target.closest('.wf-dd.open');
    if (!dd) return;
    e.stopPropagation();
    setOpen(dd, false);
    dd.querySelector('.wf-dd-btn')?.focus();
  });
  row.addEventListener('focusout', e => {
    const dd = e.target.closest('.wf-dd.open');
    if (dd && !dd.contains(e.relatedTarget) && e.relatedTarget) setOpen(dd, false);
    if (e.relatedTarget && !row.contains(e.relatedTarget)) row._focusKey = null;
  });
  let queued = false;
  new ResizeObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fitWorkFilters(row); });
  }).observe(row);
}

/** Show each card's like count in its meta line (only while sorting by likes). */
export function markCardLikes(cards, keys, counts, show) {
  cards.forEach((el, i) => {
    el.querySelector('.wc-likes')?.remove();
    if (show) {
      el.querySelector('.wcty')?.insertAdjacentHTML('beforeend',
        `<span class="wc-likes"><i class="ph-fill ph-heart"></i> ${counts.get(keys[i]) || 0}</span>`);
    }
  });
}
