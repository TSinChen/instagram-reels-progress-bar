// Fills the copy column of a store shot from shot-copy.json, for the locale in ?copy=.
async function renderShotCopy(shot) {
  const locale = new URLSearchParams(location.search).get('copy') || 'en';
  const all = await (await fetch('./shot-copy.json')).json();
  const copy = (all[locale] || all.en)[shot];

  // Without this the browser picks fonts by guesswork and Japanese renders with Chinese
  // glyph shapes, which reads as wrong to anyone who can tell them apart
  document.documentElement.lang = locale.replace('_', '-');

  const root = document.getElementById('copy');
  root.innerHTML = '<h1></h1><p></p><ul class="points"></ul>';
  root.querySelector('h1').textContent = copy.h1;
  root.querySelector('p').textContent = copy.p;

  const list = root.querySelector('.points');
  for (const text of copy.points) {
    const item = document.createElement('li');
    item.innerHTML = '<b></b><span></span>';
    item.querySelector('span').textContent = text;
    list.appendChild(item);
  }
}
