async function loadJSON(path) {
  const r = await fetch(path);
  return r.json();
}

function projectCard(p) {
  const tags = (p.tags || []).map(tag => `<span class="tag">${tag}</span>`).join("");
  return `
    <article class="project-card">
      <div>
        <h3>${p.title}</h3>
        <p class="description">${p.description}</p>
      </div>
      <div class="meta">${tags}</div>
    </article>`;
}

function writingItem(w) {
  return `
    <article class="card">
      <h3>${w.title}</h3>
      <small>related: ${(w.related || []).join(", ")} · <time>${w.date}</time></small>
      <p>${w.body}</p>
    </article>`;
}

function refItem(r) {
  return `
    <article class="card">
      <h3><a href="${r.url}" target="_blank" rel="noopener">${r.title}</a></h3>
      <p>${r.reason}</p>
      <small>source: ${r.source} · related: ${(r.related || []).join(", ")}</small>
    </article>`;
}

async function boot() {
  const projects = await loadJSON('data/projects.json');

  // Home: projects grid
  const grid = document.getElementById('projects-grid');
  if (grid) {
    grid.innerHTML = projects.map(projectCard).join("");
  }

  // Work grid
  const workGrid = document.getElementById('work-grid');
  if (workGrid) {
    workGrid.innerHTML = projects.map(projectCard).join("");
  }

  // Writing list
  const wlist = document.getElementById('writing-list');
  if (wlist) {
    const notes = await loadJSON('data/writing.json');
    wlist.innerHTML = notes.map(writingItem).join("");
  }

  // References list
  const rlist = document.getElementById('ref-list');
  if (rlist) {
    const refs = await loadJSON('data/references.json');
    rlist.innerHTML = refs.map(refItem).join("");
  }

  // Initialize ideas panel load & interactions
  await initIdeas();
}

function ideaCard(it) {
  // note contains HTML (may include inline images and links)
  const note = it.note ? `<div class="idea-note">${it.note}</div>` : "";
  const meta = it.created ? `<div class="idea-meta">${new Date(it.created).toLocaleString()}</div>` : "";
  return `
    <div class="idea-item" data-id="${it.id}">
      <div class="idea-body">
        <div class="idea-title">${escapeHtml(it.title)}</div>
        ${note}
        ${meta}
      </div>
      <div class="idea-actions">
        <button class="edit-idea" data-id="${it.id}" title="Edit">Edit</button>
        <button class="delete-idea" data-id="${it.id}" title="Delete">Delete</button>
      </div>
    </div>`;
}

// simple escape helpers
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>\"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]||c)); }
function escapeAttr(s){ if(!s) return ''; return String(s).replace(/"/g,'&quot;'); }

async function initIdeas() {
  const STORAGE_KEY = 'ideas_storage_v1';
  const listEl = document.getElementById('ideas-list');

  const form = document.getElementById('idea-form');
  const titleIn = document.getElementById('idea-title');
  const noteIn = document.getElementById('idea-note');

  if (!listEl || !form) return;

  // inline contenteditable note will contain pasted images/links as HTML
  let editingId = null;
  const submitBtn = document.getElementById('idea-submit');

  function getStoredIdeas(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return [];
      return JSON.parse(raw);
    }catch(e){ return []; }
  }

  const DELETED_KEY = 'ideas_deleted_v1';
  function getDeletedIds(){
    try{
      const raw = localStorage.getItem(DELETED_KEY);
      if(!raw) return [];
      return JSON.parse(raw);
    }catch(e){ return []; }
  }

  function saveDeletedIds(arr){
    try{ localStorage.setItem(DELETED_KEY, JSON.stringify(arr)); }catch(e){ console.warn('Could not save deleted ids', e); }
  }

  function saveStoredIdeas(arr){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }catch(e){ console.warn('Could not save ideas', e); }
  }

  async function loadSeedIdeas(){
    try{
      const seed = await loadJSON('data/ideas.json');
      return (seed || []).map((s, i) => ({ id: 'seed-' + i + '-' + (s.slug||s.title||i), title: s.title||'', note: escapeHtml(s.note||s.description||''), created: new Date().toISOString() }));
    }catch(e){
      return [];
    }
  }

  async function loadAllIdeas(){
    const seed = await loadSeedIdeas();
    const stored = getStoredIdeas();
    // filter out any seed items the user deleted
    const deleted = getDeletedIds();
    const normalizedSeed = seed.map((s, i)=> ({ ...s, id: s.id || ('seed-'+i) }));
    const visibleSeed = normalizedSeed.filter(s => !deleted.includes(s.id));
    // merge seed and stored so stored (edits) override seed items with same id
    const map = {};
    visibleSeed.forEach(s => { map[s.id] = s; });
    (stored || []).forEach(st => { map[st.id] = st; });
    return Object.values(map);
  }

  function renderIdeas(arr){
    if(!arr || arr.length === 0) {
      listEl.innerHTML = '<div class="idea-empty">No ideas yet — post one above.</div>';
      return;
    }
    // show newest first
    const sorted = arr.slice().sort((a,b)=> new Date(b.created) - new Date(a.created));
    listEl.innerHTML = sorted.map(ideaCard).join('');
  }

  async function refreshList(){
    const all = await loadAllIdeas();
    renderIdeas(all);
  }

  function clearForm(){
    form.reset();
    // clear the contenteditable note
    if (noteIn) noteIn.innerHTML = '';
    // exit edit mode if active
    editingId = null;
    if (submitBtn) submitBtn.textContent = 'Post idea';
  }

  // paste handler for contenteditable note: insert pasted images inline
  if (noteIn) {
    noteIn.addEventListener('paste', (e) => {
      try {
        const clipboard = e.clipboardData || window.clipboardData;
        if (!clipboard) return;
        const items = clipboard.items || [];
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (it && it.kind === 'file' && it.type && it.type.indexOf('image/') === 0) {
            const file = it.getAsFile();
            if (file) {
              const reader = new FileReader();
              reader.onload = function (evt) {
                const dataUrl = evt.target.result;
                // insert image at caret
                const sel = window.getSelection();
                if (!sel || !sel.rangeCount) {
                  noteIn.innerHTML += `<img src="${dataUrl}" alt="pasted-image" />`;
                } else {
                  const range = sel.getRangeAt(0);
                  range.deleteContents();
                  const img = document.createElement('img');
                  img.src = dataUrl;
                  img.alt = 'pasted-image';
                  range.insertNode(img);
                  // move caret after image
                  range.setStartAfter(img);
                  range.setEndAfter(img);
                  sel.removeAllRanges();
                  sel.addRange(range);
                }
              };
              reader.readAsDataURL(file);
              e.preventDefault();
              break;
            }
          }
        }
      } catch (err) {
        // ignore
      }
    });

    // allow dropping images directly into the editor
    noteIn.addEventListener('dragover', (e) => { e.preventDefault(); });
    noteIn.addEventListener('drop', (e) => {
      e.preventDefault();
      const files = (e.dataTransfer && e.dataTransfer.files) || [];
      if (!files || files.length === 0) return;
      const f = files[0];
      if (!f.type || f.type.indexOf('image/') !== 0) return;
      const reader = new FileReader();
      reader.onload = function (evt) {
        const dataUrl = evt.target.result;
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) {
          noteIn.innerHTML += `<img src="${dataUrl}" alt="dropped-image" />`;
        } else {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const img = document.createElement('img');
          img.src = dataUrl;
          img.alt = 'dropped-image';
          range.insertNode(img);
          range.setStartAfter(img);
          range.setEndAfter(img);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      };
      reader.readAsDataURL(f);
    });
  }

  

  // submit new idea
  // submit new idea (note is saved as HTML so inline images/links persist)
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const title = titleIn.value && titleIn.value.trim();
    let noteHtml = noteIn && noteIn.innerHTML ? noteIn.innerHTML.trim() : '';
    if(!title) { titleIn.focus(); return; }
    // convert plain URLs in text nodes to clickable links
    function linkifyHtml(html){
      const urlRegex = /((https?:\/\/|www\.)[^\s<]+)/ig;
      const container = document.createElement('div');
      container.innerHTML = html;
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
      const textNodes = [];
      let node;
      while(node = walker.nextNode()) textNodes.push(node);

      textNodes.forEach(tn => {
        const val = tn.nodeValue;
        if(!val) return;
        if(!urlRegex.test(val)) return;
        urlRegex.lastIndex = 0;
        const frag = document.createDocumentFragment();
        let lastIndex = 0;
        let m;
        while(m = urlRegex.exec(val)){
          const index = m.index;
          const url = m[0];
          if(index > lastIndex) frag.appendChild(document.createTextNode(val.slice(lastIndex, index)));
          const a = document.createElement('a');
          a.textContent = url;
          a.href = (/^https?:\/\//i.test(url)) ? url : ('http://' + url);
          a.target = '_blank';
          a.rel = 'noopener';
          frag.appendChild(a);
          lastIndex = index + url.length;
        }
        if(lastIndex < val.length) frag.appendChild(document.createTextNode(val.slice(lastIndex)));
        tn.parentNode.replaceChild(frag, tn);
      });

      return container.innerHTML;
    }

    noteHtml = linkifyHtml(noteHtml);

    let stored = getStoredIdeas();
    if (editingId) {
      // update existing stored item or add new stored item that overrides seed
      const idx = stored.findIndex(i => i.id === editingId);
      const updated = { id: editingId, title: title, note: noteHtml, created: new Date().toISOString() };
      if (idx !== -1) {
        stored[idx] = updated;
      } else {
        stored.push(updated);
      }
      saveStoredIdeas(stored);
      editingId = null;
      if (submitBtn) submitBtn.textContent = 'Post idea';
    } else {
      const newIdea = {
        id: Date.now().toString(),
        title: title,
        note: noteHtml,
        created: new Date().toISOString()
      };
      stored.push(newIdea);
      saveStoredIdeas(stored);
    }
    clearForm();
    refreshList();
  });

  // clear button
  const clearBtn = document.getElementById('idea-clear');
  clearBtn && clearBtn.addEventListener('click', (e)=>{ e.preventDefault(); clearForm(); });

  // delete idea (delegated)
  listEl.addEventListener('click', async (e)=>{
    // Edit
    const editBtn = e.target.closest('.edit-idea');
    if (editBtn) {
      const id = editBtn.getAttribute('data-id');
      if (!id) return;
      const all = await loadAllIdeas();
      const idea = all.find(i => i.id === id);
      if (!idea) return;
      // populate form
      titleIn.value = idea.title || '';
      if (noteIn) noteIn.innerHTML = idea.note || '';
      editingId = id;
      if (submitBtn) submitBtn.textContent = 'Save';
      // scroll to form
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Delete
    const del = e.target.closest('.delete-idea');
    if(del) {
      const id = del.getAttribute('data-id');
      if(!id) return;
      // remove from stored ideas if present, otherwise mark seed id as deleted
      let stored = getStoredIdeas();
      const idx = stored.findIndex(i => i.id === id);
      if (idx !== -1) {
        stored.splice(idx, 1);
        saveStoredIdeas(stored);
      } else {
        // mark seed id as deleted so it won't be shown
        const deleted = getDeletedIds();
        if (!deleted.includes(id)) {
          deleted.push(id);
          saveDeletedIds(deleted);
        }
      }
      refreshList();
    }
  });


  // smooth-scroll from header nav link to the ideas section
  const ideasNav = document.getElementById('ideas-link');
  if (ideasNav) {
    // Only intercept clicks for same-page smooth scroll when #ideas exists on the current page
    const target = document.querySelector('#ideas');
    if (target) {
      ideasNav.addEventListener('click', function (ev) {
        ev.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }

  // initial render
  refreshList();
}

boot();
