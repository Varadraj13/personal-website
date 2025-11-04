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
}

boot();
