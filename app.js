import { products as seedProducts } from './products.js';
import { DEFAULT_THEME_ID, THEME_PRESETS, getThemeDefaults, themePresetOptions } from './themes/index.js';

const app = document.getElementById('app');
const categories = ['All', 'T-Shirts', 'Hoodies', 'Long Sleeve', 'Accessories'];
const REQUESTS_KEY = 'tapPayRequests';
const PRODUCTS_KEY = 'tapPayProducts';
const SETTINGS_KEY = 'tapPaySettings';
const DB_NAME = 'tapPayDB';
const LOGO_IDB_KEY = 'logoImage';
const PRODUCT_IMAGE_PREFIX = 'productImage';
const EMPTY_IMAGE_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const ADMIN_PASSWORD_KEY = 'tapPayAdminPassword';
const ADMIN_UNLOCK_KEY = 'tapPayAdminUnlocked';
const ADMIN_PIN_SESSION_KEY = 'tapPayAdminPin';
const TAPPAY_BACKEND_API_ENDPOINT = '';
const BACKEND_API_ENDPOINT = TAPPAY_BACKEND_API_ENDPOINT;
const BACKEND_CONFIGURED = BACKEND_API_ENDPOINT.startsWith('https://') || BACKEND_API_ENDPOINT.startsWith('/api/');
const APP_VERSION = 'V1';

const APP_DEFAULT_SETTINGS = {
  requestEmail: 'orders@example.com',
  notificationsEnabled: 'on',
  notificationEndpoint: '',
  paymentCash: '$yourcashtag',
  paymentVenmo: '@yourvenmo'
};

const DEFAULT_SETTINGS = {
  themePreset: DEFAULT_THEME_ID,
  ...getThemeDefaults(DEFAULT_THEME_ID),
  ...APP_DEFAULT_SETTINGS
};

const THEME_STYLE_MAP = {
  pageBg: '--page-bg',
  panelBg: '--panel',
  cardBg: '--card',
  headerBg: '--header-bg',
  footerBg: '--footer-bg',
  textColor: '--text',
  mutedColor: '--muted',
  accentColor: '--lime',
  buttonTextColor: '--button-text',
  productImageBg: '--product-image-bg'
};

const state = {
  category: 'All',
  logoImage: '',
  logoHydrating: false,
  logoHydrated: false,
  backendHydrated: false,
  backendHydrating: false,
  remoteSettings: null,
  remoteProducts: null,
  remoteRequests: null,
  adminSyncAttempted: false
};

function openDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB unavailable'));
  });
}

async function idbGet(key){
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly');
    const req = tx.objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result?.value || '');
    req.onerror = () => reject(req.error || new Error('IndexedDB read failed'));
  });
}

async function idbSet(key, value){
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    const req = tx.objectStore('kv').put({ key, value });
    req.onsuccess = () => resolve(value);
    req.onerror = () => reject(req.error || new Error('IndexedDB write failed'));
  });
}

async function idbRemove(key){
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    const req = tx.objectStore('kv').delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('IndexedDB delete failed'));
  });
}

function productImageKey(productId, index){
  return `${PRODUCT_IMAGE_PREFIX}:${productId}:${index}`;
}

function productImageRef(productId, index){
  return `idb://${productImageKey(productId, index)}`;
}

function isProductImageRef(src){
  return String(src || '').startsWith(`idb://${PRODUCT_IMAGE_PREFIX}:`);
}

function refToKey(ref){
  return String(ref || '').replace(/^idb:\/\//, '');
}

async function resolveImageSrc(src){
  if (!isProductImageRef(src)) return src || EMPTY_IMAGE_SRC;
  return await idbGet(refToKey(src)) || EMPTY_IMAGE_SRC;
}

function imageSrcAttr(src){
  return isProductImageRef(src) ? EMPTY_IMAGE_SRC : (src || EMPTY_IMAGE_SRC);
}

function imageRefAttr(src){
  return isProductImageRef(src) ? ` data-image-ref="${escapeHtml(src)}"` : '';
}

async function hydrateProductImages(root = app){
  const imgs = [...root.querySelectorAll('img[data-image-ref]')];
  await Promise.all(imgs.map(async img => {
    const ref = img.getAttribute('data-image-ref');
    img.src = await resolveImageSrc(ref);
  }));
}

async function setImageElementSource(img, src){
  if (!img) return;
  img.src = imageSrcAttr(src);
  if (isProductImageRef(src)) img.src = await resolveImageSrc(src);
}

function money(n){
  return `$${Number(n).toFixed(2)}`;
}

function paymentAmount(n){
  return Number(n || 0).toFixed(2);
}

function cleanPaymentHandle(handle, prefix){
  return String(handle || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?cash\.app\//i, '')
    .replace(/^https?:\/\/(www\.)?venmo\.com\//i, '')
    .replace(/^\/+/,'')
    .replace(prefix, '')
    .split(/[/?#]/)[0];
}

function cashAppAmountPath(n){
  const amount = paymentAmount(n);
  return amount.endsWith('.00') ? amount.slice(0, -3) : amount;
}

function cashAppHref(handle, amount, note = ''){
  const cashtag = cleanPaymentHandle(handle, '$');
  const params = new URLSearchParams();
  if (note) params.set('note', note);
  const query = params.toString();
  return `https://cash.app/$${encodeURIComponent(cashtag)}/${encodeURIComponent(cashAppAmountPath(amount))}${query ? `?${query}` : ''}`;
}

function venmoHref(handle, amount, note = ''){
  const username = cleanPaymentHandle(handle, '@');
  const params = new URLSearchParams({
    txn: 'pay',
    recipients: username,
    amount: paymentAmount(amount),
    audience: 'private'
  });
  if (note) params.set('note', note);
  return `https://venmo.com/?${params.toString()}`;
}

function escapeHtml(s){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function setBusy(v){
  app.setAttribute('aria-busy', v ? 'true' : 'false');
}

function loadSettings(){
  const remoteSettings = state.remoteSettings || {};
  try {
    const localSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null') || {};
    const themePreset = remoteSettings.themePreset || localSettings.themePreset || DEFAULT_THEME_ID;
    return {
      ...DEFAULT_SETTINGS,
      ...getThemeDefaults(themePreset),
      ...localSettings,
      ...remoteSettings,
      themePreset: THEME_PRESETS[themePreset] ? themePreset : DEFAULT_THEME_ID
    };
  } catch {
    const themePreset = remoteSettings.themePreset || DEFAULT_THEME_ID;
    return {
      ...DEFAULT_SETTINGS,
      ...getThemeDefaults(themePreset),
      ...remoteSettings,
      themePreset: THEME_PRESETS[themePreset] ? themePreset : DEFAULT_THEME_ID
    };
  }
}

function saveSettings(settings){
  const compact = { ...DEFAULT_SETTINGS, ...settings, logoImage: '' };
  try {
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(compact));
    return { ok: true };
  } catch (err) {
    try {
      // Clear any legacy oversized settings payload and retry with the compact version.
      localStorage.removeItem(SETTINGS_KEY);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(compact));
      return { ok: true };
    } catch (retryErr) {
      return { ok: false, error: retryErr?.message || err?.message || String(retryErr || err) };
    }
  }
}

function adminPin(){
  return sessionStorage.getItem(ADMIN_PIN_SESSION_KEY) || '';
}

async function apiRequest(action, payload = {}, { admin = false } = {}){
  if (!BACKEND_CONFIGURED) throw new Error('TapPay backend is not configured yet.');
  const headers = { 'Content-Type': 'application/json' };
  if (admin) headers['x-admin-pin'] = adminPin();
  const res = await fetch(BACKEND_API_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...payload })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Backend request failed (${res.status})`);
  return data;
}

async function verifyAdminPin(pin){
  if (!BACKEND_CONFIGURED) return false;
  const res = await fetch(`${BACKEND_API_ENDPOINT}?admin=1`, { headers: { 'x-admin-pin': pin } });
  if (!res.ok) return false;
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.requests);
}

async function syncBackend({ admin = false, force = false } = {}){
  if (!BACKEND_CONFIGURED) {
    if (admin) {
      state.adminSyncAttempted = true;
      state.remoteRequests = loadRequests();
    }
    state.backendHydrated = true;
    return false;
  }
  if (state.backendHydrating || (state.backendHydrated && !force && !admin)) return false;
  state.backendHydrating = true;
  try {
    const headers = {};
    if (admin) headers['x-admin-pin'] = adminPin();
    const res = await fetch(`${BACKEND_API_ENDPOINT}${admin ? '?admin=1' : ''}`, { headers });
    if (!res.ok) throw new Error(`Backend sync failed (${res.status})`);
    const data = await res.json();
    if (data.settings) {
      state.remoteSettings = data.settings;
      if (data.settings.logoImage) state.logoImage = data.settings.logoImage;
    }
    if (Array.isArray(data.products)) state.remoteProducts = data.products;
    if (admin) {
      state.adminSyncAttempted = true;
      state.remoteRequests = Array.isArray(data.requests) ? data.requests : loadRequests();
    }
    state.backendHydrated = true;
    return true;
  } catch (err) {
    console.warn('Backend sync skipped:', err?.message || err);
    if (admin) {
      state.adminSyncAttempted = true;
      state.remoteRequests = loadRequests();
    }
    state.backendHydrated = true;
    return false;
  } finally {
    state.backendHydrating = false;
  }
}

async function hydrateLogo(){
  if (state.logoHydrating || state.logoHydrated) return;
  state.logoHydrating = true;
  try {
    state.logoImage = await idbGet(LOGO_IDB_KEY);
  } catch {
    state.logoImage = '';
  } finally {
    state.logoHydrating = false;
    state.logoHydrated = true;
  }
}

function applyTheme(settings = loadSettings()){
  const root = document.documentElement;
  document.body.dataset.theme = settings.themePreset || DEFAULT_THEME_ID;
  Object.entries(THEME_STYLE_MAP).forEach(([key, cssVar]) => {
    root.style.setProperty(cssVar, settings[key]);
  });
  root.style.setProperty('--corner', settings.cornerStyle === 'rounded' ? '12px' : '0px');
}

async function digest(value){
  const text = String(value || '');
  if (crypto?.subtle) {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return `sha256:${Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')}`;
  }

  // Local-preview fallback for plain HTTP/Tailscale where crypto.subtle may be unavailable.
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `local:${(h >>> 0).toString(16)}`;
}

function hasAdminPassword(){
  return !!localStorage.getItem(ADMIN_PASSWORD_KEY);
}

function isAdminUnlocked(){
  return sessionStorage.getItem(ADMIN_UNLOCK_KEY) === 'true' && !!adminPin();
}

function lockAdmin(){
  sessionStorage.removeItem(ADMIN_UNLOCK_KEY);
  sessionStorage.removeItem(ADMIN_PIN_SESSION_KEY);
}

async function setAdminPassword(password){
  if (!await verifyAdminPin(password)) throw new Error('Incorrect admin PIN.');
  localStorage.setItem(ADMIN_PASSWORD_KEY, await digest(password));
  sessionStorage.setItem(ADMIN_UNLOCK_KEY, 'true');
  sessionStorage.setItem(ADMIN_PIN_SESSION_KEY, password);
}

async function unlockAdmin(password){
  const saved = localStorage.getItem(ADMIN_PASSWORD_KEY);
  if (!saved) return false;
  const next = await digest(password);
  if (next !== saved && next.replace(/^sha256:/, '') !== saved) return false;
  sessionStorage.setItem(ADMIN_UNLOCK_KEY, 'true');
  sessionStorage.setItem(ADMIN_PIN_SESSION_KEY, password);
  return true;
}

function resetAdminPassword(){
  localStorage.removeItem(ADMIN_PASSWORD_KEY);
  sessionStorage.removeItem(ADMIN_UNLOCK_KEY);
  sessionStorage.removeItem(ADMIN_PIN_SESSION_KEY);
}

function navCatalog(){
  location.hash = '#/';
}

function navProduct(slug, preselect = {}){
  const params = new URLSearchParams();
  if (preselect.size) params.set('size', preselect.size);
  if (preselect.qty) params.set('qty', String(preselect.qty));
  location.hash = `#/p/${encodeURIComponent(slug)}?${params.toString()}`;
}

function parseRoute(){
  const raw = location.hash || '#/';
  const [path, qs] = raw.replace(/^#/, '').split('?');
  const params = new URLSearchParams(qs || '');
  if (path === '/' || path === '') return { view: 'catalog' };
  if (path === '/admin-reset') return { view: 'admin-reset' };
  if (path === '/admin') return { view: 'admin', tab: params.get('tab') || 'settings' };
  const m = path.match(/^\/p\/(.+)$/);
  if (m) return { view: 'product', slug: decodeURIComponent(m[1]), params };
  return { view: 'catalog' };
}

function cloneProducts(list){
  return JSON.parse(JSON.stringify(list)).map(normalizeProduct);
}

function normalizeProduct(product){
  return {
    ...product,
    images: Array.isArray(product.images) ? product.images.filter(Boolean).slice(0, 2) : []
  };
}

function loadProducts(){
  if (Array.isArray(state.remoteProducts) && state.remoteProducts.length) return state.remoteProducts.map(normalizeProduct);
  try {
    const parsed = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || 'null');
    return Array.isArray(parsed) && parsed.length ? parsed.map(normalizeProduct) : cloneProducts(seedProducts);
  } catch {
    return cloneProducts(seedProducts);
  }
}

function saveProducts(products){
  const compact = products.map(normalizeProduct).map(product => ({
    ...product,
    images: (product.images || []).map(src => String(src || '').startsWith('data:image/') ? '' : src).filter(Boolean).slice(0, 2)
  }));
  localStorage.removeItem(PRODUCTS_KEY);
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(compact));
}

async function productsForBackend(products){
  return Promise.all(products.map(async product => ({
    ...product,
    images: await Promise.all((product.images || []).slice(0, 2).map(src => resolveImageSrc(src)))
  })));
}

async function saveProductsRemote(products){
  const remoteProducts = await productsForBackend(products.map(normalizeProduct));
  await apiRequest('saveProducts', { products: remoteProducts }, { admin: true });
  state.remoteProducts = remoteProducts;
}

async function saveSettingsRemote(settings){
  const remoteSettings = { ...settings, logoImage: state.logoImage || settings.logoImage || '' };
  await apiRequest('saveSettings', { settings: remoteSettings }, { admin: true });
  state.remoteSettings = remoteSettings;
}

function resetProducts(){
  localStorage.removeItem(PRODUCTS_KEY);
}

function bySlug(slug){
  return loadProducts().find(p => p.slug === slug);
}

function makeId(){
  return crypto?.randomUUID ? crypto.randomUUID() : `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadRequests(){
  if (Array.isArray(state.remoteRequests)) return state.remoteRequests;
  try {
    const parsed = JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRequests(requests){
  localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
}

function addRequest(entry){
  const requests = [entry, ...loadRequests()];
  saveRequests(requests);
  state.remoteRequests = requests;
  return entry;
}

function updateRequest(id, patch){
  const next = loadRequests().map(req => req.id === id ? { ...req, ...patch } : req);
  state.remoteRequests = next;
  saveRequests(next);
  apiRequest('updateRequest', { id, patch }, { admin: true }).catch(err => console.warn('Shared order update failed:', err?.message || err));
}

function deleteRequest(id){
  const next = loadRequests().filter(req => req.id !== id);
  state.remoteRequests = next;
  saveRequests(next);
  apiRequest('deleteRequest', { id }, { admin: true }).catch(err => console.warn('Shared order delete failed:', err?.message || err));
}

function slugify(value){
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'product';
}

function splitSizes(value){
  return String(value || '')
    .split(/[,\n]/)
    .map(v => v.trim())
    .filter(Boolean);
}

function splitImages(value){
  return String(value || '')
    .split(/\n/)
    .map(v => v.trim())
    .filter(Boolean);
}

function safeJson(value, fallback){
  try { return JSON.parse(value); } catch { return fallback; }
}

function fileToDataUrl(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Image read failed'));
    reader.readAsDataURL(file);
  });
}

async function compressImageSource(src, { maxSize = 700, quality = 0.72 } = {}){
  if (!String(src || '').startsWith('data:image/') || String(src).startsWith('data:image/svg')) return src;

  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

  const scale = Math.min(1, maxSize / Math.max(img.width || 1, img.height || 1));
  const width = Math.max(1, Math.round((img.width || 1) * scale));
  const height = Math.max(1, Math.round((img.height || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/webp', quality);
}

async function imageFileToDataUrl(file, { maxSize = 700, quality = 0.72 } = {}){
  const raw = await fileToDataUrl(file);
  if (!String(file.type || '').startsWith('image/') || String(file.type).includes('svg')) return raw;
  return compressImageSource(raw, { maxSize, quality });
}

function csvCell(value){
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadRequestsCsv(){
  const rows = loadRequests();
  const headers = ['createdAt','status','productName','productType','size','qty','customerName','customerContact','notes'];
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(key => csvCell(row[key])).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tappay-orders-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function productEditorHtml(){
  return loadProducts().map(product => `
    <article class="productEditItem" data-id="${escapeHtml(product.id)}">
      <div class="productEditFields">
        <label>Name<input data-field="name" value="${escapeHtml(product.name)}" /></label>
        <label>Price<input data-field="price" type="number" min="0" step="1" value="${escapeHtml(String(product.price))}" /></label>
        <label>Category<select data-field="category">
          ${categories.filter(c => c !== 'All').map(cat => `<option value="${escapeHtml(cat)}" ${product.category === cat ? 'selected' : ''}>${escapeHtml(cat)}</option>`).join('')}
        </select></label>
        <label>Type<input data-field="type" value="${escapeHtml(product.type)}" /></label>
        <label class="wide">Description<textarea data-field="description">${escapeHtml(product.description)}</textarea></label>
        <label class="wide">Sizes<input data-field="sizes" value="${escapeHtml((product.sizes || []).join(', '))}" /></label>
        <div class="wide imageManager">
          <div class="imageManagerTop"><strong>Images</strong><span>${(product.images || []).length}/2 saved</span></div>
          <input data-field="imageState" type="hidden" value="${escapeHtml(JSON.stringify(product.images || []))}" />
          <div class="imageThumbGrid">
            ${['Front', 'Back'].map((label, index) => {
              const src = (product.images || [])[index] || '';
              return `
                <div class="imageThumb ${src ? '' : 'empty'}" data-index="${index}">
                  <strong>${label}</strong>
                  ${src ? `<img src="${escapeHtml(imageSrcAttr(src))}"${imageRefAttr(src)} alt="${escapeHtml(product.name)} ${label.toLowerCase()} image" />` : `<div class="imageSlotEmpty">No ${label.toLowerCase()} image</div>`}
                  <div class="imageThumbActions">
                    <label>Upload<input data-field="upload-${index}" type="file" accept="image/*" /></label>
                    <button type="button" data-action="remove-image" aria-label="Remove ${label.toLowerCase()} image">Remove</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
          <details>
            <summary>Advanced image paths (max 2 total)</summary>
            <textarea data-field="images">${escapeHtml((product.images || []).filter(src => !String(src).startsWith('data:') && !isProductImageRef(src)).join('\n'))}</textarea>
          </details>
        </div>
        <div class="wide productInlineActions">
          <button type="button" data-action="save-product">Save Product</button>
          <span data-role="save-status"></span>
        </div>
      </div>
    </article>
  `).join('');
}

async function readProductEditorItem(item){
  const current = loadProducts();
  const original = current.find(product => product.id === item.dataset.id) || {};
  const read = field => item.querySelector(`[data-field="${field}"]`)?.value.trim() || '';
  const name = read('name');
  const stateImages = safeJson(item.querySelector('[data-field="imageState"]')?.value || '[]', []).slice(0, 2);
  const advancedImages = splitImages(read('images')).slice(0, 2);
  const imageList = [0, 1].map(index => advancedImages[index] || stateImages[index] || '');
  const productId = original.id || item.dataset.id || slugify(name);
  for (const index of [0, 1]) {
    const file = item.querySelector(`[data-field="upload-${index}"]`)?.files?.[0];
    if (file) {
      const dataUrl = await imageFileToDataUrl(file, { maxSize: 900, quality: 0.78 });
      await idbSet(productImageKey(productId, index), dataUrl);
      imageList[index] = productImageRef(productId, index);
    } else if (String(imageList[index] || '').startsWith('data:image/')) {
      const dataUrl = await compressImageSource(imageList[index], { maxSize: 900, quality: 0.78 });
      await idbSet(productImageKey(productId, index), dataUrl);
      imageList[index] = productImageRef(productId, index);
    }
  }
  const finalImages = imageList.filter(Boolean).slice(0, 2);

  return normalizeProduct({
    ...original,
    name,
    slug: slugify(name || original.slug || original.id),
    price: Number(read('price')) || 0,
    category: read('category') || original.category || 'T-Shirts',
    type: read('type') || original.type || 'Item',
    description: read('description'),
    sizes: splitSizes(read('sizes')).length ? splitSizes(read('sizes')) : original.sizes || ['S','M','L','XL'],
    images: finalImages.length ? finalImages : original.images || []
  });
}

async function saveProductEditorItem(item){
  const product = await readProductEditorItem(item);
  const next = loadProducts().map(existing => existing.id === product.id ? product : existing);
  saveProducts(next);
  await saveProductsRemote(next);
  return product;
}

function icon(name){
  const icons = {
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    bag: '<svg viewBox="0 0 24 24"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M20.8 8.6c0 5.4-8.8 10.1-8.8 10.1S3.2 14 3.2 8.6A4.6 4.6 0 0 1 12 6.7a4.6 4.6 0 0 1 8.8 1.9Z"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 18 9 12l6-6"/></svg>',
    cash: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" fill="#20c35a" stroke="none"/><path d="M12 7v10M15 9.5c-.5-.9-1.5-1.3-3-1.3-1.6 0-2.7.8-2.7 1.9 0 3 5.5 1.4 5.5 4.2 0 1.1-1.1 1.9-2.8 1.9-1.4 0-2.6-.5-3.2-1.5" stroke="#fff"/></svg>',
    venmo: '<svg viewBox="0 0 24 24"><path d="M7 5h4l1.1 8.2c1.5-2.4 2.3-5 2.3-8.2h4c0 5.7-2.6 10.8-6.2 14H8.6L7 5Z" fill="#2878b8" stroke="none"/></svg>'
  };
  return icons[name] || '';
}

function sizePill(label, active, onClick){
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'sizePill';
  b.setAttribute('aria-pressed', active ? 'true' : 'false');
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function siteHeader(){
  const settings = loadSettings();
  const logoImage = state.logoImage || settings.logoImage;
  const hasLogo = settings.brandType === 'logo' && logoImage;
  return `
    <header class="catalogTop cleanHeader">
      <a class="${hasLogo ? 'logoMark' : 'wordmark'}" href="#/" aria-label="Home">
        ${hasLogo
          ? `<img src="${escapeHtml(logoImage)}" alt="${escapeHtml(settings.logoAlt || 'Store logo')}" style="max-width:${escapeHtml(settings.logoMaxWidth || '180')}px" />`
          : `<strong>${escapeHtml(settings.wordmarkTop)}</strong><span>${escapeHtml(settings.wordmarkBottom)}</span>`}
      </a>
    </header>
  `;
}

function siteFooter(){
  const settings = loadSettings();
  return `
    <footer class="siteFooter">
      <strong>${escapeHtml(settings.footerTitle)}</strong>
      <span>${escapeHtml(settings.footerText)}</span>
      <small class="appVersion">TapPay ${escapeHtml(APP_VERSION)}</small>
      <a href="#/admin">Admin</a>
    </footer>
  `;
}

function renderCatalog(){
  const settings = loadSettings();
  app.innerHTML = `
    ${siteHeader()}
    <main class="catalogPanel">
      <section class="catalogIntro">
        <span class="eyebrow">${escapeHtml(settings.introEyebrow)}</span>
        <h1>${escapeHtml(settings.introTitle)}</h1>
        <p>${escapeHtml(settings.introText)}</p>
      </section>
      <div class="categoryRail" id="categoryRail"></div>
      <section class="productGrid" id="productGrid"></section>
      <section class="howItWorksBlock">
        <h2>How it works</h2>
        <ol>
          <li>Pick a product.</li>
          <li>Choose your size and quantity.</li>
          <li>Submit your order — no account or card checkout required.</li>
        </ol>
      </section>
    </main>
    ${siteFooter()}
  `;

  const rail = app.querySelector('#categoryRail');
  categories.forEach(cat => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'categoryBtn';
    b.setAttribute('aria-pressed', state.category === cat ? 'true' : 'false');
    b.textContent = cat;
    b.addEventListener('click', () => {
      state.category = cat;
      renderCatalog();
    });
    rail.appendChild(b);
  });

  const grid = app.querySelector('#productGrid');
  const productList = loadProducts();
  const visible = state.category === 'All' ? productList : productList.filter(p => p.category === state.category);
  grid.innerHTML = visible.map(product => `
    <article class="productCard" data-slug="${escapeHtml(product.slug)}">
      <button class="heartBtn" type="button" aria-label="Favorite">${icon('heart')}</button>
      <div class="productImage"><img src="${escapeHtml(imageSrcAttr(product.images[0]))}"${imageRefAttr(product.images[0])} alt="${escapeHtml(product.name)}" /></div>
      <div class="productInfo">
        <h2>${escapeHtml(product.name)}</h2>
        <div class="cardPrice">${money(product.price)}</div>
        <button class="cardRequestBtn" type="button">Order</button>
      </div>
    </article>
  `).join('') || `<div class="emptyState">No products in this category yet.</div>`;

  grid.querySelectorAll('.productCard').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.heartBtn')) return;
      const product = bySlug(card.dataset.slug);
      navProduct(product.slug, { size: product.sizes[2] || product.sizes[0], qty: 1 });
    });
  });

  hydrateProductImages(grid);

}

function setSelectionFromParams(product, params){
  const size = params.get('size');
  const qtyRaw = params.get('qty');
  return {
    selectedSize: size && product.sizes.includes(size) ? size : product.sizes[0],
    qty: qtyRaw && Number(qtyRaw) > 0 ? Math.min(99, Math.floor(Number(qtyRaw))) : 1
  };
}

function fmtSummary({ product, size, qty, notes, customerName = '', customerContact = '' }){
  return [
    `TapPay Order: ${product.name}`,
    `Item: ${product.type}`,
    `Size: ${size}`,
    `Quantity: ${qty}`,
    customerName.trim() ? `Name: ${customerName.trim()}` : null,
    customerContact.trim() ? `Contact: ${customerContact.trim()}` : null,
    notes.trim() ? `Notes: ${notes.trim()}` : null,
    '---',
    `Submitted from: ${location.host}`
  ].filter(Boolean).join('\n');
}

async function sendRequestNotification({ request, product, settings, summary }){
  const result = await apiRequest('addRequest', {
    source: 'tappay-v1',
    store: {
      wordmarkTop: settings.wordmarkTop,
      wordmarkBottom: settings.wordmarkBottom,
      requestEmail: settings.requestEmail
    },
    request,
    product: { id: product.id, name: product.name, type: product.type, price: product.price },
    summary
  });
  if (result.notification?.error) return { ok: false, warning: result.notification.error };
  return { ok: true };
}

function renderProduct(product, params){
  const settings = loadSettings();
  const { selectedSize, qty } = setSelectionFromParams(product, params);
  let currentImg = 0;
  let selSize = selectedSize;
  let selQty = qty;
  let selNotes = '';

  app.innerHTML = `
    <main class="detailPage">
      ${siteHeader()}
      <section class="detailHero">
        <button class="iconBtn backBtn" type="button" id="backBtn" aria-label="Back">${icon('back')}</button>
        <button class="iconBtn favoriteBtn" type="button" aria-label="Favorite">${icon('heart')}</button>
        <img id="heroImg" src="${escapeHtml(imageSrcAttr(product.images[0]))}"${imageRefAttr(product.images[0])} alt="${escapeHtml(product.name)}" />
      </section>
      <div class="imageDots" id="imageDots"></div>
      <section class="detailBody">
        <div class="titleRow"><h1>${escapeHtml(product.name)}</h1><strong>${money(product.price)}</strong></div>
        <p class="detailDesc">${escapeHtml(product.description)}</p>
        <div class="field"><label>Size</label><div class="sizeRow" id="sizeRow"></div></div>
        <div class="field"><label>Quantity</label><div class="qtyStepper"><button id="qtyMinus" type="button">−</button><span id="qtyVal">${selQty}</span><button id="qtyPlus" type="button">+</button></div></div>
        <div class="field"><label>Name</label><input id="nameInput" type="text" maxlength="80" placeholder="Your name" /></div>
        <div class="field"><label>Email or phone</label><input id="contactInput" type="text" maxlength="120" placeholder="Best way to contact you" /></div>
        <div class="field"><label>Notes <span>(optional)</span></label><textarea id="notesInput" maxlength="250" placeholder="Any order details?"></textarea><div class="charCount" id="charCount">0/250</div></div>
        <button class="primaryBtn requestCta" id="requestBtn" type="button">Submit order</button>
        <div class="requestStatus" id="requestStatus"></div>
        <div class="optionalPay">Pay direct with Cash App or Venmo</div>
        <div class="paymentBox">
          <div class="payRow"><a class="payBtn" id="cashPay" href="#" target="_blank" rel="noreferrer">${icon('cash')} Cash App</a><a class="payBtn" id="venmoPay" href="#" target="_blank" rel="noreferrer">${icon('venmo')} Venmo</a></div>
          <button class="copyDetailsBtn" id="copyDetailsBtn" type="button">Copy payment details</button>
          <div class="copyStatus" id="copyStatus" aria-live="polite"></div>
          <div class="paymentHint" id="paymentHint">If your payment app opens at $0, copy the payment details and paste them.</div>
        </div>
      </section>
      ${siteFooter()}
    </main>
  `;

  app.querySelector('#backBtn').addEventListener('click', navCatalog);

  const heroImg = app.querySelector('#heroImg');
  const dots = app.querySelector('#imageDots');
  function renderDots(){
    dots.innerHTML = product.images.map((_, i) => `<button type="button" aria-current="${i === currentImg ? 'true' : 'false'}" aria-label="Image ${i + 1}"></button>`).join('');
    dots.querySelectorAll('button').forEach((b, i) => b.addEventListener('click', () => {
      currentImg = i;
      setImageElementSource(heroImg, product.images[i]);
      renderDots();
    }));
  }
  renderDots();
  hydrateProductImages(app.querySelector('.detailPage'));

  const sizeRow = app.querySelector('#sizeRow');
  function renderSizes(){
    sizeRow.innerHTML = '';
    product.sizes.forEach(size => sizeRow.appendChild(sizePill(size, size === selSize, () => { selSize = size; renderSizes(); updatePaymentLinks(); })));
  }
  renderSizes();

  const qtyVal = app.querySelector('#qtyVal');
  const cashPay = app.querySelector('#cashPay');
  const venmoPay = app.querySelector('#venmoPay');
  const paymentHint = app.querySelector('#paymentHint');
  const copyDetailsBtn = app.querySelector('#copyDetailsBtn');
  const copyStatus = app.querySelector('#copyStatus');

  function currentPaymentTotal(){
    return Number(product.price || 0) * selQty;
  }

  function currentPaymentNote(){
    return `${product.name} - ${selSize} - Qty ${selQty}`;
  }

  function updatePaymentLinks(){
    const total = currentPaymentTotal();
    const note = currentPaymentNote();
    cashPay.href = cashAppHref(settings.paymentCash, total, note);
    venmoPay.href = venmoHref(settings.paymentVenmo, total, note);
    copyDetailsBtn.dataset.copyValue = [`Amount: ${paymentAmount(total)}`, `Order note: ${note}`].join('\n');
    paymentHint.innerHTML = `Payment total: <strong>${money(total)}</strong>${selQty > 1 ? ` (${money(product.price)} × ${selQty})` : ''}. If an app opens at $0, copy payment details and paste the amount.`;
  }

  async function copyPaymentDetails(){
    const value = copyDetailsBtn?.dataset.copyValue || '';
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      copyStatus.textContent = 'Payment details copied.';
    } catch {
      copyStatus.textContent = value.replace(/\n/g, ' • ');
    }
  }

  function setQty(next){
    selQty = Math.max(1, Math.min(99, next));
    qtyVal.textContent = String(selQty);
    updatePaymentLinks();
  }
  updatePaymentLinks();
  copyDetailsBtn.addEventListener('click', copyPaymentDetails);
  app.querySelector('#qtyMinus').addEventListener('click', () => setQty(selQty - 1));
  app.querySelector('#qtyPlus').addEventListener('click', () => setQty(selQty + 1));

  const notesInput = app.querySelector('#notesInput');
  const charCount = app.querySelector('#charCount');
  notesInput.addEventListener('input', () => {
    selNotes = notesInput.value;
    charCount.textContent = `${selNotes.length}/250`;
  });

  const requestStatus = app.querySelector('#requestStatus');
  const requestBtn = app.querySelector('#requestBtn');
  requestBtn.addEventListener('click', async () => {
    setBusy(true);
    const customerName = app.querySelector('#nameInput').value.trim();
    const customerContact = app.querySelector('#contactInput').value.trim();
    if (!customerName || !customerContact) {
      requestStatus.textContent = 'Add your name and email/phone first.';
      setBusy(false);
      return;
    }

    const request = addRequest({
      id: makeId(),
      productId: product.id,
      productName: product.name,
      productType: product.type,
      size: selSize,
      qty: selQty,
      notes: selNotes,
      customerName,
      customerContact,
      status: 'new',
      createdAt: new Date().toISOString()
    });

    const summary = fmtSummary({ product, size: selSize, qty: selQty, notes: selNotes, customerName, customerContact });
    try { await navigator.clipboard?.writeText(summary); } catch {}
    const mailTo = `mailto:${encodeURIComponent(settings.requestEmail)}?subject=${encodeURIComponent(`TapPay order: ${product.name}`)}&body=${encodeURIComponent(summary)}`;
    requestBtn.disabled = true;
    [app.querySelector('#nameInput'), app.querySelector('#contactInput'), notesInput, app.querySelector('#qtyMinus'), app.querySelector('#qtyPlus')]
      .filter(Boolean)
      .forEach(el => { el.disabled = true; });
    sizeRow.querySelectorAll('button').forEach(btn => { btn.disabled = true; });

    let notificationNotice = '';
    try {
      const result = await sendRequestNotification({ request, product, settings, summary });
      if (result.warning) notificationNotice = `<div class="notificationNotice warning">Order saved, but email notification did not send. ${escapeHtml(result.warning)}</div>`;
      else notificationNotice = '<div class="notificationNotice sent">Order saved and email notification sent.</div>';
    } catch (err) {
      notificationNotice = `<div class="notificationNotice warning">Order saved, but email notification did not send. ${escapeHtml(err?.message || err)}</div>`;
    }

    requestStatus.innerHTML = `
      <div class="successCard">
        <div class="successMark">✓</div>
        <h2>Order submitted</h2>
        <p>Your order details are saved. The vendor will confirm payment and follow up using your contact info.</p>
        <div class="successSummary">
          <span>${escapeHtml(product.name)}</span>
          <strong>${escapeHtml(selSize)} • Qty ${escapeHtml(String(selQty))}</strong>
          <small>Order #${escapeHtml(request.id.slice(0, 8))}</small>
        </div>
        ${notificationNotice}
        <div class="successActions">
          <a href="#/" class="successBtn secondary">Back to storefront</a>
          <a href="${mailTo}" class="successBtn">Email order</a>
        </div>
      </div>
    `;
    setBusy(false);
  });
}

function navAdmin(tab = 'settings'){
  location.hash = `#/admin?tab=${encodeURIComponent(tab)}`;
}

function contactHref(contact){
  const value = String(contact || '').trim();
  if (!value) return '#';
  if (value.includes('@')) return `mailto:${encodeURIComponent(value)}`;
  const phone = value.replace(/[^+\d]/g, '');
  return phone ? `tel:${phone}` : '#';
}

function contactLabel(contact){
  return String(contact || '').includes('@') ? 'Email' : 'Call / Text';
}

function requestAge(iso){
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const mins = Math.max(1, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function renderRequestsAdmin(requests, newCount){
  const contactedCount = requests.filter(req => req.status === 'contacted').length;
  const doneCount = requests.filter(req => req.status === 'done').length;
  return `
    <section class="requestsPanel">
      <div class="requestStats">
        <div><strong>${requests.length}</strong><span>Total</span></div>
        <div><strong>${newCount}</strong><span>New</span></div>
        <div><strong>${contactedCount}</strong><span>Contacted</span></div>
        <div><strong>${doneCount}</strong><span>Done</span></div>
      </div>
      <div class="adminList">
      ${requests.length ? requests.map(req => `
        <article class="requestItem" data-id="${escapeHtml(req.id)}">
          <div class="requestItemTop">
            <div>
              <strong>${escapeHtml(req.productName)}</strong>
              <span>${escapeHtml(req.productType || 'Item')} • ${escapeHtml(req.size)} • Qty ${escapeHtml(String(req.qty))}</span>
            </div>
            <div class="requestBadges">
              <em class="statusTag ${escapeHtml(req.status)}">${escapeHtml(req.status)}</em>
              <small>${escapeHtml(requestAge(req.createdAt))}</small>
            </div>
          </div>
          <div class="requestCustomer">
            <div><span>Customer</span><strong>${escapeHtml(req.customerName)}</strong></div>
            <div><span>Contact</span><strong>${escapeHtml(req.customerContact)}</strong></div>
          </div>
          ${req.notes ? `<div class="requestNotes"><span>Notes</span><p>${escapeHtml(req.notes)}</p></div>` : ''}
          <div class="requestDate">Submitted ${escapeHtml(new Date(req.createdAt).toLocaleString())}</div>
          <div class="requestActions">
            <a href="${escapeHtml(contactHref(req.customerContact))}">${escapeHtml(contactLabel(req.customerContact))}</a>
            <button type="button" data-action="new">New</button>
            <button type="button" data-action="contacted">Contacted</button>
            <button type="button" data-action="done">Done</button>
            <button type="button" data-action="delete">Delete</button>
          </div>
        </article>
      `).join('') : `<div class="emptyInbox">No orders yet.</div>`}
      </div>
    </section>
  `;
}

function renderProductsAdmin(){
  return `
    <section class="productManager productManagerTabbed">
      <div class="productManagerTop">
        <div><h2>Products</h2><p>Edit storefront products without touching code.</p></div>
        <div class="adminTopActions">
          <button class="secondaryAdminBtn" type="button" id="saveProductsBtn">Save Products</button>
          <button class="secondaryAdminBtn" type="button" id="resetProductsBtn">Reset</button>
        </div>
      </div>
      <div class="productEditList" id="productEditList">${productEditorHtml()}</div>
      <div class="adminSaveMsg" id="adminSaveMsg"></div>
    </section>
  `;
}

function settingsField(label, key, value, type = 'text'){
  const isLong = type === 'textarea';
  if (type === 'select') {
    return `
      <label class="settingsField">
        <span>${escapeHtml(label)}</span>
        <select data-setting="${key}">
          <option value="square" ${value === 'square' ? 'selected' : ''}>Square</option>
          <option value="rounded" ${value === 'rounded' ? 'selected' : ''}>Rounded</option>
        </select>
      </label>
    `;
  }
  if (type === 'brand-select') {
    return `
      <label class="settingsField">
        <span>${escapeHtml(label)}</span>
        <select data-setting="${key}">
          <option value="text" ${value === 'text' ? 'selected' : ''}>Text wordmark</option>
          <option value="logo" ${value === 'logo' ? 'selected' : ''}>Logo image</option>
        </select>
      </label>
    `;
  }
  if (type === 'theme-select') {
    const options = themePresetOptions(value || DEFAULT_THEME_ID).map(theme => `
          <option value="${escapeHtml(theme.id)}" ${theme.selected ? 'selected' : ''}>${escapeHtml(theme.name)}</option>`).join('');
    return `
      <label class="settingsField wide">
        <span>${escapeHtml(label)}</span>
        <select data-setting="${key}">${options}
        </select>
      </label>
    `;
  }
  if (type === 'toggle-select') {
    return `
      <label class="settingsField">
        <span>${escapeHtml(label)}</span>
        <select data-setting="${key}">
          <option value="off" ${value !== 'on' ? 'selected' : ''}>Off</option>
          <option value="on" ${value === 'on' ? 'selected' : ''}>On</option>
        </select>
      </label>
    `;
  }
  return `
    <label class="settingsField ${isLong ? 'wide' : ''}">
      <span>${escapeHtml(label)}</span>
      ${isLong
        ? `<textarea data-setting="${key}">${escapeHtml(value)}</textarea>`
        : `<input data-setting="${key}" type="${type}" value="${escapeHtml(value)}" />`}
    </label>
  `;
}

function renderSettingsAdmin(){
  const settings = loadSettings();
  const logoImage = state.logoImage || settings.logoImage;
  return `
    <section class="settingsManager">
      <div class="productManagerTop">
        <div><h2>Settings</h2><p>Control the public copy, contact email, and payment handles.</p></div>
        <div class="adminTopActions">
          <button class="secondaryAdminBtn" type="button" id="saveSettingsBtn">Save Settings</button>
          <button class="secondaryAdminBtn" type="button" id="resetSettingsBtn">Reset</button>
        </div>
      </div>
      <div class="settingsGrid">
        <div class="settingsSectionTitle">Content</div>
        ${settingsField('Header brand type', 'brandType', settings.brandType, 'brand-select')}
        ${settingsField('Wordmark top', 'wordmarkTop', settings.wordmarkTop)}
        ${settingsField('Wordmark bottom', 'wordmarkBottom', settings.wordmarkBottom)}
        ${settingsField('Logo alt text', 'logoAlt', settings.logoAlt)}
        ${settingsField('Logo max width', 'logoMaxWidth', settings.logoMaxWidth, 'number')}
        <div class="settingsField wide logoSetting">
          <span>Logo image</span>
          <div id="logoPreview">${logoImage ? `<img src="${escapeHtml(logoImage)}" alt="${escapeHtml(settings.logoAlt)}" />` : `<div class="imageSlotEmpty">No logo uploaded</div>`}</div>
          <input data-setting-file="logoImage" type="file" accept="image/*" />
          <input data-setting="logoImage" type="hidden" value="" />
          <div class="adminResetHint" id="logoUploadHint">Choose a file, then Save Settings.</div>
          <button type="button" class="resetAdminBtn" id="removeLogoBtn">Remove logo</button>
        </div>
        ${settingsField('Intro eyebrow', 'introEyebrow', settings.introEyebrow)}
        ${settingsField('Intro title', 'introTitle', settings.introTitle)}
        ${settingsField('Intro text', 'introText', settings.introText, 'textarea')}
        ${settingsField('Footer title', 'footerTitle', settings.footerTitle)}
        ${settingsField('Footer text', 'footerText', settings.footerText, 'textarea')}
        ${settingsField('Order email', 'requestEmail', settings.requestEmail, 'email')}
        <div class="settingsSectionTitle">Email notifications</div>
        ${settingsField('Email notifications', 'notificationsEnabled', settings.notificationsEnabled, 'toggle-select')}
        ${settingsField('Notification endpoint', 'notificationEndpoint', settings.notificationEndpoint, 'url')}
        ${settingsField('Cash App', 'paymentCash', settings.paymentCash)}
        ${settingsField('Venmo', 'paymentVenmo', settings.paymentVenmo)}
        <div class="settingsSectionTitle">Admin access</div>
        <div class="settingsField wide adminAccessSettings">
          <span>Saved admin PIN for this browser</span>
          <p>This does not change the server master PIN. It updates the PIN this browser uses to unlock and sync admin data.</p>
          <label>New admin PIN<input id="newAdminPinInput" type="password" autocomplete="new-password" placeholder="Enter current server PIN" /></label>
          <div class="adminPasswordActions">
            <button type="button" class="secondaryAdminBtn" id="saveAdminPinBtn">Save Admin PIN</button>
            <button type="button" class="resetAdminBtn" id="clearAdminPinBtn">Clear Saved PIN</button>
          </div>
          <div class="adminResetHint">To change the actual master PIN, update the Supabase <code>TAPPAY_ADMIN_PIN</code> secret.</div>
          <div class="adminSaveMsg" id="adminPinSaveMsg"></div>
        </div>
        <div class="settingsSectionTitle">Theme</div>
        ${settingsField('Theme preset', 'themePreset', settings.themePreset, 'theme-select')}
        ${settingsField('Header background', 'headerBg', settings.headerBg, 'color')}
        ${settingsField('Footer background', 'footerBg', settings.footerBg, 'color')}
        ${settingsField('Page background', 'pageBg', settings.pageBg, 'color')}
        ${settingsField('Panel background', 'panelBg', settings.panelBg, 'color')}
        ${settingsField('Card background', 'cardBg', settings.cardBg, 'color')}
        ${settingsField('Text color', 'textColor', settings.textColor, 'color')}
        ${settingsField('Muted text', 'mutedColor', settings.mutedColor, 'color')}
        ${settingsField('Accent / CTA', 'accentColor', settings.accentColor, 'color')}
        ${settingsField('Button text', 'buttonTextColor', settings.buttonTextColor, 'color')}
        ${settingsField('Product image background', 'productImageBg', settings.productImageBg, 'color')}
        ${settingsField('Corner style', 'cornerStyle', settings.cornerStyle, 'select')}
      </div>
      <div class="adminSaveMsg" id="settingsSaveMsg"></div>
    </section>
  `;
}

function renderAdminLock(){
  const setupMode = !hasAdminPassword();
  app.innerHTML = `
    <main class="adminPage">
      ${siteHeader()}
      <section class="adminLockPanel">
        <span class="eyebrow">Admin access</span>
        <h1>Admin PIN</h1>
        <p>Enter the shared admin PIN to manage products, settings, and orders.</p>
        <label>Admin PIN<input id="adminPasswordInput" type="password" autocomplete="current-password" /></label>
        <button class="primaryBtn" id="adminUnlockBtn" type="button">Unlock</button>
        <button class="resetAdminBtn" id="resetAdminPasswordBtn" type="button">Reset local admin PIN</button>
        <div class="adminResetHint">This only clears the saved unlock state in this browser.</div>
        <div class="adminLockMsg" id="adminLockMsg"></div>
      </section>
      ${siteFooter()}
    </main>
  `;

  const password = app.querySelector('#adminPasswordInput');
  const confirmInput = null;
  const msg = app.querySelector('#adminLockMsg');
  const submit = async () => {
    const value = password.value.trim();
    if (value.length < 4) {
      msg.textContent = 'Use at least 4 characters.';
      return;
    }
    try {
      await setAdminPassword(value);
      navAdmin('settings');
    } catch (err) {
      msg.textContent = err?.message || 'Admin unlock failed.';
    }
  };
  app.querySelector('#adminUnlockBtn').addEventListener('click', submit);
  app.querySelector('#resetAdminPasswordBtn')?.addEventListener('click', () => {
    const ok = window.confirm('Reset the local admin password for this browser? Products and orders will stay saved.');
    if (!ok) return;
    resetAdminPassword();
    renderAdminLock();
  });
  password.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  confirmInput?.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}

function renderAdmin(tab = 'requests'){
  if (!isAdminUnlocked()) {
    lockAdmin();
    renderAdminLock();
    return;
  }
  const requests = loadRequests();
  const newCount = requests.filter(req => req.status === 'new').length;
  const activeTab = ['settings', 'products', 'requests'].includes(tab) ? tab : 'settings';
  app.innerHTML = `
    <main class="adminPage">
      ${siteHeader()}
      <header class="adminTop">
        <div><h1>Admin</h1><p>${requests.length} orders • ${newCount} new</p></div>
        <div class="adminTopActions">
          <button class="secondaryAdminBtn" type="button" id="exportCsv" ${requests.length ? '' : 'disabled'}>Export CSV</button>
          <button class="secondaryAdminBtn" type="button" id="lockAdminBtn">Lock</button>
          <button class="secondaryAdminBtn" type="button" id="backCatalog">Storefront</button>
        </div>
      </header>
      <nav class="adminTabs">
        <button type="button" data-tab="settings" aria-current="${activeTab === 'settings'}">Settings</button>
        <button type="button" data-tab="products" aria-current="${activeTab === 'products'}">Products</button>
        <button type="button" data-tab="requests" aria-current="${activeTab === 'requests'}">Orders</button>
      </nav>
      ${activeTab === 'settings' ? renderSettingsAdmin() : activeTab === 'products' ? renderProductsAdmin() : renderRequestsAdmin(requests, newCount)}
      ${siteFooter()}
    </main>
  `;

  app.querySelector('#backCatalog').addEventListener('click', navCatalog);
  app.querySelector('#lockAdminBtn').addEventListener('click', () => {
    lockAdmin();
    renderAdminLock();
  });
  app.querySelector('#exportCsv').addEventListener('click', downloadRequestsCsv);
  app.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => navAdmin(btn.dataset.tab));
  });
  hydrateProductImages(app);

  const saveProductsBtn = app.querySelector('#saveProductsBtn');
  if (saveProductsBtn) saveProductsBtn.addEventListener('click', async () => {
    const msg = app.querySelector('#adminSaveMsg');
    try {
      const edited = [];
      for (const item of [...app.querySelectorAll('.productEditItem')]) {
        edited.push(await readProductEditorItem(item));
      }
      saveProducts(edited);
      await saveProductsRemote(edited);
      if (msg) msg.textContent = 'Products saved and synced.';
      renderAdmin('products');
    } catch (err) {
      if (msg) msg.textContent = `Save failed: ${err?.message || err}`;
    }
  });
  const resetProductsBtn = app.querySelector('#resetProductsBtn');
  if (resetProductsBtn) resetProductsBtn.addEventListener('click', () => {
    resetProducts();
    renderAdmin('products');
  });
  const productEditList = app.querySelector('#productEditList');
  if (productEditList) productEditList.addEventListener('click', (e) => {
    const saveBtn = e.target.closest('[data-action="save-product"]');
    if (saveBtn) {
      const item = saveBtn.closest('.productEditItem');
      const status = item?.querySelector('[data-role="save-status"]');
      saveBtn.disabled = true;
      saveProductEditorItem(item)
        .then(() => {
          if (status) status.textContent = 'Saved.';
          renderAdmin('products');
        })
        .catch(err => {
          if (status) status.textContent = `Save failed: ${err.message || err}`;
          saveBtn.disabled = false;
        });
      return;
    }

    const btn = e.target.closest('[data-action="remove-image"]');
    if (!btn) return;
    const thumb = btn.closest('.imageThumb');
    const item = btn.closest('.productEditItem');
    if (!thumb) return;
    const index = Number(thumb.dataset.index);
    const stateInput = item?.querySelector('[data-field="imageState"]');
    const advanced = item?.querySelector('[data-field="images"]');
    const images = safeJson(stateInput?.value || '[]', []);
    const removed = images[index];
    const next = [...images];
    next[index] = '';
    if (stateInput) stateInput.value = JSON.stringify(next);
    if (isProductImageRef(removed)) idbRemove(refToKey(removed)).catch(() => {});
    if (advanced && removed && !String(removed).startsWith('data:') && !isProductImageRef(removed)) {
      advanced.value = splitImages(advanced.value).filter(src => src !== removed).join('\n');
    }
    thumb.classList.add('empty');
    const label = index === 0 ? 'front' : 'back';
    const img = thumb.querySelector('img');
    const empty = thumb.querySelector('.imageSlotEmpty');
    if (img) img.outerHTML = `<div class="imageSlotEmpty">No ${label} image</div>`;
    else if (empty) empty.textContent = `No ${label} image`;
    const fileInput = thumb.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = '';
  });
  const adminList = app.querySelector('.adminList');
  if (adminList) adminList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const item = btn.closest('.requestItem');
    const id = item?.dataset.id;
    if (!id) return;
    if (btn.dataset.action === 'delete') deleteRequest(id);
    else updateRequest(id, { status: btn.dataset.action });
    renderAdmin('requests');
  });

  const logoInput = app.querySelector('[data-setting-file="logoImage"]');
  if (logoInput) logoInput.addEventListener('change', async () => {
    const file = logoInput.files?.[0];
    if (!file) return;
    const dataUrl = await imageFileToDataUrl(file, { maxSize: 900, quality: 0.82 });
    state.logoImage = dataUrl;
    const hidden = app.querySelector('[data-setting="logoImage"]');
    if (hidden) hidden.value = '';
    const brandType = app.querySelector('[data-setting="brandType"]');
    if (brandType) brandType.value = 'logo';
    const preview = app.querySelector('#logoPreview');
    if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="Logo preview" />`;
    const hint = app.querySelector('#logoUploadHint');
    if (hint) hint.textContent = 'Logo ready. Click Save Settings.';
  });

  const themePresetSelect = app.querySelector('[data-setting="themePreset"]');
  if (themePresetSelect) themePresetSelect.addEventListener('change', () => {
    const presetSettings = getThemeDefaults(themePresetSelect.value);
    Object.entries(presetSettings).forEach(([key, value]) => {
      if (key === 'logoImage') return;
      const field = app.querySelector(`[data-setting="${key}"]`);
      if (field && field.type !== 'file') field.value = value;
    });
    applyTheme({ ...loadSettings(), ...presetSettings, themePreset: themePresetSelect.value });
    const msg = app.querySelector('#settingsSaveMsg');
    if (msg) msg.textContent = 'Theme preset loaded. Click Save Settings to publish it.';
  });

  const saveSettingsBtn = app.querySelector('#saveSettingsBtn');
  if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', async () => {
    const next = { ...loadSettings() };
    app.querySelectorAll('[data-setting]').forEach(input => {
      next[input.dataset.setting] = input.value.trim();
    });
    const logoFile = app.querySelector('[data-setting-file="logoImage"]')?.files?.[0];
    if (logoFile) {
      try {
        state.logoImage = await imageFileToDataUrl(logoFile, { maxSize: 600, quality: 0.76 });
        await idbSet(LOGO_IDB_KEY, state.logoImage);
        state.logoHydrated = true;
        next.brandType = 'logo';
      } catch (err) {
        app.querySelector('#settingsSaveMsg').textContent = `Logo save failed: ${err?.message || err}`;
        return;
      }
    }
    next.logoImage = '';
    if (next.brandType === 'logo' && !state.logoImage) {
      app.querySelector('#settingsSaveMsg').textContent = 'Upload a logo first, or switch brand type to Text wordmark.';
      return;
    }
    const result = saveSettings(next);
    if (!result.ok) {
      app.querySelector('#settingsSaveMsg').textContent = `Settings save failed: ${result.error}`;
      return;
    }
    try {
      await saveSettingsRemote(next);
      app.querySelector('#settingsSaveMsg').textContent = 'Settings saved and synced.';
    } catch (err) {
      app.querySelector('#settingsSaveMsg').textContent = `Settings saved locally, but sync failed: ${err?.message || err}`;
      return;
    }
    renderAdmin('settings');
  });

  const saveAdminPinBtn = app.querySelector('#saveAdminPinBtn');
  if (saveAdminPinBtn) saveAdminPinBtn.addEventListener('click', async () => {
    const input = app.querySelector('#newAdminPinInput');
    const msg = app.querySelector('#adminPinSaveMsg');
    const value = input?.value.trim() || '';
    if (value.length < 4) {
      msg.textContent = 'Use at least 4 characters.';
      return;
    }
    try {
      await setAdminPassword(value);
      msg.textContent = 'Admin PIN saved for this browser.';
      input.value = '';
    } catch (err) {
      msg.textContent = err?.message || 'Admin PIN save failed.';
    }
  });

  const clearAdminPinBtn = app.querySelector('#clearAdminPinBtn');
  if (clearAdminPinBtn) clearAdminPinBtn.addEventListener('click', () => {
    const ok = window.confirm('Clear the saved admin PIN for this browser? You will need to unlock admin again.');
    if (!ok) return;
    resetAdminPassword();
    renderAdminLock();
  });

  const resetSettingsBtn = app.querySelector('#resetSettingsBtn');
  if (resetSettingsBtn) resetSettingsBtn.addEventListener('click', async () => {
    localStorage.removeItem(SETTINGS_KEY);
    await idbRemove(LOGO_IDB_KEY).catch(() => {});
    state.logoImage = '';
    state.logoHydrated = true;
    renderAdmin('settings');
  });

  app.querySelector('#removeLogoBtn')?.addEventListener('click', async () => {
    await idbRemove(LOGO_IDB_KEY).catch(() => {});
    state.logoImage = '';
    state.logoHydrated = true;
    const next = { ...loadSettings(), logoImage: '', brandType: 'text' };
    saveSettings(next);
    renderAdmin('settings');
  });
}

function wire(){
  applyTheme();
  const route = parseRoute();
  const needsAdminSync = route.view === 'admin' && isAdminUnlocked() && !state.adminSyncAttempted;
  if ((!state.backendHydrated || needsAdminSync) && !state.backendHydrating) {
    app.innerHTML = `${siteHeader()}<main class="catalogPanel"><section class="catalogIntro"><span class="eyebrow">Loading</span><h1>Syncing storefront...</h1><p>Pulling the shared storefront data.</p></section></main>${siteFooter()}`;
    const timeout = new Promise(resolve => setTimeout(() => resolve(false), 5000));
    Promise.race([syncBackend({ admin: needsAdminSync, force: needsAdminSync }), timeout]).then(() => {
      if (!state.backendHydrated) state.backendHydrated = true;
      wire();
    });
    return;
  }
  if (!state.logoHydrated && !state.logoHydrating) {
    hydrateLogo().then(() => {
      const settings = loadSettings();
      if (settings.brandType === 'logo' && state.logoImage) wire();
    });
  }
  if (route.view === 'catalog') return renderCatalog();
  if (route.view === 'admin-reset') {
    resetAdminPassword();
    location.hash = '#/admin';
    return;
  }
  if (route.view === 'admin') return renderAdmin(route.tab);
  const product = bySlug(route.slug);
  if (!product) return navCatalog();
  renderProduct(product, route.params);
}

window.addEventListener('hashchange', wire);
wire();
