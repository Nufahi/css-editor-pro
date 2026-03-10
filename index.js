const MODULE_NAME = 'css-editor-pro';

const context = SillyTavern.getContext();
const { extensionSettings, saveSettingsDebounced, eventSource, event_types } = context;

/* ---- Settings ---- */
const defaultSettings = Object.freeze({
    enabled: true,
    position: { top: 100, left: null },
    size: { width: 420, height: 500 },
    isCollapsed: false,
});

function getSettings() {
    extensionSettings[MODULE_NAME] = SillyTavern.libs.lodash.merge(
        structuredClone(defaultSettings),
        extensionSettings[MODULE_NAME]
    );
    return extensionSettings[MODULE_NAME];
}

/* ---- Settings UI ---- */
function createSettingsUI() {
    const html = `
        <div class="css-editor-pro-settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>CSS Editor Pro</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <div class="flex-container" style="align-items:center;gap:10px;margin-bottom:8px;">
                        <input id="cep-toggle" type="checkbox" />
                        <label for="cep-toggle">Показывать CSS редактор</label>
                    </div>
                    <button id="cep-reset-pos" class="menu_button" style="width:100%;font-size:12px;padding:7px 14px;">
                        <i class="fa-solid fa-compress-arrows-alt" style="margin-right:6px"></i>Сбросить положение
                    </button>
                </div>
            </div>
        </div>`;
    $('#extensions_settings2').append(html);

    const settings = getSettings();
    $('#cep-toggle').prop('checked', settings.enabled);

    $('#cep-toggle').on('change', function () {
        settings.enabled = $(this).prop('checked');
        saveSettingsDebounced();
        toggleVisibility(settings.enabled);
    });

    $('#cep-reset-pos').on('click', function () {
        const $editor = $('#cep-editor');
        const top = 100;
        const left = window.innerWidth - 440;
        $editor.css({ top: top + 'px', left: left + 'px' });
        settings.position = { top, left };
        saveSettingsDebounced();
        if (!$editor.is(':visible') && settings.enabled) {
            $editor.show();
            $('#cep-fab').hide();
        }
    });
}

/* ---- Floating Editor ---- */
function createFloatingEditor() {
    const settings = getSettings();

    if (settings.position.left === null) {
        settings.position.left = window.innerWidth - 440;
    }

    const collapseIcon = settings.isCollapsed ? 'fa-expand' : 'fa-minus';
    const collapseTitle = settings.isCollapsed ? 'Развернуть' : 'Свернуть';

    const html = `
        <div id="cep-editor">
            <div id="cep-header">
                <span class="cep-title">CSS Editor Pro</span>
                <div class="cep-header-controls">
                    <button id="cep-btn-refresh" class="cep-header-btn" title="Обновить из темы">
                        <i class="fa-solid fa-arrows-rotate"></i>
                    </button>
                    <button id="cep-btn-collapse" class="cep-header-btn" title="${collapseTitle}">
                        <i class="fa-solid ${collapseIcon}"></i>
                    </button>
                    <button id="cep-btn-close" class="cep-header-btn" title="Закрыть">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
            <div id="cep-search-bar">
                <i class="fa-solid fa-magnifying-glass cep-search-icon"></i>
                <div id="cep-search-wrap">
                    <input id="cep-search-input" type="text" placeholder="Поиск..." autocomplete="off" />
                    <button id="cep-search-clear" class="cep-search-clear" title="Очистить"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <span id="cep-search-count">0/0</span>
                <button id="cep-search-prev" class="cep-search-btn" title="Назад"><i class="fa-solid fa-chevron-up"></i></button>
                <button id="cep-search-next" class="cep-search-btn" title="Вперёд"><i class="fa-solid fa-chevron-down"></i></button>
            </div>
            <div id="cep-content">
                <div id="cep-editor-wrap">
                    <div id="cep-line-numbers"></div>
                    <textarea id="cep-textarea" placeholder="CSS code here..." spellcheck="false"></textarea>
                </div>
                <div id="cep-statusbar">
                    <span id="cep-status-pos">Ln 1, Col 1</span>
                    <span id="cep-status-info">0 строк · 0 KB</span>
                </div>
            </div>
            <div id="cep-resize-handle"></div>
        </div>
        <button id="cep-fab" title="Открыть CSS Editor">
            <i class="fa-solid fa-code"></i>
        </button>`;

    $('body').append(html);

    const $editor = $('#cep-editor');

    // Apply saved position & size
    $editor.css({
        top:    settings.position.top  + 'px',
        left:   settings.position.left + 'px',
        width:  settings.size.width    + 'px',
        height: settings.size.height   + 'px',
    });

    // Apply collapsed state
    if (settings.isCollapsed) {
        $editor.addClass('cep-collapsed');
    }

    // Visibility
    if (!settings.enabled) {
        $editor.hide();
        $('#cep-fab').hide();
    } else {
        $('#cep-fab').hide();
    }

    // Sync textarea with ST's #customCSS
    syncCSS();

    // Init interactions
    initDrag();
    initResize();
    initButtons();
    initLineNumbers();
    initStatusBar();
    initKeyboard();
    initSearch();
    initColorSwatches();
}

/* ---- Sync with SillyTavern's #customCSS ---- */
function syncCSS() {
    const $ours = $('#cep-textarea');
    let syncing = false;

    function doSync() {
        const $original = $('#customCSS');
        if (!$original.length) return false;

        // Load current value
        $ours.val($original.val());
        updateLinesAndStatus();

        // Our textarea → ST's textarea
        $ours.off('input.cep-sync').on('input.cep-sync', function () {
            if (syncing) return;
            syncing = true;
            $('#customCSS').val($(this).val()).trigger('input');
            updateLinesAndStatus();
            setTimeout(() => (syncing = false), 50);
        });

        // ST's textarea → ours
        $original.off('input.cep-sync change.cep-sync').on('input.cep-sync change.cep-sync', function () {
            if (syncing) return;
            syncing = true;
            $ours.val($(this).val());
            updateLinesAndStatus();
            setTimeout(() => (syncing = false), 50);
        });

        // Watch for ST replacing the value (theme changes)
        if ($original[0]) {
            const obs = new MutationObserver(() => {
                if (!syncing && $ours.val() !== $original.val()) {
                    $ours.val($original.val());
                    updateLinesAndStatus();
                }
            });
            obs.observe($original[0], { attributes: true, childList: true, characterData: true });
        }

        return true;
    }

    // Try immediately, then retry after short delays (ST might not have loaded #customCSS yet)
    if (!doSync()) {
        const retries = [200, 500, 1000, 2000];
        retries.forEach(delay => {
            setTimeout(() => {
                if (!$('#customCSS').data('cep-synced')) {
                    if (doSync()) {
                        $('#customCSS').data('cep-synced', true);
                        console.log(`[${MODULE_NAME}] Synced with #customCSS after ${delay}ms`);
                    }
                }
            }, delay);
        });
    }
}

function updateLinesAndStatus() {
    // Trigger line numbers + status bar update
    $('#cep-textarea').trigger('cep-update');
}

/* ---- Drag ---- */
function initDrag() {
    const $editor = $('#cep-editor');
    let dragging = false, startX, startY, initL, initT;

    function onStart(e) {
        if ($(e.target).closest('button').length) return;
        const ev = e.type === 'touchstart' ? e.originalEvent.touches[0] : e;
        dragging = true;
        startX = ev.clientX;
        startY = ev.clientY;
        initL = $editor.offset().left;
        initT = $editor.offset().top;
        $editor.addClass('cep-dragging');
        e.preventDefault();
    }

    function onMove(e) {
        if (!dragging) return;
        const ev = e.type === 'touchmove' ? e.originalEvent.touches[0] : e;
        $editor.css({
            left: (initL + ev.clientX - startX) + 'px',
            top: (initT + ev.clientY - startY) + 'px',
        });
    }

    function onEnd() {
        if (!dragging) return;
        dragging = false;
        $editor.removeClass('cep-dragging');
        $(document).off('.cep-drag');
        const settings = getSettings();
        settings.position = { top: parseInt($editor.css('top')), left: parseInt($editor.css('left')) };
        saveSettingsDebounced();
    }

    $('#cep-header').on('mousedown touchstart', function (e) {
        onStart(e);
        $(document).on('mousemove.cep-drag touchmove.cep-drag', onMove);
        $(document).on('mouseup.cep-drag touchend.cep-drag', onEnd);
    });
}



/* ---- Resize ---- */
function initResize() {
    const $editor = $('#cep-editor');
    let resizing = false, startX, startY, startW, startH, raf;

    function onStart(e) {
        const ev = e.type === 'touchstart' ? e.originalEvent.touches[0] : e;
        resizing = true;
        startX = ev.clientX;
        startY = ev.clientY;
        startW = $editor.width();
        startH = $editor.height();
        $editor.addClass('cep-resizing');
        e.preventDefault();
        e.stopPropagation();
    }

    function onMove(e) {
        if (!resizing) return;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
            const ev = e.type === 'touchmove' ? e.originalEvent.touches[0] : e;
            $editor.css({
                width: Math.max(300, startW + ev.clientX - startX) + 'px',
                height: Math.max(250, startH + ev.clientY - startY) + 'px',
            });
        });
    }

    function onEnd() {
        if (!resizing) return;
        resizing = false;
        $editor.removeClass('cep-resizing');
        $(document).off('.cep-resize');
        if (raf) cancelAnimationFrame(raf);
        const settings = getSettings();
        settings.size = { width: $editor.width(), height: $editor.height() };
        saveSettingsDebounced();
    }

    $('#cep-resize-handle').on('mousedown touchstart', function (e) {
        onStart(e);
        $(document).on('mousemove.cep-resize touchmove.cep-resize', onMove);
        $(document).on('mouseup.cep-resize touchend.cep-resize', onEnd);
    });
}



/* ---- Buttons ---- */
function initButtons() {
    const $editor = $('#cep-editor');
    const $fab = $('#cep-fab');
    const settings = getSettings();

    // Refresh
    $('#cep-btn-refresh').on('click', function () {
        const $original = $('#customCSS');
        if ($original.length) {
            $('#cep-textarea').val($original.val());
            toastr.success('CSS обновлён из темы');
        }
    });

    // Collapse / Expand
    $('#cep-btn-collapse').on('click', function () {
        const isCollapsed = $editor.hasClass('cep-collapsed');
        if (isCollapsed) {
            $editor.removeClass('cep-collapsed');
            const h = settings.size.height || 500;
            const w = settings.size.width || 420;
            $editor.css({ width: w + 'px', height: h + 'px' });
            $(this).find('i').removeClass('fa-expand').addClass('fa-minus');
            $(this).attr('title', 'Свернуть');
            settings.isCollapsed = false;
        } else {
            $editor.addClass('cep-collapsed');
            $(this).find('i').removeClass('fa-minus').addClass('fa-expand');
            $(this).attr('title', 'Развернуть');
            settings.isCollapsed = true;
        }
        saveSettingsDebounced();
    });

    // Close → FAB
    $('#cep-btn-close').on('click', function () {
        $editor.hide();
        $fab.css('display', 'flex').hide().fadeIn(200);
    });

    // FAB → open
    $fab.on('click', function () {
        $fab.fadeOut(200);
        $editor.show();
    });
}

/* ---- Toggle visibility ---- */
function toggleVisibility(enabled) {
    const $editor = $('#cep-editor');
    const $fab = $('#cep-fab');
    if (enabled) {
        $editor.show();
        $fab.hide();
    } else {
        $editor.hide();
        $fab.hide();
    }
}


/* ---- Line Numbers ---- */
function initLineNumbers() {
    const $ta = $('#cep-textarea');
    const $ln = $('#cep-line-numbers');

    function updateLines() {
        const text = $ta.val() || '';
        const count = text.split('\n').length;
        const lines = [];
        for (let i = 1; i <= count; i++) lines.push(i);
        $ln.html(lines.join('<br>'));
    }

    function syncScroll() {
        $ln[0].scrollTop = $ta[0].scrollTop;
    }

    $ta.on('input cep-update', updateLines);
    $ta.on('scroll', syncScroll);
    updateLines();
}

/* ---- Status Bar ---- */
function initStatusBar() {
    const $ta = $('#cep-textarea');

    function update() {
        const text = $ta.val() || '';
        const lines = text.split('\n').length;
        const kb = (new Blob([text]).size / 1024).toFixed(1);
        $('#cep-status-info').text(`${lines} строк · ${kb} KB`);
    }

    function updateCursor() {
        const ta = $ta[0];
        const pos = ta.selectionStart;
        const text = ta.value.substring(0, pos);
        const line = text.split('\n').length;
        const col = pos - text.lastIndexOf('\n');
        $('#cep-status-pos').text(`Ln ${line}, Col ${col}`);
    }

    $ta.on('input cep-update', update);
    $ta.on('input click keyup', updateCursor);
    update();
    updateCursor();
}

/* ---- Tab & Keyboard Shortcuts ---- */
function initKeyboard() {
    const $ta = $('#cep-textarea');

    $ta.on('keydown', function (e) {
        const ta = this;

        // Tab → insert 2 spaces
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = ta.selectionStart;
            const end = ta.selectionEnd;

            if (e.shiftKey) {
                // Shift+Tab: remove indent from selected lines
                const text = ta.value;
                const before = text.substring(0, start);
                const lineStart = before.lastIndexOf('\n') + 1;
                const selected = text.substring(lineStart, end);
                const dedented = selected.replace(/^  /gm, '');
                const diff = selected.length - dedented.length;
                ta.value = text.substring(0, lineStart) + dedented + text.substring(end);
                ta.selectionStart = Math.max(lineStart, start - (before.substring(lineStart, start).startsWith('  ') ? 2 : 0));
                ta.selectionEnd = end - diff;
            } else {
                // Tab: insert 2 spaces
                ta.value = ta.value.substring(0, start) + '  ' + ta.value.substring(end);
                ta.selectionStart = ta.selectionEnd = start + 2;
            }
            $(ta).trigger('input');
        }

        // Ctrl+S → Apply CSS
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            const $original = $('#customCSS');
            if ($original.length) {
                $original.val($(ta).val()).trigger('input');
                toastr.success('CSS сохранён');
            }
        }

        // Ctrl+F → open search
        if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
            e.preventDefault();
            toggleSearch(true);
        }

        // Ctrl+D → duplicate line
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            const text = ta.value;
            const pos = ta.selectionStart;
            const before = text.substring(0, pos);
            const lineStart = before.lastIndexOf('\n') + 1;
            const lineEnd = text.indexOf('\n', pos);
            const end = lineEnd === -1 ? text.length : lineEnd;
            const line = text.substring(lineStart, end);
            ta.value = text.substring(0, end) + '\n' + line + text.substring(end);
            ta.selectionStart = ta.selectionEnd = pos + line.length + 1;
            $(ta).trigger('input');
        }

        // Auto-close brackets
        const pairs = { '{': '}', '(': ')', '[': ']', "'": "'", '"': '"' };
        if (pairs[e.key] && !e.ctrlKey && !e.metaKey) {
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            if (start !== end) {
                // Wrap selection
                e.preventDefault();
                const selected = ta.value.substring(start, end);
                ta.value = ta.value.substring(0, start) + e.key + selected + pairs[e.key] + ta.value.substring(end);
                ta.selectionStart = start + 1;
                ta.selectionEnd = end + 1;
                $(ta).trigger('input');
            } else {
                e.preventDefault();
                ta.value = ta.value.substring(0, start) + e.key + pairs[e.key] + ta.value.substring(end);
                ta.selectionStart = ta.selectionEnd = start + 1;
                $(ta).trigger('input');
            }
        }
    });
}

/* ---- Search ---- */
const cepSearch = { query: '', matches: [], current: -1 };

function toggleSearch(show) {
    if (show) {
        $('#cep-search-input').trigger('focus').select();
    } else {
        clearSearch();
        $('#cep-textarea').trigger('focus');
    }
}

function clearSearch() {
    cepSearch.query = '';
    cepSearch.matches = [];
    cepSearch.current = -1;
    $('#cep-search-count').text('0/0');
    $('#cep-search-input').val('');
}

function buildMatches() {
    const q = ($('#cep-search-input').val() || '').trim().toLowerCase();
    const text = ($('#cep-textarea').val() || '').toLowerCase();
    cepSearch.query = q;
    cepSearch.matches = [];
    cepSearch.current = -1;
    if (!q) { $('#cep-search-count').text('0/0'); return; }
    let idx = 0;
    while (true) {
        idx = text.indexOf(q, idx);
        if (idx === -1) break;
        cepSearch.matches.push(idx);
        idx += Math.max(1, q.length);
    }
    $('#cep-search-count').text(cepSearch.matches.length ? `0/${cepSearch.matches.length}` : '0/0');
}

function jumpTo(dir) {
    const total = cepSearch.matches.length;
    if (!total) return;
    let i = cepSearch.current;
    i = i < 0 ? 0 : (i + dir + total) % total;
    cepSearch.current = i;
    const ta = document.getElementById('cep-textarea');
    const start = cepSearch.matches[i];
    ta.focus();
    ta.setSelectionRange(start, start + cepSearch.query.length);
    scrollToCaret(ta, start);
    $('#cep-search-count').text(`${i + 1}/${total}`);
    // sync line numbers scroll
    $('#cep-line-numbers')[0].scrollTop = ta.scrollTop;
}

function scrollToCaret(ta, pos) {
    // Create a mirror div to measure exact scroll position
    const mirror = document.createElement('div');
    const cs = getComputedStyle(ta);
    ['fontFamily','fontSize','lineHeight','padding','paddingTop','paddingBottom',
     'paddingLeft','paddingRight','border','boxSizing','whiteSpace','wordWrap',
     'wordBreak','overflowWrap','width','letterSpacing','tabSize'].forEach(p => {
        mirror.style[p] = cs[p];
    });
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';
    mirror.style.overflow = 'hidden';
    mirror.style.height = 'auto';

    // Text before the match
    mirror.textContent = ta.value.substring(0, pos);
    const marker = document.createElement('span');
    marker.textContent = '.';
    mirror.appendChild(marker);
    document.body.appendChild(mirror);

    const markerY = marker.offsetTop;
    document.body.removeChild(mirror);

    // Center the match in the visible area
    const visibleH = ta.clientHeight;
    ta.scrollTop = Math.max(0, markerY - visibleH / 2);
}

function initSearch() {
    $('#cep-search-input').on('input', buildMatches);
    $('#cep-search-next').on('click', () => jumpTo(1));
    $('#cep-search-prev').on('click', () => jumpTo(-1));
    $('#cep-search-clear').on('click', () => { clearSearch(); $('#cep-textarea').trigger('focus'); });
    $('#cep-search-input').on('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); jumpTo(e.shiftKey ? -1 : 1); }
        if (e.key === 'Escape') { e.preventDefault(); toggleSearch(false); }
    });

    // Global Ctrl+F on the editor
    $('#cep-editor').on('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
            e.preventDefault();
            e.stopPropagation();
            toggleSearch(true);
        }
    });
}


/* ---- Color Swatches ---- */
function initColorSwatches() {
    const $ta = $('#cep-textarea');
    const $content = $('#cep-content');

    // Create overlay container for swatches
    $('<div id="cep-color-overlay"></div>').insertAfter('#cep-editor-wrap');

    // Color regex patterns
    const colorPatterns = [
        /#(?:[0-9a-fA-F]{3,4}){1,2}\b/g,
        /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/g,
        /hsla?\(\s*\d+\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(?:,\s*[\d.]+\s*)?\)/g,
    ];

    // Named CSS colors (common ones)
    const namedColors = new Set([
        'red','blue','green','yellow','orange','purple','pink','white','black',
        'gray','grey','cyan','magenta','lime','navy','teal','maroon','olive',
        'aqua','silver','fuchsia','coral','salmon','tomato','gold','khaki',
        'violet','indigo','crimson','turquoise','orchid','plum','sienna',
        'chocolate','peru','tan','wheat','beige','ivory','linen','snow',
        'azure','lavender','thistle','honeydew','mintcream','aliceblue',
        'ghostwhite','seashell','cornsilk','lemonchiffon','floralwhite',
        'transparent','inherit','initial','unset','currentColor',
    ]);

    let debounceTimer = null;

    function findColors(text) {
        const results = [];

        // Regex-based colors
        for (const pattern of colorPatterns) {
            pattern.lastIndex = 0;
            let m;
            while ((m = pattern.exec(text)) !== null) {
                results.push({ color: m[0], index: m.index, length: m[0].length });
            }
        }

        // Named colors — only match as property values (after : )
        const lines = text.split('\n');
        let offset = 0;
        for (const line of lines) {
            const colonIdx = line.indexOf(':');
            if (colonIdx !== -1) {
                const valuePart = line.substring(colonIdx + 1);
                const words = valuePart.match(/\b[a-zA-Z]+\b/g);
                if (words) {
                    for (const word of words) {
                        if (namedColors.has(word.toLowerCase()) &&
                            !['inherit','initial','unset','currentColor','transparent'].includes(word.toLowerCase())) {
                            const wordIdx = valuePart.indexOf(word);
                            results.push({
                                color: word,
                                index: offset + colonIdx + 1 + wordIdx,
                                length: word.length
                            });
                        }
                    }
                }
            }
            offset += line.length + 1;
        }

        return results;
    }

    function updateSwatches() {
        const $overlay = $('#cep-color-overlay');
        $overlay.empty();

        const text = $ta.val() || '';
        const colors = findColors(text);
        if (!colors.length) return;

        // Get unique colors by line (max 1 per line to avoid clutter)
        const lines = text.split('\n');
        const seenLines = new Set();
        const filtered = [];

        for (const c of colors) {
            const textBefore = text.substring(0, c.index);
            const lineNum = textBefore.split('\n').length;
            if (!seenLines.has(lineNum)) {
                seenLines.add(lineNum);
                filtered.push({ ...c, line: lineNum });
            }
        }

        const ta = $ta[0];
        const cs = getComputedStyle(ta);
        const lineH = parseFloat(cs.lineHeight) || 21;
        const padTop = parseFloat(cs.paddingTop) || 12;
        const scrollTop = ta.scrollTop;

        for (const c of filtered) {
            const y = padTop + (c.line - 1) * lineH - scrollTop;
            if (y < -lineH || y > ta.clientHeight + lineH) continue;

            const $swatch = $(`<span class="cep-color-swatch" title="${c.color}"></span>`);
            $swatch.css({
                top: y + (lineH - 12) / 2 + 'px',
                backgroundColor: c.color,
            });

            // Click to open color picker
            $swatch.on('click', function (e) {
                e.stopPropagation();
                const picker = document.createElement('input');
                picker.type = 'color';
                picker.value = colorToHex(c.color);
                picker.style.position = 'absolute';
                picker.style.opacity = '0';
                picker.style.pointerEvents = 'none';
                document.body.appendChild(picker);

                picker.addEventListener('input', function () {
                    const newColor = picker.value;
                    const text = $ta.val();
                    $ta.val(text.substring(0, c.index) + newColor + text.substring(c.index + c.length));
                    $ta.trigger('input');
                });

                picker.addEventListener('change', function () {
                    document.body.removeChild(picker);
                });

                picker.click();
            });

            $overlay.append($swatch);
        }
    }

    function colorToHex(color) {
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.fillStyle = color;
        return ctx.fillStyle;
    }

    $ta.on('input cep-update', function () {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updateSwatches, 400);
    });

    $ta.on('scroll', updateSwatches);

    // Initial
    setTimeout(updateSwatches, 500);
}

/* ---- Init ---- */
jQuery(async () => {
    eventSource.on(event_types.APP_READY, () => {
        try {
            createSettingsUI();
            createFloatingEditor();
            console.log(`[${MODULE_NAME}] ✅ Loaded`);
        } catch (err) {
            console.error(`[${MODULE_NAME}] ❌ Failed:`, err);
        }
    });
});
