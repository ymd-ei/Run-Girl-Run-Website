(function () {
  var chooseButton = document.getElementById('choose-folder');
  var rescanButton = document.getElementById('rescan');
  var openFileButton = document.getElementById('open-file');
  var statusEl = document.getElementById('status');
  var folderNameEl = document.getElementById('folder-name');
  var scanSummaryEl = document.getElementById('scan-summary');
  var fileListEl = document.getElementById('file-list');
  var rootHandle = null;

  var supported = typeof window.showDirectoryPicker === 'function';
  if (!supported) {
    setStatus('This browser does not support folder access. Use a Chromium-based browser.');
    chooseButton.disabled = true;
    openFileButton.disabled = true;
  }

  chooseButton.addEventListener('click', function () {
    pickFolder();
  });

  rescanButton.addEventListener('click', function () {
    if (!rootHandle) {
      setStatus('Pick a folder first.');
      return;
    }
    scanFolder(rootHandle);
  });

  openFileButton.addEventListener('click', function () {
    setStatus('Open File will be enabled when the helper app is added.');
  });

  function setStatus(text) {
    statusEl.textContent = text;
  }

  async function pickFolder() {
    try {
      var handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      rootHandle = handle;
      folderNameEl.textContent = handle.name;
      rescanButton.disabled = false;
      setStatus('Folder connected. Scanning now...');
      scanFolder(handle);
    } catch (error) {
      if (error && error.name === 'AbortError') {
        setStatus('Folder selection cancelled.');
        return;
      }
      console.error(error);
      setStatus('Could not access the selected folder.');
    }
  }

  async function scanFolder(handle) {
    var files = [];
    var pending = [{ handle: handle, path: '' }];
    var visited = 0;
    var maxItems = 12000;

    while (pending.length > 0 && visited < maxItems) {
      var current = pending.shift();
      for await (var entry of current.handle.values()) {
        var fullPath = current.path ? current.path + '/' + entry.name : entry.name;
        visited += 1;
        if (entry.kind === 'directory') {
          pending.push({ handle: entry, path: fullPath });
        } else {
          files.push(fullPath);
        }
        if (visited >= maxItems) {
          break;
        }
      }
    }

    renderFileList(files);
    scanSummaryEl.textContent = files.length + ' files found' + (visited >= maxItems ? ' (scan limit reached)' : '.');
    setStatus('Scan complete.');
  }

  function renderFileList(files) {
    fileListEl.innerHTML = '';
    if (!files.length) {
      var empty = document.createElement('li');
      empty.textContent = 'No files found in this folder.';
      fileListEl.appendChild(empty);
      return;
    }

    var visible = files.slice(0, 300);
    visible.forEach(function (file) {
      var item = document.createElement('li');
      item.textContent = file;
      fileListEl.appendChild(item);
    });

    if (files.length > visible.length) {
      var more = document.createElement('li');
      more.textContent = '+' + (files.length - visible.length) + ' more files...';
      fileListEl.appendChild(more);
    }
  }

  var cards = document.querySelectorAll('.card, .list-wrap');
  cards.forEach(function (card, index) {
    card.animate(
      [
        { opacity: 0, transform: 'translateY(10px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ],
      {
        duration: 280,
        delay: 120 + index * 90,
        fill: 'both',
        easing: 'ease-out'
      }
    );
  });
})();
