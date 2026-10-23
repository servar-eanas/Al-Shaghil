// Load Three.js with a fallback CDN so a single blocked CDN cannot freeze the whole menu.
let THREE;
try {
  THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
} catch (primaryImportError) {
  try {
    THREE = await import('https://unpkg.com/three@0.160.0/build/three.module.js');
  } catch (fallbackImportError) {
    const detail = fallbackImportError?.message || primaryImportError?.message || 'Unknown module-loading error';
    window.__SHAGHEEL_GAME_INIT_ERROR = detail;
    const card = document.querySelector('.entryCard');
    if (card) {
      const box = document.createElement('div');
      box.id = 'gameBootError';
      box.setAttribute('role', 'alert');
      box.style.cssText = 'margin-top:14px;padding:12px;border:1px solid #e6a15b;border-radius:12px;background:#38291c;color:#ffe0b3;font:12px/1.8 sans-serif;overflow-wrap:anywhere';
      box.textContent = 'تعذّر تحميل محرك الرسومات. جرّب تحديث الصفحة أو شبكة إنترنت أخرى. التفاصيل: ' + detail;
      card.prepend(box);
    }
    throw fallbackImportError;
  }
}
function showGameInitError(error) {
  const detail = error?.stack || error?.message || String(error);
  window.__SHAGHEEL_GAME_INIT_ERROR = detail;
  console.error('الشغيل initialization failed:', error);
  const card = document.querySelector('.entryCard');
  if (!card || document.getElementById('gameBootError')) return;
  const box = document.createElement('div');
  box.id = 'gameBootError';
  box.setAttribute('role', 'alert');
  box.style.cssText = 'margin-top:14px;padding:12px;border:1px solid #e6a15b;border-radius:12px;background:#38291c;color:#ffe0b3;font:12px/1.8 sans-serif;overflow-wrap:anywhere';
  box.textContent = 'اللعبة لم تكتمل عملية تشغيلها، لذلك قد لا تستجيب الأزرار. أرسل هذه الرسالة للدعم: ' + (error?.message || String(error));
  card.prepend(box);
}
window.addEventListener('error', event => {
  if (!window.__SHAGHEEL_GAME_READY && event?.error) showGameInitError(event.error);
});
try {
const $ = (id) => document.getElementById(id);
const canvas = $('gameCanvas');
const moneyFmt = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const itemKeys = ['water', 'chips', 'milk'];
const JOBS = { shopkeeper:{label:'صاحب الدكان',icon:'🏪',color:'#477b63',uniform:'مريول أخضر'}, mechanic:{label:'ميكانيكي',icon:'🔧',color:'#d18b3f',uniform:'بدلة ورشة برتقالية'}, police:{label:'شرطي',icon:'🚓',color:'#314e8b',uniform:'زي شرطة كحلي'}, it:{label:'فني IT',icon:'💻',color:'#4b8192',uniform:'قميص تقني أزرق'}, electronics:{label:'فني إلكترونيات',icon:'📱',color:'#7559a7',uniform:'زي صيانة بنفسجي'}, criminal:{label:'مشتبه به',icon:'🕶️',color:'#323b3f',uniform:'ملابس داكنة'}, delivery:{label:'مندوب توصيل',icon:'🚚',color:'#9d9852',uniform:'سترة توصيل زيتونية'}, unassigned:{label:'بانتظار التعيين',icon:'👤',color:'#66736d',uniform:'ملابس عادية'} };
const JOB_WORKFLOWS = {
  mechanic:[{title:'افحص السيارة على الرافعة',x:-59.65,z:10.15},{title:'جهّز أداة الصيانة من خزانة الورشة',x:-52.35,z:8.45},{title:'اختبر السيارة بعد الإصلاح',x:-54.35,z:10.15}],
  it:[{title:'شخّص العطل على محطة الفحص',x:51.3,z:9.2},{title:'أصلح النظام من المحطة الوسطى',x:55,z:9.2},{title:'اختبر تشغيل الحاسوب بالمحطة الأخيرة',x:58.7,z:9.2}],
  electronics:[{title:'افحص الجهاز على الطاولة الأولى',x:69.8,z:9.25},{title:'أصلح الدارة عند محطة اللحام',x:73,z:9.25},{title:'اختبر الجهاز على الطاولة الأخيرة',x:76.2,z:9.25}],
  delivery:[{title:'استلم الطرد من رصيف المستودع',x:-46.15,z:32.65},{title:'جهّز الطلب على طاولة الفرز',x:-42,z:35.15},{title:'سلّم الطلب عند نقطة التسليم',x:-21,z:20.5}],
  police:[{title:'اعترض المشتبه به واضغط E لإيقافه',x:6,z:22,dynamic:true},{title:'سجّل البلاغ عند مكتب الشرطة',x:-63,z:34}],
  criminal:[{title:'اقترب من شحنة الأجهزة وخذها',x:13,z:23.3},{title:'انقل الشحنة إلى نقطة الهروب',x:34,z:25.2}]
};
let jobWorkSession = null;
let avatarWalkPhase = 0;
let avatarActionUntil = 0;
const defaultGame = () => ({
  schemaVersion: 9, balance: 200, day: 1, gameMinutes: 8*60, storeOpen: true, storeManualOverride: null, level: 1, totalSales: 0, cart: [], cartPose: { x: 6.35, z: 4.05, rot: 0 }, vehiclePose: {x:-8,z:18.6,rot:0},
  capacity: 12, storageLevel: 0, easyStartGranted: true,
  fixtures: { shelves:{water:true,chips:false,milk:false}, register:false, computer:true, cart:false, fridges:false, itBench:false, electronics:false },
  upgrades: { topShelf: false, warehouse: false, checkout: false, expansion: false },
  inventory: {
    water: { name: 'مياه', price: 4, cost: 2, pack: 6, stock: 6, shelf: 0, shelfSlots: [], color: '#62c3f5' },
    chips: { name: 'شيبس', price: 6, cost: 3, pack: 6, stock: 0, shelf: 0, shelfSlots: [], color: '#f5ad42' },
    milk: { name: 'حليب', price: 8, cost: 4, pack: 6, stock: 0, shelf: 0, shelfSlots: [], color: '#f0eee8' }
  }
});
// New major save key + schema reset any $10,000-era test saves to the fair $100 start.
const soloStorageKey = 'alshagheel-solo-save-v9';
const soloJobStorageKey = 'alshagheel-solo-job-v1';
let gameState = defaultGame();
let currentMode = 'none'; // none | solo | multi
let roomCode = '';
let playerName = 'لاعب';
let currentJob = 'shopkeeper';
let isDriving = false;
let vehicleHolderId = null;
let vehicleEmitAt = 0;
let isRoomHost = false;
let roomHostId = null;
let roomPlayers = [];
let cameraView = 'third';
let soloGameMinuteTimer = null;
let localJobCooldown = 0;
let selfAvatar = null;
const playerPosition = new THREE.Vector3(0, 0, 4.1);
let socket = null;
let pendingRoomAction = null;
let selfPlayerId = null;
let selfVoiceReady = false;
let voiceStream = null;
let voiceMuted = false;
let voiceStates = new Map();
let peerConnections = new Map();
let remoteAvatars = new Map();
let chatMessages = [];
let lastMoveEmit = 0;
let active = false;
let paused = false;
let selectedProduct = 'water';
let nearestInteraction = null;
let heldItem = null;
let heldSource = null;
let heldSlot = null;
let playerCart = [];
let pendingPayment = null;
let cartPickedUp = false;
let cartHolderId = null;
let lastCartEmit = 0;
let lastCartPersist = 0;
let cartBlocker = null;
let heldVisual = null;
let cartCargo = null;
let cartVisuals = [];
let extraCheckoutBuilt = false;
let expansionBuilt = false;
let expansionBlockersAdded = false;
let extraShelfBuilt = false;
let toastTimer = null;
let localSalesSinceStart = 0;
const keys = Object.create(null);
const touchMove = { x: 0, y: 0 };
let joystickPointer = null;
let lookPointer = null;
let lastLookPoint = null;
let yaw = 0;
let pitch = 0;
let elapsed = 0;
let localNoticeCooldown = 0;
let lastJobGuideAt = 0;
// Keep collision storage initialized before any UI/state setup can inspect it.
const worldBlockers = [];

// -----------------------------------------------------------------------------
// Three.js world: stylized, hand-built neighborhood and supermarket.
// -----------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb8d5d5);
scene.fog = new THREE.Fog(0xb8d5d5, 58, 220);
const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.08, 280);
// Put the camera in the scene graph so first-person hands and the held product,
// parented to the camera, are included in Three.js scene traversal and actually render.
scene.add(camera);
camera.rotation.order = 'YXZ';
camera.position.set(0, 1.65, 4.1);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const hemi = new THREE.HemisphereLight(0xe7f6ff, 0x8d795f, 2.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe2b4, 3.1);
sun.position.set(-24, 34, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -72; sun.shadow.camera.right = 72; sun.shadow.camera.top = 72; sun.shadow.camera.bottom = -72;
sun.shadow.bias = -0.0003;
scene.add(sun);

const mats = {};
const nightWindowMaterials = [];
const cityPointLights = [];
const daySkyColor = new THREE.Color(0xb8d5d5);
const duskSkyColor = new THREE.Color(0xd99075);
const nightSkyColor = new THREE.Color(0x111d30);
const currentSkyColor = new THREE.Color();
const nightSunColor = new THREE.Color(0x9cadcc);
const daySunColor = new THREE.Color(0xffe2b4);
const nightGroundColor = new THREE.Color(0x1b2635);
const dayGroundColor = new THREE.Color(0x8d795f);
function mat(name, color, roughness = 0.82, extra = {}) {
  if (!mats[name]) mats[name] = new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  return mats[name];
}
function box(parent, name, x, y, z, sx, sy, sz, material, opts = {}) {
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = name || '';
  mesh.position.set(x, y, z);
  mesh.castShadow = opts.castShadow !== false;
  mesh.receiveShadow = opts.receiveShadow !== false;
  if (opts.rotation) mesh.rotation.set(...opts.rotation);
  parent.add(mesh);
  return mesh;
}
function cylinder(parent, name, x, y, z, rt, rb, h, material, segments = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segments), material);
  m.name = name || ''; m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function labelSprite(text, { color = '#edf5ee', bg = '#1f3935', fontSize = 48, width = 512, height = 128 } = {}) {
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#ffffff24'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, width - 4, height - 4);
  ctx.fillStyle = color; ctx.font = `700 ${fontSize}px "IBM Plex Sans Arabic", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, width / 2, height / 2 + 2, width - 24);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(width / height * 1.15, 1.15, 1); return sprite;
}

const world = new THREE.Group(); scene.add(world);
// Open sky-wide desert ground and distant sand mounds.
box(world, 'sand ground', 0, -0.22, 0, 230, 0.4, 230, mat('sand', '#c5b18b', 1), { castShadow: false });
for (let i = 0; i < 18; i++) {
  const x = -54 + (i % 6) * 21 + Math.sin(i * 2.1) * 4;
  const z = -38 - Math.floor(i / 6) * 20;
  const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat(`dune-${i}`, i % 3 ? '#b6a17b' : '#c7b48b', 1));
  mound.scale.set(12 + (i % 4) * 3, 3 + (i % 3), 7 + (i % 3) * 2); mound.position.set(x, -0.4, z); mound.castShadow = false; mound.receiveShadow = true; world.add(mound);
}
// Asphalt road with curb, lane paint and sidewalk.
box(world, 'road', 0, -0.02, 19.2, 190, 0.12, 8.5, mat('road', '#555d5c', 0.96), { castShadow: false });
box(world, 'walkway', 0, 0.03, 13.3, 190, 0.16, 2.4, mat('walkway', '#d2c9b5', 0.95), { castShadow: false });
box(world, 'curb', 0, 0.10, 14.45, 190, 0.21, 0.28, mat('curb', '#e1d7c3'), { castShadow: false });
for (let x = -92; x < 96; x += 9) box(world, `road marking ${x}`, x, 0.052, 19.2, 4.6, 0.015, 0.13, mat('lane paint', '#eee7d4', 0.9), { castShadow: false });
// A second avenue and two connectors open the north district for exploration.
box(world, 'north avenue', 0, -.02, 55, 190, .12, 7.2, mat('road','#555d5c',.96), {castShadow:false});
for (const x of [-73,73]) {
  box(world, `north connector ${x}`, x, -.015, 37.1, 6.2, .12, 35.8, mat('road','#555d5c',.96), {castShadow:false});
  box(world, `north connector walkway west ${x}`, x-4.2,.035,37.1,1.5,.14,35.8,mat('walkway','#d2c9b5',.95),{castShadow:false});
  box(world, `north connector walkway east ${x}`, x+4.2,.035,37.1,1.5,.14,35.8,mat('walkway','#d2c9b5',.95),{castShadow:false});
}
box(world,'north avenue sidewalk south',0,.035,49.7,190,.14,1.7,mat('walkway','#d2c9b5',.95),{castShadow:false});
box(world,'north avenue sidewalk north',0,.035,60.3,190,.14,1.7,mat('walkway','#d2c9b5',.95),{castShadow:false});
for(let x=-92;x<96;x+=12)box(world,`north road marking ${x}`,x,.052,55,5,.015,.13,mat('lane paint','#eee7d4',.9),{castShadow:false});
// Shop slab and outside facade.
box(world, 'shop outer foundation', 0, -0.02, -1.05, 17.1, 0.28, 15.8, mat('foundation', '#9b9b87'), { castShadow: false });
box(world, 'shop floor', 0, 0.13, -1.05, 16.3, 0.18, 15.1, mat('tile', '#c9c7b8', 0.7), { castShadow: false });
// subtle floor tile grid
for (let x = -7.65; x <= 7.5; x += 1.5) box(world, 'floor grout x', x, 0.227, -1.05, 0.018, 0.005, 14.7, mat('grout', '#b1b6aa', 1), { castShadow: false });
for (let z = -8.2; z <= 6.1; z += 1.5) box(world, 'floor grout z', 0, 0.228, z, 16, 0.005, 0.018, mat('grout2', '#b6b7a9', 1), { castShadow: false });
// Walls: front wall has a clear doorway in the middle.
const wall = mat('warm wall', '#e3ded0', 0.92);
const outsideWall = mat('outer wall', '#c1b39a', 0.94);
const mainBackWall = box(world, 'back wall', 0, 1.92, -8.55, 16.4, 3.55, 0.32, outsideWall);
box(world, 'left wall', -8.2, 1.92, -1.05, 0.32, 3.55, 15.3, outsideWall);
const mainRightWall = box(world, 'right wall', 8.2, 1.92, -1.05, 0.32, 3.55, 15.3, outsideWall);
box(world, 'front wall left', -4.9, 1.92, 6.45, 6.6, 3.55, 0.3, outsideWall);
box(world, 'front wall right', 4.9, 1.92, 6.45, 6.6, 3.55, 0.3, outsideWall);
box(world, 'front lintel', 0, 3.15, 6.45, 3.2, 1.1, 0.31, outsideWall);
// Front glass panels and green door frames.
box(world, 'glass left', -1.55, 1.4, 6.25, 0.08, 2.55, 0.08, mat('glassframe', '#34564e', 0.45));
box(world, 'glass right', 1.55, 1.4, 6.25, 0.08, 2.55, 0.08, mat('glassframe2', '#34564e', 0.45));
box(world, 'shop sign board', 0, 3.62, 6.25, 5.8, 0.85, 0.24, mat('signboard', '#234d41', 0.62));
const shopSign = labelSprite('دكانك الخاص · الشغيل', { bg: '#234d41', color:'#e6ffbb', fontSize: 52, width: 760, height: 130 });
shopSign.position.set(0, 3.62, 6.52); shopSign.scale.set(4.8, 0.9, 1); shopSign.userData.billboard=true; world.add(shopSign);
const ownShopSign = labelSprite('دكانك الخاص · إدارة وبيع البضاعة', { bg:'#245442ee', color:'#e6ffbb', fontSize:30, width:650, height:88 });
ownShopSign.position.set(0,2.52,7.95);ownShopSign.scale.set(3.2,.44,1);ownShopSign.userData.billboard=true;world.add(ownShopSign);
// Interior ceiling trim and lights; no full ceiling so camera can see the scene.
box(world, 'back top trim', 0, 3.68, -8.35, 16.6, 0.16, 0.48, mat('trim', '#eee7d9'));
for (const lx of [-5.5, 0, 5.5]) {
  box(world, 'light casing', lx, 3.45, -1.1, 1.1, 0.08, 0.28, mat('light casing', '#faf0d0', 0.4, { emissive: '#e5d6a3', emissiveIntensity: 0.35 }));
}
// Store fixtures start absent: bought equipment is made visible from the build catalog.
const checkoutStationGroup = new THREE.Group(); world.add(checkoutStationGroup); checkoutStationGroup.visible = false;
// Checkout counter and cash register, near the left-back side.
box(checkoutStationGroup, 'counter base', -5.45, 0.68, -5.15, 2.25, 1.2, 1.05, mat('counter', '#8f6041', 0.78));
box(checkoutStationGroup, 'counter top', -5.45, 1.33, -5.15, 2.42, 0.12, 1.15, mat('counter top', '#d7c6a8', 0.56));
box(checkoutStationGroup, 'cash register body', -5.15, 1.55, -5.22, 0.52, 0.37, 0.38, mat('register', '#263b3a', 0.45));
box(checkoutStationGroup, 'cash register screen', -5.15, 1.82, -5.35, 0.48, 0.28, 0.08, mat('register screen', '#85c4ab', 0.3, { emissive: '#3f9574', emissiveIntensity: 0.35 }), { rotation: [-0.18, 0, 0] });
box(checkoutStationGroup, 'scanner', -5.85, 1.42, -5.1, 0.26, 0.06, 0.3, mat('scanner', '#293a36', 0.4));
box(checkoutStationGroup, 'card reader base', -4.52, 1.43, -5.25, 0.36, 0.15, 0.32, mat('card terminal body', '#263d3a', 0.42));
box(checkoutStationGroup, 'card reader screen', -4.52, 1.52, -5.29, 0.28, 0.035, 0.19, mat('card terminal screen', '#6dbb9c', 0.3, { emissive: '#2e8768', emissiveIntensity: 0.22 }), { rotation: [-0.16, 0, 0] });
box(checkoutStationGroup, 'card reader chip slot', -4.52, 1.45, -5.08, 0.13, 0.012, 0.03, mat('card slot', '#141c1b', 0.5));
// The order-management desk/computer is also a purchasable fixture.
const orderDeskGroup = new THREE.Group(); world.add(orderDeskGroup); orderDeskGroup.visible = false;
box(orderDeskGroup, 'laptop desk', -5.45, 0.58, -2.3, 2.1, 1.05, 0.88, mat('desk wood', '#9b6a45', 0.8));
box(orderDeskGroup, 'laptop base', -5.45, 1.14, -2.28, 0.75, 0.05, 0.5, mat('laptop body', '#4b5d59', 0.42));
box(orderDeskGroup, 'laptop screen', -5.45, 1.4, -2.51, 0.75, 0.5, 0.07, mat('laptop display', '#30594f', 0.35, { emissive: '#1b5d4a', emissiveIntensity: 0.35 }), { rotation: [-0.15, 0, 0] });
const deskLabel = labelSprite('الطلبيات', { bg: '#3d2d22', fontSize: 42, width: 320, height: 100 }); deskLabel.position.set(-5.45, 1.92, -2.35); deskLabel.scale.set(1.1, 0.34, 1); orderDeskGroup.add(deskLabel);
const shopkeeperTaskMarker = labelSprite('مهمة صاحب الدكان', { bg: '#234d41ee', color: '#fff0bc', fontSize: 34, width: 440, height: 96 });
shopkeeperTaskMarker.position.set(-2.15, 2.05, -5.15); shopkeeperTaskMarker.scale.set(1.65, 0.36, 1); world.add(shopkeeperTaskMarker);
// Shop shelving. Product units are real scene objects tied to unique shelf slots;
// a new world starts with every slot empty.
const shelfXs = [-2.25, 0.9, 4.05];
const shelfProductByX = ['water', 'chips', 'milk'];
const shelfMaterials = {
  water: mat('water bottle', '#74c8ed', 0.24, { metalness: 0.02 }),
  chips: mat('chips bag', '#e6a14b', 0.7),
  milk: mat('milk carton', '#ede9dc', 0.65)
};
const products = [];
const productMeshesByKey = { water: [], chips: [], milk: [] };
const stockProductMeshes = { water: [], chips: [], milk: [] };
const stockStationZ = { water: 3.5, chips: 1.65, milk: -0.4 };
const SLOT_DEPTHS = [-3.25, -2.15, -1.05, 0.05, 1.15, 2.18];
const SLOT_HEIGHTS = [0.49, 1.21, 1.93];
const packageLabelTextures = {};
const packageLabelMaterials = {};
function getPackageLabelMaterial(key) {
  if (!packageLabelMaterials[key]) packageLabelMaterials[key] = new THREE.MeshStandardMaterial({ map: getPackageLabelTexture(key), roughness: 0.65, metalness: 0.01, side: THREE.DoubleSide });
  return packageLabelMaterials[key];
}
function getPackageLabelTexture(key) {
  if (packageLabelTextures[key]) return packageLabelTextures[key];
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 384;
  const ctx = canvas.getContext('2d');
  const bg = key === 'water' ? '#eaf6f8' : key === 'chips' ? '#f4bd36' : '#f0f4e9';
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 384);
  const grad = ctx.createLinearGradient(0, 0, 256, 384); grad.addColorStop(0, key === 'water' ? '#6fc9dc' : key === 'chips' ? '#df402f' : '#478b6a'); grad.addColorStop(1, key === 'water' ? '#2f809f' : key === 'chips' ? '#f08730' : '#a6c9af');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 88);
  ctx.fillStyle = '#ffffff'; ctx.font = '900 42px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(key === 'water' ? 'PURE' : key === 'chips' ? 'CRUNCH' : 'FRESH', 128, 44);
  if (key === 'water') {
    ctx.fillStyle = '#e0f6fb'; ctx.beginPath(); ctx.ellipse(128, 178, 70, 70, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#277990'; ctx.font = '900 49px Arial'; ctx.fillText('H₂O', 128, 174);
    ctx.fillStyle = '#468da0'; ctx.font = '700 16px Arial'; ctx.fillText('NATURAL WATER', 128, 224);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 290, 256, 94); ctx.fillStyle = '#4c9bae'; ctx.font = '700 17px Arial'; ctx.fillText('500 ml · STILL', 128, 337);
  } else if (key === 'chips') {
    ctx.fillStyle = '#fbe9b0'; ctx.beginPath(); ctx.ellipse(128, 180, 70, 76, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#b52e25'; ctx.font = '900 32px Arial'; ctx.fillText('POTATO', 128, 165); ctx.fillText('CHIPS', 128, 201);
    ctx.fillStyle = '#fff4cf'; ctx.font = '700 16px Arial'; ctx.fillText('SEA SALT', 128, 250);
    ctx.fillStyle = '#b52e25'; ctx.fillRect(0, 305, 256, 79); ctx.fillStyle = '#fff'; ctx.font = '700 16px Arial'; ctx.fillText('CRISPY · 45 g', 128, 344);
  } else {
    ctx.fillStyle = '#fff'; ctx.fillRect(20, 100, 216, 170); ctx.fillStyle = '#397d5b'; ctx.font = '900 32px Arial'; ctx.fillText('MILK', 128, 139);
    ctx.fillStyle = '#8bbd9a'; ctx.beginPath(); ctx.ellipse(128, 201, 42, 25, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 18px Arial'; ctx.fillText('100% FRESH', 128, 249);
    ctx.fillStyle = '#397d5b'; ctx.fillRect(0, 305, 256, 79); ctx.fillStyle = '#fff'; ctx.font = '700 18px Arial'; ctx.fillText('1 LITRE', 128, 344);
  }
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 8; ctx.strokeRect(5, 5, 246, 374);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  packageLabelTextures[key] = texture; return texture;
}
function addProductLabelPanel(group, key, x, width, height, y) {
  const material = getPackageLabelMaterial(key);
  for (const direction of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    panel.position.set(direction * x, y, 0); panel.rotation.y = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
    panel.castShadow = false; panel.receiveShadow = false; panel.frustumCulled = false; group.add(panel);
  }
}
function makeProductModel(key) {
  const g = new THREE.Group();
  if (key === 'water') {
    cylinder(g, 'bottle body', 0, 0.145, 0, 0.077, 0.079, 0.29, shelfMaterials.water, 12);
    cylinder(g, 'bottle shoulder', 0, 0.305, 0, 0.056, 0.077, 0.055, shelfMaterials.water, 12);
    cylinder(g, 'bottle neck', 0, 0.347, 0, 0.034, 0.036, 0.045, shelfMaterials.water, 10);
    cylinder(g, 'bottle cap', 0, 0.379, 0, 0.039, 0.039, 0.027, mat('bottle cap', '#e9f5fa'), 10);
    cylinder(g, 'water wrap label', 0.080, 0.155, 0, 0.080, 0.080, 0.105, mat('water label band', '#eaf6f8', 0.62), 16);
    addProductLabelPanel(g, 'water', 0.0815, 0.10, 0.105, 0.155);
  } else if (key === 'chips') {
    box(g, 'chips pouch', 0, 0.155, 0, 0.23, 0.31, 0.135, shelfMaterials.chips);
    addProductLabelPanel(g, 'chips', 0.120, 0.125, 0.235, 0.16);
    box(g, 'chips top seal', 0, 0.315, 0, 0.24, 0.025, 0.14, mat('chips seal', '#d88c38'), { castShadow: false, receiveShadow: false });
  } else {
    box(g, 'milk carton', 0, 0.17, 0, 0.205, 0.34, 0.17, shelfMaterials.milk);
    addProductLabelPanel(g, 'milk', 0.104, 0.13, 0.23, 0.17);
    cylinder(g, 'milk cap', 0, 0.355, 0, 0.034, 0.034, 0.035, mat('milk cap blue', '#5b9ca6'), 10);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function addProductSlot(key, slot, sx, parent = world) {
  const model = makeProductModel(key);
  const row = Math.floor(slot / 6), col = slot % 6;
  model.position.set(sx + (col % 2 ? 0.20 : -0.20), SLOT_HEIGHTS[row] || SLOT_HEIGHTS[2], SLOT_DEPTHS[col]);
  model.userData.productKey = key;
  model.userData.productSlot = slot;
  model.userData.baseShelfX = sx;
  parent.add(model); products.push(model); productMeshesByKey[key].push(model);
  return model;
}
const shelfRackGroups = { water: null, chips: null, milk: null };
shelfXs.forEach((sx, i) => {
  const key = shelfProductByX[i];
  const rackGroup = new THREE.Group(); rackGroup.name = `purchasable-rack-${key}`; rackGroup.visible = false; world.add(rackGroup);
  shelfRackGroups[key] = rackGroup;
  box(rackGroup, `rack ${i} base`, sx, 0.22, -0.53, 1.12, 0.12, 6.5, mat('rack base', '#52635d', 0.72));
  for (const y of [0.44, 1.16, 1.88]) box(rackGroup, `rack ${i} shelf at ${y}`, sx, y, -0.53, 1.08, 0.075, 6.35, mat('rack shelf', '#d6d0bd', 0.65));
  for (const xoff of [-0.51, 0.51]) for (const z of [-3.77, 2.71]) box(rackGroup, `rack ${i} upright`, sx + xoff, 1.53, z, 0.07, 3.0, 0.07, mat('rack metal', '#4a5b54', 0.55));
  box(rackGroup, `rack ${i} back rail`, sx, 1.43, -0.53, 0.06, 2.75, 6.32, mat('rack back', '#61716a', 0.74));
  for (let slot = 0; slot < 18; slot++) addProductSlot(key, slot, sx, rackGroup);
  const sign = labelSprite(key === 'water' ? 'مياه ومشروبات' : key === 'chips' ? 'شيبس وتسالي' : 'ألبان', { bg: '#28443b', fontSize: 38, width: 390, height: 100 });
  sign.position.set(sx, 2.95, 2.8); sign.scale.set(1.25, 0.34, 1); rackGroup.add(sign);
});

// Stock delivery crates only appear when a delivery has arrived.
const stockStationGroups = { water:null, chips:null, milk:null };
for (const key of itemKeys) {
  const stationGroup = new THREE.Group(); stationGroup.name = `delivery-${key}`; stationGroup.visible = false; world.add(stationGroup); stockStationGroups[key] = stationGroup;
  const z = stockStationZ[key];
  const crateMat = mat(`stock crate ${key}`, '#a98259', .96);
  box(stationGroup, `stock crate base ${key}`, -7.16, .16, z, 1.05, .30, .98, crateMat);
  box(stationGroup, `stock crate rim front ${key}`, -7.16, .34, z + .47, 1.05, .07, .05, mat(`stock rim ${key}`, '#c3a078', .96));
  box(stationGroup, `stock crate rim back ${key}`, -7.16, .34, z - .47, 1.05, .07, .05, mat(`stock rim back ${key}`, '#c3a078', .96));
  const stockSign = labelSprite(key === 'water' ? 'مخزون المياه' : key === 'chips' ? 'مخزون الشيبس' : 'مخزون الحليب', { bg: '#68492e', fontSize: 34, width: 380, height: 100 });
  stockSign.position.set(-7.14, .92, z - .30); stockSign.scale.set(1.0, .28, 1); stationGroup.add(stockSign);
  for (let i = 0; i < 12; i++) {
    const model = makeProductModel(key); model.scale.set(.78, .78, .78);
    model.position.set(-7.16 + ((i % 3) - 1) * .29, .32, z + (Math.floor(i / 3) - 1.5) * .22);
    model.userData.stockIndex = i; model.userData.stockProductKey = key;
    stationGroup.add(model); stockProductMeshes[key].push(model);
  }
}

// Physical shopping trolley. Products placed inside it are visible to the local player.
const shoppingCart = new THREE.Group(); world.add(shoppingCart); shoppingCart.visible = false;
const cartMetal = mat('trolley metal', '#7a8984', 0.36, { metalness: 0.62 });
const cartDark = mat('trolley plastic', '#303e3a', 0.48, { metalness: 0.18 });
box(shoppingCart, 'trolley basket floor', 0, 0.65, 0, 0.88, 0.08, 0.72, cartDark);
for (const x of [-0.43, 0.43]) for (const z of [-0.34, 0.34]) {
  box(shoppingCart, 'trolley corner', x, 0.94, z, 0.035, 0.62, 0.035, cartMetal);
}
for (const y of [0.72, 0.91, 1.1, 1.25]) {
  box(shoppingCart, 'trolley long wire near', 0, y, 0.34, 0.88, 0.025, 0.025, cartMetal);
  box(shoppingCart, 'trolley long wire far', 0, y, -0.34, 0.88, 0.025, 0.025, cartMetal);
  box(shoppingCart, 'trolley side wire left', -0.43, y, 0, 0.025, 0.025, 0.68, cartMetal);
  box(shoppingCart, 'trolley side wire right', 0.43, y, 0, 0.025, 0.025, 0.68, cartMetal);
}
for (const x of [-0.33, 0.33]) {
  box(shoppingCart, 'trolley handle neck', x, 1.15, 0.5, 0.035, 0.035, 0.42, cartMetal);
}
box(shoppingCart, 'trolley handle', 0, 1.15, 0.69, 0.76, 0.085, 0.075, cartDark);
for (const x of [-0.34, 0.34]) for (const z of [-0.25, 0.25]) cylinder(shoppingCart, 'trolley wheel', x, 0.17, z, 0.095, 0.095, 0.055, mat('wheel rubber', '#252c29', 0.95), 12).rotation.z = Math.PI / 2;
shoppingCart.position.set(6.35, 0, 4.05);
cartCargo = new THREE.Group(); shoppingCart.add(cartCargo);

// Purchasable display fridges along the back wall.
const fridgeGroup = new THREE.Group(); world.add(fridgeGroup); fridgeGroup.visible = false;
for (let i = 0; i < 3; i++) {
  const x = 0.5 + i * 2.1;
  box(fridgeGroup, 'fridge body', x, 1.25, -7.85, 1.75, 2.4, 0.65, mat('fridge body', '#b9c9c7', 0.52));
  box(fridgeGroup, 'fridge glass', x, 1.28, -7.49, 1.48, 2.05, 0.06, mat('fridge glass', '#6e9691', 0.16, { metalness: 0.08, transparent: true, opacity: 0.6 }));
  for (let yy = 0.55; yy < 2.2; yy += 0.5) box(fridgeGroup, 'fridge shelf', x, yy, -7.43, 1.42, 0.035, 0.12, mat('fridge shelves', '#e0e4d8', 0.5));
}
// Optional specialist fixtures are bought and placed by the player; they are not free at spawn.
const itBenchGroup = new THREE.Group(); world.add(itBenchGroup); itBenchGroup.visible = false;
box(itBenchGroup, 'IT workbench', 2.0, .55, -4.5, 2.1, .95, .85, mat('IT desk', '#4c5e59', .78));
box(itBenchGroup, 'IT monitor frame', 2.0, 1.28, -4.7, .9, .62, .1, mat('IT screen case', '#293a38', .52));
box(itBenchGroup, 'IT monitor display', 2.0, 1.28, -4.635, .78, .48, .018, mat('IT screen', '#4c9baf', .33, {emissive:'#1f7080', emissiveIntensity:.28}));
box(itBenchGroup, 'IT keyboard', 2.0, 1.06, -4.05, .62, .045, .22, mat('IT keyboard', '#202d2b', .65));
const electronicsBenchGroup = new THREE.Group(); world.add(electronicsBenchGroup); electronicsBenchGroup.visible = false;
box(electronicsBenchGroup, 'electronics workbench', 5.3, .55, -4.5, 2.05, .95, .85, mat('electronics desk', '#574c69', .78));
box(electronicsBenchGroup, 'electronics mat', 5.3, 1.04, -4.35, 1.15, .035, .52, mat('repair mat', '#2f4f4b', .9));
box(electronicsBenchGroup, 'tablet repair screen', 5.3, 1.14, -4.48, .72, .06, .48, mat('tablet screen', '#6aa1bd', .3, {emissive:'#245d78', emissiveIntensity:.25}));
box(electronicsBenchGroup, 'soldering station', 6.0, 1.18, -4.05, .2, .24, .2, mat('soldering station', '#303b3c', .62));
// Large, open-front workplaces with distinct interiors for every profession.
function buildJobStation(title,x,z,accent,kind) {
  const g=new THREE.Group();g.position.set(x,0,z);world.add(g);
  box(g,`${kind} forecourt`,0,.04,0,12.2,.12,9.6,mat(`${kind} forecourt`,'#a5a394',.95),{castShadow:false});
  box(g,`${kind} back wall`,0,1.95,-4.55,11.9,3.8,.24,mat(`${kind} wall`,'#b9b9a8',.9));
  box(g,`${kind} left return wall`,-5.86,1.35,-1.7,.24,2.7,5.5,mat(`${kind} wall`,'#b9b9a8',.9));
  box(g,`${kind} right return wall`,5.86,1.35,-1.7,.24,2.7,5.5,mat(`${kind} wall`,'#b9b9a8',.9));
  for(const xx of [-5.85,5.85])for(const zz of [-4.1,3.95])box(g,`${kind} structural column`,xx,1.75,zz,.28,3.5,.28,mat(`${kind} column`,accent,.55));
  box(g,`${kind} rear canopy`,0,3.72,-3.85,12.5,.18,1.55,mat(`${kind} roof`,accent,.72));
  box(g,`${kind} counter`,0,.72,-2.35,3.25,1.15,.75,mat(`${kind} counter material`,'#785d46',.86));
  const sign=labelSprite(title,{bg:accent,color:'#fff8e9',fontSize:46,width:700,height:140});sign.position.set(0,3.35,-4.32);sign.scale.set(4.55,.91,1);g.add(sign);
  const marker=labelSprite('مقر الوظيفة · ادخل وابدأ',{bg:'#172b25ee',color:'#fff0bc',fontSize:30,width:560,height:88});marker.position.set(0,2.72,3.35);marker.scale.set(2.8,.44,1);g.add(marker);
  if(kind==='mechanic') {
    for(const xx of [-2.65,2.65]) {
      box(g,'car lift base',xx,.18,.15,2.5,.22,3.15,mat('lift base','#363f3e',.65));
      for(const dx of [-.92,.92])box(g,'car lift post',xx+dx,1.05,.15,.13,1.85,.13,mat('lift post',accent,.56,{metalness:.25}));
      box(g,'repair vehicle body',xx,.72,.15,1.8,.42,2.65,mat(`repair car ${xx}`,'#778781',.46,{metalness:.18}));
      box(g,'repair vehicle roof',xx,.99,.15,1.1,.25,1.25,mat(`repair roof ${xx}`,'#3a5552',.4));
    }
    box(g,'tool cabinet',4.65,.75,-1.55,.65,1.45,.75,mat('tool cabinet','#36423e',.75));
    for(let i=0;i<4;i++)box(g,'tool drawers',4.65,.28+i*.29,-1.14,.67,.07,.05,mat('tool drawer','#b6a17b',.7,{metalness:.2}));
    box(g,'tire stack',-4.6,.45,-1.8,.62,.8,.62,mat('workshop tires','#292f2e',.95));
  } else if(kind==='it') {
    for(const xx of [-3.7,0,3.7]) {
      box(g,'IT workstation desk',xx,.68,-.8,2.1,.12,1.0,mat('IT station desk','#4c5e59',.78));
      box(g,'IT screen back',xx,1.18,-1.0,.72,.56,.09,mat('IT station screen','#283c40',.45));
      box(g,'IT screen display',xx,1.19,-.94,.62,.42,.025,mat('IT station display','#4e95a7',.34,{emissive:'#256b7d',emissiveIntensity:.23}));
      box(g,'IT keyboard',xx,.78,-.35,.65,.035,.23,mat('IT keyboard','#202d2b',.65));
    }
    for(const xx of [-4.45,-3.55]) {
      box(g,'server rack',xx,1.45,-3.25,.7,2.65,.9,mat('IT server rack','#273538',.6,{metalness:.22}));
      for(let k=0;k<4;k++)box(g,'server status panel',xx,.55+k*.55,-2.78,.48,.12,.025,mat('server status','#5ab2a0',.3,{emissive:'#2d8776',emissiveIntensity:.38}));
    }
  } else if(kind==='electronics') {
    for(const xx of [-3.2,0,3.2]) {
      box(g,'electronics workbench',xx,.62,-.75,2.5,.12,1.15,mat('electronics desk','#574c69',.78));
      box(g,'electronics mat',xx,.71,-.5,1.4,.025,.6,mat('electronics mat','#2f4f4b',.9));
      box(g,'device under repair',xx,.84,-.66,.72,.07,.45,mat('tablet screen','#6aa1bd',.3,{emissive:'#245d78',emissiveIntensity:.18}));
      box(g,'soldering station',xx+.82,.91,-.95,.22,.25,.22,mat('soldering station','#303b3c',.62));
    }
    for(let i=0;i<4;i++)box(g,'device display',-4.8+i*.68,1.05,-3.6,.42,.42,.17,mat(`device display ${i}`,['#7e9da5','#8c80a7','#a5a17d','#5e9290'][i],.38));
  } else if(kind==='police') {
    box(g,'police service desk',0,.78,-2.45,4.25,1.25,.85,mat('police desk','#314b66',.72));
    box(g,'police desk front badge',0,.82,-1.99,.85,.42,.035,mat('police desk badge','#e2d7b6',.45,{metalness:.24}));
    box(g,'police computer',-.95,1.48,-2.58,.65,.48,.08,mat('police computer','#26383e',.4));
    box(g,'police evidence board',0,2.25,-4.39,3.2,1.25,.045,mat('police noticeboard','#adbdac',.9));
    for(let i=0;i<3;i++)box(g,'police notice',-1+i*.95,2.25,-4.34,.62,.75,.02,mat(`police paper ${i}`,'#eee5ce',.95));
    for(const cx of [-3.75,3.75]) {
      box(g,'police holding cell back',cx,1.1,-3.45,2.35,2.1,.1,mat('cell wall','#8a9999',.72));
      for(const bx of [-1,-.5,0,.5,1])cylinder(g,'holding cell bars',cx+bx,1.05,-2.78,.035,.035,2.05,mat('steel bars','#9da8a9',.35,{metalness:.65}),8);
      box(g,'holding cell top rail',cx,2.08,-2.78,2.2,.08,.08,mat('steel bars','#9da8a9',.35,{metalness:.65}));
    }
    box(g,'police blue stripe',0,2.9,-4.39,8.7,.16,.08,mat('police stripe','#d6c17d',.55));
    box(g,'police emblem',4.8,2.35,-4.37,.5,.55,.08,mat('station badge','#d7c079',.46,{metalness:.35}));
    box(g,'police bench',-4.2,.42,1.25,2.2,.15,.48,mat('police bench','#314b66',.7));
  } else if(kind==='delivery') {
    for(let i=0;i<4;i++)for(let j=0;j<2;j++)box(g,'delivery pallet crate',-4.15+i*2.55,.46+j*.88,-1.35,.92,.78,.88,mat(`delivery crate ${i}-${j}`,'#a77e50',.96));
    box(g,'delivery sorting table',0,.7,1.15,3.4,.12,1.2,mat('delivery table','#6b5840',.9));
    for(let i=0;i<3;i++)box(g,'delivery parcel',-.9+i*.9,.95,1.15,.62,.42,.62,mat(`delivery parcel ${i}`,'#c3a078',.96));
  }
  return g;
}
const mechanicStation=buildJobStation('ورشة الميكانيك',-57,10,'#bf7e3d','mechanic');
const itStation=buildJobStation('مركز تقنية المعلومات',55,10,'#3c7f91','it');
const electronicsStation=buildJobStation('مركز الإلكترونيات',73,10,'#7559a7','electronics');
const policeStation=buildJobStation('مركز الشرطة',-63,34,'#304d7d','police');
const deliveryStation=buildJobStation('مستودع التوصيل',-42,34,'#8d8e47','delivery');
const deliveryDropoff = new THREE.Group();deliveryDropoff.name='delivery-dropoff';world.add(deliveryDropoff);
box(deliveryDropoff,'delivery dropoff platform',-21,.13,20.5,3.2,.25,2.2,mat('delivery dropoff wood','#80664b',.93));
box(deliveryDropoff,'delivery dropoff parcel',-21,.65,20.5,.72,.78,.72,mat('delivery dropoff parcel','#c4a173',.95));
box(deliveryDropoff,'delivery dropoff tape',-21,.65,20.13,.75,.045,.04,mat('delivery dropoff tape','#e8d9ad',.8));
const deliveryDropoffTag=labelSprite('نقطة تسليم الطلبات',{bg:'#25654dee',color:'#f4ffd7',fontSize:31,width:450,height:88});deliveryDropoffTag.position.set(-21,2.15,20.5);deliveryDropoffTag.scale.set(2.0,.39,1);deliveryDropoffTag.userData.billboard=true;deliveryDropoff.add(deliveryDropoffTag);
const stolenGoodsCrate = new THREE.Group(); world.add(stolenGoodsCrate);
box(stolenGoodsCrate,'electronics shipment crate',13,.46,22.1,1.25,.9,.95,mat('electronics shipment crate','#ad824d',.96));
box(stolenGoodsCrate,'shipment label',13,1.0,21.6,.8,.24,.035,mat('shipment label','#e7dfc9',.86));
const shipmentTag=labelSprite('شحنة أجهزة',{bg:'#4e3f2b',color:'#fff3d9',fontSize:32,width:310,height:78}); shipmentTag.position.set(13,1.6,22.05); shipmentTag.scale.set(1.12,.28,1); shipmentTag.userData.billboard=true; stolenGoodsCrate.add(shipmentTag);
// Static station collision footprints keep the avatar out of counters and walls.
const stationBlockers = [
  [-57,10,'mechanic-station'],[55,10,'it-station'],[73,10,'electronics-station'],[-63,34,'police-station'],[-42,34,'delivery-station']
].flatMap(([x,z,id])=>[
  addBlocker(x,z-4.35,5.9,.24,`${id}-back`),addBlocker(x-5.85,z-1.65,.24,2.55,`${id}-left`),addBlocker(x+5.85,z-1.65,.24,2.55,`${id}-right`)
]);
// Open paths in front of each station are kept navigable by the small-world layout.
// Outside shop sign, short bollards and flower boxes.
for (const x of [-2.0, 2.0]) {
  cylinder(world, 'door bollard', x, 0.42, 7.35, 0.11, 0.13, 0.8, mat('bollard', '#e4c47b'), 10);
  cylinder(world, 'bollard cap', x, 0.84, 7.35, 0.12, 0.11, 0.05, mat('bollard cap', '#345c4d'), 10);
}
box(world, 'planter left', -4.7, 0.24, 7.65, 1.75, 0.5, 0.7, mat('planter', '#927b60'));
box(world, 'planter right', 4.7, 0.24, 7.65, 1.75, 0.5, 0.7, mat('planter2', '#927b60'));
for (const [x,z] of [[-5.2,7.65],[-4.65,7.5],[-4.1,7.7],[4.15,7.65],[4.7,7.5],[5.2,7.7]]) {
  const bush = new THREE.Mesh(new THREE.SphereGeometry(0.32, 9, 7), mat(`plant ${x}`, '#628967', 1)); bush.scale.set(1.2,0.7,0.85); bush.position.set(x,0.57,z); bush.castShadow=true; world.add(bush);
}
// Adjacent low-rise homes / business fronts create an explorable street.
function buildHouse(x, z, width, depth, wallColor, roofColor, type = 'home') {
  const group = new THREE.Group(); world.add(group);
  box(group, `${type} body`, x, 1.8, z, width, 3.6, depth, mat(`house wall ${wallColor}`, wallColor, 0.95));
  box(group, `${type} foundation`, x, 0.16, z, width + 0.25, 0.3, depth + 0.25, mat(`house found ${wallColor}`, '#a8a28d', 0.97));
  // Flat parapet and a front awning.
  box(group, `${type} roof rim`, x, 3.62, z, width + 0.35, 0.25, depth + 0.3, mat(`roof ${roofColor}`, roofColor, 0.88));
  const frontZ = z + depth/2 + 0.03;
  box(group, `${type} door`, x - width*0.24, 1.12, frontZ, 0.92, 2.2, 0.11, mat(`door ${x}`, '#614f3d', 0.9));
  box(group, `${type} door accent`, x - width*0.24, 1.1, frontZ + 0.07, 0.12, 0.12, 0.04, mat(`door knob ${x}`, '#d5b779', 0.34, { metalness: 0.5 }));
  const wmat = mat(`house window ${wallColor}`, '#86aaa9', 0.25, { metalness: 0.08, emissive: '#ffc86a', emissiveIntensity: 0 });
  nightWindowMaterials.push(wmat);
  for (const side of [-1,1]) {
    box(group, `${type} window`, x + side*width*0.22, 2.18, frontZ, 1.05, 0.94, 0.1, wmat);
    box(group, `${type} window vertical bar`, x + side*width*0.22, 2.18, frontZ + 0.065, 0.06, 0.95, 0.03, mat(`window bar ${x}`, '#efe5ce'));
    box(group, `${type} window horizontal bar`, x + side*width*0.22, 2.18, frontZ + 0.07, 1.05, 0.06, 0.03, mat(`window barh ${x}`, '#efe5ce'));
  }
  if (type === 'shop') {
    const names = x === -27 ? ['بقالة الحارة','#326f58'] : x === 27 ? ['ماركت الرمال','#3e7085'] : x < 0 ? ['سوق الغرب','#8a6034'] : ['سوق الشرق','#6e588d'];
    box(group, 'storefront awning', x, 2.65, frontZ + .55, width*.8, .18, 1.1, mat(`awning ${x}`, names[1]));
    box(group, 'street shop sign board', x, 3.23, frontZ + .075, width*.78, .68, .14, mat(`street shop sign ${x}`, names[1]));
    const shopNameSign = labelSprite(names[0], { bg:names[1], color:'#fff8e8', fontSize:39, width:480, height:100 });
    shopNameSign.position.set(x,3.24,frontZ+.24);shopNameSign.scale.set(Math.min(2.7,width*.29),.52,1);shopNameSign.userData.billboard=true;group.add(shopNameSign);
  }
  return group;
}
buildHouse(-15, 3, 10, 11, '#d5c6a9', '#9a8970', 'home');
buildHouse(15, 3.5, 10, 11, '#c5c9b7', '#b58c6b', 'home');
buildHouse(-27, 2, 9, 10, '#c4ae90', '#7f8171', 'shop');
buildHouse(27, 2, 9, 10, '#c7baa2', '#87765f', 'shop');
buildHouse(-15, 30, 9, 10, '#d3c7af', '#998a76', 'home');
buildHouse(15, 31, 10, 11, '#d2c6ab', '#9b7a62', 'home');
buildHouse(-90, -7, 10, 10, '#c4b394', '#8a9a85', 'shop');
buildHouse(90, -7, 10, 10, '#c7bdab', '#98836a', 'shop');
buildHouse(-90, 73, 10, 11, '#d5c6a9', '#9a8970', 'home');
buildHouse(90, 73, 10, 11, '#c5c9b7', '#b58c6b', 'home');
// Street lamps and shrubs.
for (const x of [-90,-80,-50,-40,-31,-22,-9,9,22,31,40,50,80,90]) {
  cylinder(world, 'street lamp pole', x, 2.1, 14.2, 0.045, 0.06, 4.2, mat('lamp pole', '#505b53'), 8);
  box(world, 'street lamp arm', x + (x < 0 ? .34 : -.34), 4.12, 14.2, .75, .07, .07, mat('lamp arm', '#505b53'));
  box(world, 'lamp head', x + (x < 0 ? .68 : -.68), 4.02, 14.2, .42, .16, .22, mat('lamp glow', '#f4db9d', .45, { emissive: '#edc46f', emissiveIntensity: .45 }));
  if(cityPointLights.length<3){const glow=new THREE.PointLight(0xffd28c,0,17,2);glow.position.set(x+(x<0?.68:-.68),3.82,14.2);scene.add(glow);cityPointLights.push(glow);}
}
for(const lx of [-73,73])for(const z of [27,43,57]){
  cylinder(world,'avenue lamp pole',lx,2.05,z,.045,.06,4.1,mat('lamp pole','#505b53'),8);
  box(world,'avenue lamp arm',lx+(lx<0?.3:-.3),4.02,z,.7,.07,.07,mat('lamp arm','#505b53'));
  box(world,'avenue lamp head',lx+(lx<0?.62:-.62),3.93,z,.36,.15,.2,mat('lamp glow','#f4db9d',.45,{emissive:'#edc46f',emissiveIntensity:.45}));
  if(z===43){const glow=new THREE.PointLight(0xffd28c,0,18,2);glow.position.set(lx+(lx<0?.62:-.62),3.75,z);scene.add(glow);cityPointLights.push(glow);}
}
for (let i = 0; i < 28; i++) {
  const side = i % 2 ? -1 : 1;
  const x = side * (11 + (i % 5) * 5);
  const z = 7 + Math.floor(i / 2) * 4.6 + (i % 3) * 0.65;
  const bush = new THREE.Mesh(new THREE.SphereGeometry(0.65 + (i % 3) * .12, 8, 6), mat(`street bush ${i}`, i % 2 ? '#6c8c67' : '#82976c', 1));
  bush.scale.set(1.5,.65,1); bush.position.set(x,0.35,z); bush.castShadow=true; world.add(bush);
}
// Cars are real movable scene groups. One is a police patrol car, usable by players assigned to police.
function buildCar(x,z,color,police=false) {
  const g = new THREE.Group(); world.add(g); g.position.set(x,0,z); g.userData.police = police;
  box(g,'car body',0,.62,0,3.5,.8,1.55,mat(`car ${color}`,color,.38,{metalness:.15}));
  box(g,'car roof',.05,1.19,0,1.85,.66,1.35,mat(`car roof ${color}`,color,.36,{metalness:.1}));
  box(g,'windshield',.25,1.22,-.69,1.0,.48,.035,mat('windshield', '#5f8483',.2,{metalness:.05}));
  box(g,'rear glass',-.95,1.18,-.68,.48,.4,.035,mat('rear glass','#486564',.22,{metalness:.05}));
  for (const wx of [-1.05,1.05]) for (const wz of [-.78,.78]) cylinder(g,'wheel',wx,.35,wz,.32,.32,.18,mat('tire','#292f2e',.96),12).rotation.z=Math.PI/2;
  box(g,'headlight',1.72,.64,-.45,.08,.24,.28,mat('headlight','#f1deae',.25,{emissive:'#eac984',emissiveIntensity:.3}));
  box(g,'tail light',-1.72,.62,-.45,.08,.21,.28,mat('tail light','#a73c32',.35,{emissive:'#6d1916',emissiveIntensity:.12}));
  if (police) {
    box(g,'police roof lightbar',.05,1.56,0,.76,.12,.24,mat('police bar base','#202827',.45));
    box(g,'police light red',.23,1.62,0,.27,.08,.2,mat('police red','#e84a42',.25,{emissive:'#ff1d1d',emissiveIntensity:.65}));
    box(g,'police light blue',-.15,1.62,0,.27,.08,.2,mat('police blue','#4e8dff',.25,{emissive:'#155aff',emissiveIntensity:.65}));
    box(g,'police door badge',.55,.77,-.79,.42,.24,.035,mat('police door badge','#e9e3cc',.6));
  }
  return g;
}
const patrolCar = buildCar(-54, 42, '#314b78', true);
const streetCar = buildCar(42, 21.3, '#bd875c', false);
const farStreetCar = buildCar(82, 55, '#6b8777', false);

// Upgrade visuals are real world geometry, kept hidden until purchased.
const warehouseUpgradeVisual = new THREE.Group(); world.add(warehouseUpgradeVisual);
for (let i = 0; i < 5; i++) {
  const x = -7.05 + (i % 2) * 0.68, z = -1.3 - Math.floor(i / 2) * 0.58, y = 0.42 + Math.floor(i / 3) * 0.65;
  box(warehouseUpgradeVisual, `warehouse carton ${i}`, x, y, z, 0.58, 0.55, 0.48, mat(`warehouse cardboard ${i}`, i % 2 ? '#ae875d' : '#c19a6d', 0.96));
  box(warehouseUpgradeVisual, `warehouse tape ${i}`, x, y + 0.28, z, 0.09, 0.008, 0.49, mat('warehouse tape', '#e5d0a1', 0.8), { castShadow: false });
}
warehouseUpgradeVisual.visible = false;

const extraCheckoutVisual = new THREE.Group(); world.add(extraCheckoutVisual);
box(extraCheckoutVisual, 'second checkout base', -2.2, 0.67, -5.05, 2.0, 1.16, 0.95, mat('second register base', '#8f6041', 0.78));
box(extraCheckoutVisual, 'second checkout top', -2.2, 1.3, -5.05, 2.13, 0.12, 1.03, mat('second register top', '#d7c6a8', 0.56));
box(extraCheckoutVisual, 'second register terminal', -2.2, 1.52, -5.12, 0.48, 0.33, 0.36, mat('second register terminal', '#263b3a', 0.45));
box(extraCheckoutVisual, 'second register screen', -2.2, 1.75, -5.23, 0.43, 0.23, 0.06, mat('second register display', '#85c4ab', 0.3, { emissive: '#3f9574', emissiveIntensity: 0.35 }), { rotation: [-0.18, 0, 0] });
extraCheckoutVisual.visible = false;

const expansionVisual = new THREE.Group(); world.add(expansionVisual);
box(expansionVisual, 'expansion floor', 0, 0.13, -13.6, 16.25, 0.18, 10.15, mat('expansion floor tile', '#c9c7b8', 0.7), { castShadow: false });
for (let x = -7.5; x <= 7.5; x += 1.5) box(expansionVisual, 'expansion floor grout x', x, 0.227, -13.6, 0.018, 0.005, 9.8, mat('grout', '#b1b6aa', 1), { castShadow: false });
for (let z = -18.2; z <= -9.0; z += 1.5) box(expansionVisual, 'expansion floor grout z', 0, 0.228, z, 16.0, 0.005, 0.018, mat('grout2', '#b6b7a9', 1), { castShadow: false });
box(expansionVisual, 'expansion left wall', -8.2, 1.92, -13.6, 0.32, 3.55, 10.25, outsideWall);
box(expansionVisual, 'expansion right wall', 8.2, 1.92, -13.6, 0.32, 3.55, 10.25, outsideWall);
box(expansionVisual, 'expansion back wall', 0, 1.92, -18.66, 16.4, 3.55, 0.32, outsideWall);
box(expansionVisual, 'expansion fascia', 0, 3.68, -18.45, 16.45, 0.16, 0.45, mat('expansion trim', '#eee7d9'));
for (const ex of [-5.2, 0, 5.2]) {
  box(expansionVisual, 'expansion display base', ex, 0.3, -13.3, 1.05, 0.12, 5.7, mat('rack base', '#52635d', 0.72));
  for (const y of [0.9, 1.65, 2.35]) box(expansionVisual, 'expansion display shelf', ex, y, -13.3, 1.02, 0.07, 5.5, mat('rack shelf', '#d6d0bd', 0.65));
  for (const z of [-15.8, -10.8]) for (const xoff of [-0.48,0.48]) box(expansionVisual, 'expansion display upright', ex + xoff, 1.55, z, 0.07, 3, 0.07, mat('rack metal', '#4a5b54', 0.55));
}
for (const lx of [-5, 0, 5]) box(expansionVisual, 'expansion ceiling lamp', lx, 3.45, -13.6, 1.1, 0.08, 0.28, mat('light casing', '#faf0d0', 0.4, { emissive: '#e5d6a3', emissiveIntensity: 0.35 }));
expansionVisual.visible = false;
function addFacialDetails(parent, skinMaterial, prefix = 'face') {
  const whites = mat(`${prefix} eye white`, '#f5eee3', 0.55);
  const iris = mat(`${prefix} iris`, '#4b3529', 0.45);
  const pupil = mat(`${prefix} pupil`, '#161a18', 0.34);
  const brow = mat(`${prefix} brow`, '#3c3028', 0.92);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skinMaterial); ear.position.set(side * 0.178, 1.51, -0.006); parent.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), whites); eye.scale.set(1.08, 0.86, 0.55); eye.position.set(side * 0.066, 1.557, -0.158); parent.add(eye);
    const irisMesh = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), iris); irisMesh.position.set(side * 0.066, 1.555, -0.176); parent.add(irisMesh);
    const pupilMesh = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 8, 6), pupil); pupilMesh.position.set(side * 0.066, 1.555, -0.185); parent.add(pupilMesh);
    const eyebrow = box(parent, `${prefix} eyebrow`, side * 0.067, 1.604, -0.157, 0.065, 0.013, 0.025, brow); eyebrow.rotation.z = side * -0.10;
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), skinMaterial); nose.scale.set(0.78, 1.05, 0.78); nose.position.set(0, 1.515, -0.19); parent.add(nose);
  const mouth = box(parent, `${prefix} mouth`, 0, 1.465, -0.171, 0.06, 0.012, 0.014, mat(`${prefix} mouth color`, '#895a4b', 0.85));
  mouth.frustumCulled = false;
}
// Ambient shoppers: faces, clothing, and hands are modelled rather than represented by floating capsules.
const npcGroups = [];
function buildNpc(x,z,shirt,phase) {
  const g = new THREE.Group(); scene.add(g);
  const shirtMat = mat(`npc shirt ${shirt}`,shirt,.88);
  const skin = mat(`npc skin ${phase}`,'#cda17f',.9);
  const pants = mat(`npc pants ${phase}`,'#34413e',.94);
  const shoeMat = mat(`npc shoe ${phase}`,'#282c2b',.95);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.235,.54,4,10),shirtMat);
  body.position.y=1.02; body.castShadow=true; g.add(body);
  const head = new THREE.Group(); head.position.set(0,1.42,0); g.add(head);
  const headShape = new THREE.Mesh(new THREE.SphereGeometry(.175,14,12),skin);
  headShape.position.y=.13; headShape.castShadow=true; head.add(headShape);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.178,12,8,0,Math.PI*2,0,Math.PI*.48),mat(`npc hair ${phase}`,'#39332c',.98));
  hair.position.set(0,.19,-.015); hair.castShadow=true; head.add(hair);
  // Face details are placed in world-root coordinates by the original helper, so preserve their existing scale and orientation.
  const whites = mat(`npc eye white ${phase}`, '#f5eee3', .55);
  const iris = mat(`npc iris ${phase}`, '#4b3529', .45);
  const pupil = mat(`npc pupil ${phase}`, '#161a18', .34);
  const brow = mat(`npc brow ${phase}`, '#3c3028', .92);
  for(const side of [-1,1]) {
    const ear=new THREE.Mesh(new THREE.SphereGeometry(.045,10,8),skin);ear.position.set(side*.178,.09,-.006);head.add(ear);
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.032,12,10),whites);eye.scale.set(1.08,.86,.55);eye.position.set(side*.066,.137,-.158);head.add(eye);
    const irisMesh=new THREE.Mesh(new THREE.SphereGeometry(.016,10,8),iris);irisMesh.position.set(side*.066,.135,-.176);head.add(irisMesh);
    const pupilMesh=new THREE.Mesh(new THREE.SphereGeometry(.0085,8,6),pupil);pupilMesh.position.set(side*.066,.135,-.185);head.add(pupilMesh);
    const eyebrow=box(head,'npc eyebrow',side*.067,.184,-.157,.065,.013,.025,brow);eyebrow.rotation.z=side*-.10;
  }
  const nose=new THREE.Mesh(new THREE.SphereGeometry(.028,10,8),skin);nose.scale.set(.78,1.05,.78);nose.position.set(0,.095,-.19);head.add(nose);
  const mouth=box(head,'npc mouth',0,.045,-.171,.06,.012,.014,mat(`npc mouth ${phase}`,'#895a4b',.85));
  const makeSegment = (parent, name, radius, cylinderLength, material) => {
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius,cylinderLength,4,8),material);
    mesh.position.y=-(cylinderLength/2+radius); mesh.castShadow=true; mesh.name=name; parent.add(mesh); return mesh;
  };
  const npcArms=[], npcLegs=[];
  for (const side of [-1,1]) {
    const shoulder=new THREE.Group(); shoulder.position.set(side*.22,1.23,0); g.add(shoulder);
    makeSegment(shoulder,'npc upper arm',.07,.15,shirtMat);
    const elbow=new THREE.Group(); elbow.position.y=-.29; shoulder.add(elbow);
    makeSegment(elbow,'npc forearm',.06,.14,shirtMat);
    const hand=new THREE.Mesh(new THREE.SphereGeometry(.06,10,8),skin); hand.position.set(0,-.255,-.012); hand.castShadow=true; elbow.add(hand);
    npcArms.push({shoulder,elbow,side});
    const hip=new THREE.Group(); hip.position.set(side*.105,.62,0); g.add(hip);
    makeSegment(hip,'npc thigh',.085,.12,pants);
    const knee=new THREE.Group(); knee.position.y=-.29; hip.add(knee);
    makeSegment(knee,'npc shin',.073,.12,pants);
    const shoe=box(knee,'npc shoe',0,-.255,-.045,.15,.12,.27,shoeMat); shoe.castShadow=true;
    npcLegs.push({hip,knee,side});
  }
  g.position.set(x,0,z);
  const zone = z > 15
    ? { minX:1.5,maxX:10.25,minZ:18.2,maxZ:26.0,step:.72 }
    : { minX:-6.9,maxX:6.9,minZ:-7.2,maxZ:13.0,step:.72 };
  g.userData={phase,originX:x,originZ:z,targetX:x,targetZ:z,wait:.45+Math.random()*1.1,walkPhase:phase,npcArms,npcLegs,body,head,zone,path:[],pathIndex:0,behavior:z>15?'suspect':'shopper',customerState:'waiting',customerTimer:1.5+Math.random()*2.4,customerProductKey:null,customerProductVisual:null,customerDoorX:x<0?-.75:.8};
  if(z<15){const badge=labelSprite('زبون',{bg:'#294e3d',color:'#fff3d3',fontSize:32,width:220,height:76});badge.position.set(0,2.7,0);badge.scale.set(.78,.27,1);badge.userData.billboard=true;g.add(badge);g.userData.customerBadge=badge;}
  npcGroups.push(g); return g;
}
buildNpc(-0.75, 10.2, '#8eaf9d', 0.5); buildNpc(0.8, 10.65, '#d4a06f', 2.3);
const robberNpc = buildNpc(6, 22, '#30343a', 9.3);
robberNpc.userData.isRobber = true;
robberNpc.userData.originX = 6; robberNpc.userData.originZ = 22;
const robberTag = labelSprite('مشتبه به', { bg:'#6c2929ee', color:'#fff4e9', fontSize:34, width:340, height:85 });
robberTag.position.set(0, 2.12, 0); robberTag.scale.set(.98, .25, 1); robberTag.userData.billboard = true; robberNpc.add(robberTag);
// Residents and pedestrians populate the expanded neighborhood and north avenue.
function buildResident(x,z,shirt,phase,zone) {
  const g=buildNpc(x,z,shirt,phase);g.userData.behavior='resident';g.userData.zone={...zone,step:.9};g.userData.wait=.2+Math.random()*1.2;g.userData.customerState=null;
  if(g.userData.customerBadge){g.remove(g.userData.customerBadge);g.userData.customerBadge=null;}
  const tag=labelSprite('من أهل الحي',{bg:'#344955dd',color:'#fff3d8',fontSize:27,width:300,height:75});tag.position.set(0,2.7,0);tag.scale.set(1.05,.26,1);tag.userData.billboard=true;g.add(tag);g.userData.residentBadge=tag;return g;
}
const residentColors=['#8eaf9d','#d4a06f','#7997bd','#b38ca9','#c9bd83','#7eaaa9','#b77d6a','#a0a4b3','#d2a979','#6f9882'];
const residentSeeds=[
  [-90,11.1,{minX:-96,maxX:-76,minZ:9.5,maxZ:13.4}],[-83,12.1,{minX:-96,maxX:-76,minZ:9.5,maxZ:13.4}],
  [-43,11.1,{minX:-49,maxX:-34,minZ:9.5,maxZ:13.4}],[-37,12.1,{minX:-49,maxX:-34,minZ:9.5,maxZ:13.4}],
  [-7,11.2,{minX:-9,maxX:-4,minZ:9.5,maxZ:13.4}],[7,11.2,{minX:4,maxX:9,minZ:9.5,maxZ:13.4}],
  [39,11.1,{minX:34,maxX:49,minZ:9.5,maxZ:13.4}],[46,12.1,{minX:34,maxX:49,minZ:9.5,maxZ:13.4}],
  [88,11.1,{minX:82,maxX:97,minZ:9.5,maxZ:13.4}],
  [-90,27,{minX:-96,maxX:-72,minZ:25,maxZ:28.7}],[-80,27.8,{minX:-96,maxX:-72,minZ:25,maxZ:28.7}],
  [-31,27,{minX:-35,maxX:-22,minZ:25,maxZ:28.7}],[-24,27.8,{minX:-35,maxX:-22,minZ:25,maxZ:28.7}],
  [0,27.2,{minX:-8,maxX:8,minZ:25,maxZ:28.7}],[27,27,{minX:22,maxX:42,minZ:25,maxZ:28.7}],
  [38,27.8,{minX:22,maxX:42,minZ:25,maxZ:28.7}],[55,27,{minX:50,maxX:69,minZ:25,maxZ:28.7}],
  [66,27.8,{minX:50,maxX:69,minZ:25,maxZ:28.7}],[89,27.2,{minX:84,maxX:97,minZ:25,maxZ:28.7}],
  [-88,54,{minX:-96,maxX:-76,minZ:51.5,maxZ:59}],[-62,54,{minX:-68,maxX:-47,minZ:51.5,maxZ:59}],
  [48,54,{minX:45,maxX:66,minZ:51.5,maxZ:59}],[88,54,{minX:76,maxX:96,minZ:51.5,maxZ:59}]
];
residentSeeds.forEach(([x,z,zone],i)=>buildResident(x,z,residentColors[i%residentColors.length],1.7+i*1.31,zone));

// Visible staff members keep the workplaces alive even when the player chooses another job.
function buildWorkmate(x,z,shirt,phase,job,label) {
  const g=buildNpc(x,z,shirt,phase);
  g.userData.behavior='worker'; g.userData.workJob=job; g.userData.workPhase=phase;
  g.userData.zone=null; g.userData.path=[]; g.userData.pathIndex=0; g.userData.wait=0;
  if(g.userData.customerBadge){g.remove(g.userData.customerBadge);g.userData.customerBadge=null;}
  const tag=labelSprite(label,{bg:'#203c35ee',color:'#e7f7ec',fontSize:28,width:330,height:78});
  tag.position.set(0,2.68,0);tag.scale.set(1.02,.25,1);tag.userData.billboard=true;g.add(tag);
  g.rotation.y=Math.PI;
  return g;
}
buildWorkmate(-58.7,12.8,'#d18b3f',2.4,'mechanic','ميكانيكي · على رأس عمله');
buildWorkmate(53.5,12.8,'#4b8192',4.1,'it','فني حاسوب · يعمل');
buildWorkmate(71.6,12.8,'#7559a7',5.8,'electronics','فني إلكترونيات · يعمل');
buildWorkmate(-43.8,36.7,'#9d9852',7.2,'delivery','مندوب · يجهّز الطلبات');
buildWorkmate(-20.8,22.1,'#d4a06f',8.5,'delivery','نقطة استلام الطلبات');
buildWorkmate(-64.6,37.2,'#314e8b',9.5,'police','شرطي مناوب');
buildWorkmate(-27,8.8,'#326f58',10.7,'shopkeeper','بائع بقالة الحارة');
buildWorkmate(27,8.8,'#3e7085',12.1,'shopkeeper','بائع ماركت الرمال');

function makeAvatar(name, color = '#477b63', job = 'unassigned', wanted = false) {
  const g = new THREE.Group(); g.userData.job = job; g.userData.name = name; g.userData.wanted = !!wanted;
  const jobDef = JOBS[job] || JOBS.unassigned;
  color = jobDef.color || color;
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: .86 });
  const skinMat = mat('avatar skin', '#c99472', .9);
  const pantsMat = mat('avatar trousers', job === 'police' ? '#172845' : job === 'mechanic' ? '#303a3a' : '#34413e', .94);
  const shoeMat = mat('avatar boots', '#292e2d', .92);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.255,.55,4,10), bodyMat); body.position.y=.98; body.castShadow=true; g.add(body);
  const neck = cylinder(g,'avatar neck',0,1.35,0,.09,.09,.16,skinMat,10);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.19,14,12), skinMat); head.position.y=1.53; head.castShadow=true; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.195,12,8,0,Math.PI*2,0,Math.PI*.52),mat('avatar hair','#39332c',.98)); hair.position.set(0,1.6,-.012); hair.castShadow=true; g.add(hair);
  addFacialDetails(g, skinMat, 'avatar');
  const limb = (nm, a, b, radius, material) => { const va=new THREE.Vector3(...a), vb=new THREE.Vector3(...b), d=vb.clone().sub(va); const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(radius,Math.max(.04,d.length()-radius*2),4,8),material); mesh.name=nm; mesh.position.copy(va.add(vb).multiplyScalar(.5)); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); mesh.castShadow=true; g.add(mesh); return mesh; };
  const armJoints=[], legJoints=[];
  for (const side of [-1,1]) {
    const armPivot=new THREE.Group();armPivot.name=`avatar arm joint ${side}`;armPivot.position.set(side*.22,1.15,0);g.add(armPivot);
    const armMesh=new THREE.Mesh(new THREE.CapsuleGeometry(.075,.37,4,8),bodyMat);armMesh.position.set(side*.09,-.235,-.025);armMesh.castShadow=true;armPivot.add(armMesh);
    const hand=new THREE.Mesh(new THREE.SphereGeometry(.064,10,8),skinMat);hand.position.set(side*.09,-.49,-.025);hand.castShadow=true;armPivot.add(hand);armJoints.push({side,pivot:armPivot});
    const legPivot=new THREE.Group();legPivot.name=`avatar leg joint ${side}`;legPivot.position.set(side*.11,.62,0);g.add(legPivot);
    const legMesh=new THREE.Mesh(new THREE.CapsuleGeometry(.09,.295,4,8),pantsMat);legMesh.position.set(side*.01,-.235,.02);legMesh.castShadow=true;legPivot.add(legMesh);
    box(legPivot,'avatar shoe',side*.01,-.49,-.045,.17,.18,.28,shoeMat);legJoints.push({side,pivot:legPivot});
  }
  g.userData.motion={body,arms:armJoints,legs:legJoints,phase:Math.random()*Math.PI*2,walkPhase:0};
  if (job === 'police') {
    box(g,'police cap',0,1.77,-.02,.35,.12,.34,mat('police cap','#182a48',.8));
    box(g,'police badge',.10,1.07,-.238,.085,.13,.026,mat('police badge','#d7c079',.35,{metalness:.35}));
    box(g,'police shoulder stripe',-.205,1.24,-.02,.04,.25,.22,mat('police stripe','#d9c276',.55));
  } else if (job === 'mechanic') {
    box(g,'mechanic cap',0,1.77,-.02,.34,.11,.33,mat('mechanic cap','#303936',.9));
    box(g,'mechanic tool patch',.09,1.05,-.24,.10,.13,.025,mat('mechanic patch','#f0c26a',.7));
  } else if (job === 'it' || job === 'electronics') {
    box(g,'technician pocket',-.09,1.05,-.23,.15,.16,.025,mat('tech pocket',jobDef.color,.75));
    box(g,'technician badge',.13,1.15,-.225,.055,.085,.025,mat('tech badge','#dce7e6',.65));
  } else if (job === 'shopkeeper') {
    box(g,'shop apron',0,.91,-.235,.31,.49,.045,mat('shop apron','#254b3e',.9));
  }
  const tag = labelSprite(name, { bg: '#182d29ee', color: '#f1f8f2', fontSize: 42, width: 440, height: 105 });
  tag.position.y=2.39; tag.scale.set(1.22,.30,1); tag.userData.billboard = true; g.add(tag);
  const roleTag = labelSprite(`${jobDef.icon} ${jobDef.label}${wanted ? ' · مطلوب' : ''}`, { bg: wanted ? '#782f2fee' : '#203932ee', color: '#f1f8f2', fontSize: 30, width: 470, height: 86 });
  roleTag.position.y=2.06; roleTag.scale.set(1.25,.23,1); roleTag.userData.billboard = true; g.add(roleTag);
  return g;
}

// Local avatar is hidden in first-person and appears in third-person with the selected work uniform.
selfAvatar = makeAvatar(playerName, JOBS.shopkeeper.color, 'shopkeeper'); selfAvatar.visible = false; scene.add(selfAvatar);
function refreshSelfAvatar() {
  if (!selfAvatar) return;
  const oldPos = playerPosition.clone();
  scene.remove(selfAvatar); selfAvatar.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  selfAvatar = makeAvatar(playerName, (JOBS[currentJob] || JOBS.unassigned).color, currentJob);
  selfAvatar.position.copy(oldPos); selfAvatar.visible = active && cameraView === 'third'; scene.add(selfAvatar);
  updateCameraPose();
}

// Visible first-person forearms, palms and fingers; attached to the camera so the player never appears as a floating camera.
const firstPersonHands = new THREE.Group();
function addArmSegment(parent, a, b, radiusA, radiusB, material, name) {
  const va=new THREE.Vector3(...a), vb=new THREE.Vector3(...b), d=vb.clone().sub(va);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radiusA,radiusB,d.length(),12),material);
  mesh.name=name; mesh.position.copy(va.add(vb).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); mesh.castShadow=true; mesh.frustumCulled=false; parent.add(mesh); return mesh;
}
function createFirstPersonHands() {
  const sleeve = mat('first person sleeve', '#465b51', .92);
  const skin = mat('first person skin', '#c9916e', .91);
  const cuff = mat('first person cuff', '#e2dac7', .9);
  for (const side of [-1,1]) {
    const shoulder=[side*.56,-.61,-1.12], wrist=[side*.35,-.34,-.66];
    addArmSegment(firstPersonHands, shoulder, wrist, .105, .135, sleeve, 'forearm sleeve');
    const cuffMesh=box(firstPersonHands,'shirt cuff',side*.35,-.34,-.66,.16,.105,.11,cuff,{castShadow:false,receiveShadow:false});
    cuffMesh.rotation.z=side*.18;
    const palm=new THREE.Mesh(new THREE.SphereGeometry(.105,14,12),skin); palm.position.set(side*.35,-.305,-.575); palm.scale.set(1,.8,1.12); palm.frustumCulled=false; firstPersonHands.add(palm);
    for (let finger=0; finger<4; finger++) {
      const fx=side*.35 + side*(finger-1.5)*.044;
      const f=new THREE.Mesh(new THREE.CapsuleGeometry(.024,.07,3,7),skin); f.position.set(fx,-.36,-.51-Math.abs(finger-1.5)*.008); f.rotation.x=.35; f.frustumCulled=false; firstPersonHands.add(f);
    }
    const thumb=new THREE.Mesh(new THREE.CapsuleGeometry(.028,.065,3,7),skin); thumb.position.set(side*.25,-.32,-.55); thumb.rotation.z=side*.75; thumb.rotation.x=.3; thumb.frustumCulled=false; firstPersonHands.add(thumb);
  }
  camera.add(firstPersonHands);
  firstPersonHands.position.set(0,0,0);
  firstPersonHands.frustumCulled = false;
}
createFirstPersonHands();

function updateCameraPose() {
  const px = playerPosition.x, pz = playerPosition.z;
  if (selfAvatar) { selfAvatar.position.set(px, 0, pz); selfAvatar.rotation.y = yaw; selfAvatar.visible = active && cameraView === 'third' && !isDriving; }
  firstPersonHands.visible = cameraView === 'first';
  if (heldVisual) heldVisual.visible = cameraView === 'first' && !!heldItem;
  if (cameraView === 'first') {
    camera.position.set(px, (isDriving ? 1.30 : 1.65) + (isDriving ? 0 : Math.sin(elapsed) * 0.01), pz);
    camera.rotation.order = 'YXZ'; camera.rotation.set(pitch, yaw, 0, 'YXZ');
  } else {
    const back = 4.3;
    camera.position.set(px + Math.sin(yaw) * back, 2.75 + Math.max(0, pitch) * 1.2, pz + Math.cos(yaw) * back);
    const target = new THREE.Vector3(px - Math.sin(yaw) * 8, 1.25 - Math.tan(pitch) * 3.0, pz - Math.cos(yaw) * 8);
    camera.lookAt(target);
  }
}
function setCameraFromPlayer(p) {
  if (!p) return;
  playerPosition.set(Number(p.x)||0, 0, Number(p.z)||4.1);
  yaw = Number(p.rot)||0; pitch = 0;
  updateCameraPose();
}
function setCameraView(view, showToast = true) {
  cameraView = view === 'third' ? 'third' : 'first';
  $('viewLabel').textContent = cameraView === 'first' ? 'منظور أول' : 'منظور ثالث';
  $('viewToggle').classList.toggle('active', cameraView === 'third');
  updateCameraPose();
  if (showToast) toast(cameraView === 'first' ? 'منظور الشخص الأول' : 'منظور الشخص الثالث — تظهر شخصيتك واسمك والزي');
}

// -----------------------------------------------------------------------------
// UI, solo persistence, shared room events.
// -----------------------------------------------------------------------------
function toast(message, ms = 2700) {
  const el = $('toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
function setHudVisible(show) {
  ['hudTop','storePanel','chatPanel','cartPanel','hudBottom','crosshair','jobGuidePanel'].forEach(id => $(id).classList.toggle('hidden', !show));
  $('interactionPrompt').classList.add('hidden');
  const sidebarButton = $('sidebarToggle'); if (sidebarButton) sidebarButton.setAttribute('aria-expanded', String(show));
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) $('touchControls').classList.toggle('hidden', !show);
}
function normalizeGameState(state) {
  if (!state || !state.inventory || state.schemaVersion !== 9) return defaultGame();
  if (!Array.isArray(state.cart)) state.cart = [];
  if (!state.capacity) state.capacity = state.upgrades?.topShelf ? 18 : 12;
  if (!state.storageLevel) state.storageLevel = state.upgrades?.warehouse ? 1 : 0;
  state.upgrades = { topShelf: false, warehouse: false, checkout: false, expansion: false, ...(state.upgrades || {}) };
  state.fixtures = { shelves:{water:false,chips:false,milk:false}, register:false, computer:false, cart:false, fridges:false, itBench:false, electronics:false, ...(state.fixtures || {}) };
  state.fixtures.shelves = {water:false,chips:false,milk:false, ...(state.fixtures.shelves || {})};
  if (!Number.isFinite(Number(state.gameMinutes))) state.gameMinutes = 8*60;
  state.vehiclePose = {x:-54,z:42,rot:0, ...(state.vehiclePose || {})};
  if (Math.abs(Number(state.vehiclePose.x)+8)<.01 && Math.abs(Number(state.vehiclePose.z)-18.6)<.01) { state.vehiclePose.x=-54; state.vehiclePose.z=42; }
  if (!Number.isInteger(Number(state.day))) state.day = 1;
  if (typeof state.storeOpen !== 'boolean') state.storeOpen = Number(state.gameMinutes) >= 480 && Number(state.gameMinutes) < 1320;
  if (state.storeManualOverride !== null && typeof state.storeManualOverride !== 'boolean') state.storeManualOverride = null;
  for (const key of itemKeys) {
    const item = state.inventory[key];
    if (!item) continue;
    if (!Array.isArray(item.shelfSlots)) item.shelfSlots = Array.from({ length: Math.max(0, Number(item.shelf) || 0) }, (_, i) => i);
    item.shelf = item.shelfSlots.length;
    if (!Number.isFinite(Number(item.stock))) item.stock = 0;
  }
  // One-time catch-up kit makes older saved games easier without resetting progress.
  if (state.easyStartGranted !== true) {
    state.balance = Math.max(0, Number(state.balance) || 0) + 100;
    state.fixtures.computer = true;
    state.fixtures.shelves.water = true;
    const starterWater = state.inventory.water;
    if (starterWater && (Number(starterWater.stock) || 0) < 1 && (Number(starterWater.shelf) || 0) < 1) starterWater.stock = 6;
    state.easyStartGranted = true;
  }
  return state;
}
function renderHeldVisual() {
  if (!heldVisual) {
    heldVisual = new THREE.Group();
    heldVisual.frustumCulled = false;
    heldVisual.position.set(0.24, -0.39, -0.78);
    heldVisual.rotation.set(0.06, -0.12, -0.06);
    camera.add(heldVisual);
  }
  while (heldVisual.children.length) {
    const child = heldVisual.children[0]; heldVisual.remove(child);
    child.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  if (!heldItem) return;
  const item = makeProductModel(heldItem);
  item.scale.set(0.72, 0.72, 0.72);
  item.position.set(0, 0, 0);
  heldVisual.add(item);
}
function setHeldItem(key, source = null, slot = null) {
  heldItem = key || null; heldSource = key ? source : null; heldSlot = key ? slot : null;
  renderHeldVisual();
}
function cartTotal() {
  return playerCart.reduce((sum, key) => sum + Number(gameState.inventory?.[key]?.price || 0), 0);
}
function updateCartVisuals() {
  if (!cartCargo) return;
  while (cartCargo.children.length) {
    const child = cartCargo.children[0]; cartCargo.remove(child);
    child.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  cartVisuals = [];
  playerCart.slice(0, 24).forEach((key, i) => {
    const model = makeProductModel(key); model.scale.set(0.48, 0.48, 0.48);
    const col = i % 3, row = Math.floor(i / 3);
    model.position.set(-0.24 + col * 0.24, 0.72 + Math.floor(row / 3) * 0.13, -0.20 + (row % 3) * 0.20);
    cartCargo.add(model); cartVisuals.push(model);
  });
}
function updateCartUI() {
  const countEl = $('cartCount'); if (countEl) countEl.textContent = String(playerCart.length);
  const totalEl = $('cartTotal'); if (totalEl) totalEl.textContent = moneyFmt(cartTotal());
  const list = $('cartItems'); if (!list) return;
  list.innerHTML = '';
  if (!playerCart.length) {
    const empty = document.createElement('div'); empty.className = 'emptyChat'; empty.textContent = 'العربة فارغة. خذ منتجاً من الرف وضعه فيها.'; list.appendChild(empty);
  } else {
    const counts = new Map();
    for (const key of playerCart) counts.set(key, (counts.get(key) || 0) + 1);
    for (const [key, count] of counts) {
      const p = gameState.inventory[key]; if (!p) continue;
      const row = document.createElement('div'); row.className = 'cartLine';
      const swatch = document.createElement('span'); swatch.className = 'cartSwatch'; swatch.style.background = p.color || '#81998d'; swatch.textContent = key === 'water' ? '🧴' : key === 'chips' ? '🥔' : '🥛';
      const info = document.createElement('span'); info.className = 'cartLineInfo';
      const name = document.createElement('b'); name.textContent = `${p.name} × ${count}`;
      const small = document.createElement('small'); small.textContent = 'ضمن المشتريات'; info.append(name, small);
      const price = document.createElement('strong'); price.className = 'cartLinePrice'; price.textContent = moneyFmt(Number(p.price) * count);
      row.append(swatch, info, price); list.appendChild(row);
    }
  }
  updateCartVisuals();
}
function syncUpgradeVisuals(state) {
  if (!state?.upgrades) return;
  warehouseUpgradeVisual.visible = !!state.upgrades.warehouse;
  extraCheckoutVisual.visible = !!state.upgrades.checkout;
  expansionVisual.visible = !!state.upgrades.expansion;
  if (mainBackWall) mainBackWall.visible = !state.upgrades.expansion;
  if (mainBackWallBlocker) mainBackWallBlocker.active = !state.upgrades.expansion;
  if (state.upgrades.checkout && !extraCheckoutBuilt) {
    extraCheckoutBuilt = true;
    const target = { id: 'register-extra', label: 'الكاشير الإضافي — الدفع أو البيع', x: -0.86, z: -5.05, type: 'register' };
    if (!targets.some(t => t.id === target.id)) targets.push(target);
    if (worldBlockers.length) addBlocker(-2.2, -5.05, 1.12, 0.68, 'extra-checkout');
  }
  if (state.upgrades.expansion && !expansionBuilt) {
    expansionBuilt = true;
    if (worldBlockers.length) {
      addBlocker(-8.2, -13.6, 0.24, 5.15, 'expansion-left');
      addBlocker(8.2, -13.6, 0.24, 5.15, 'expansion-right');
      addBlocker(0, -18.66, 8.2, 0.24, 'expansion-back');
      for (const x of [-5.2,0,5.2]) addBlocker(x, -13.3, 0.65, 2.9, `expansion-shelf-${x}`);
      expansionBlockersAdded = true;
    }
  }
  $('upgradeShelf').disabled = !!state.upgrades.topShelf;
  $('upgradeShelf').querySelector('em').textContent = state.upgrades.topShelf ? 'مفتوح' : '$150';
  $('upgradeWarehouse').disabled = !!state.upgrades.warehouse;
  $('upgradeWarehouse').querySelector('em').textContent = state.upgrades.warehouse ? 'مكتمل' : '$80';
  $('upgradeCheckout').disabled = !!state.upgrades.checkout;
  $('upgradeCheckout').querySelector('em').textContent = state.upgrades.checkout ? 'موجود' : '$250';
  $('upgradeExpansion').disabled = !!state.upgrades.expansion;
  $('upgradeExpansion').querySelector('em').textContent = state.upgrades.expansion ? 'مكتمل' : '$500';
}
function formatGameClock(minutes = 480) {
  const m = ((Math.floor(Number(minutes) || 0) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
function updateClockUi(state = gameState) {
  const clockEl = $('clockValue');
  if (clockEl) clockEl.textContent = formatGameClock(state?.gameMinutes ?? 480);
  const hour = (((Math.floor(Number(state?.gameMinutes)||480)%1440)+1440)%1440)/60;
  const sunIcon = $('sunIcon'); if (sunIcon) sunIcon.textContent = hour >= 7 && hour < 17.5 ? '☀' : (hour >= 5 && hour < 7 || hour >= 17.5 && hour < 20.5) ? '🌇' : '☾';
  const dayEl = $('dayValue');
  if (dayEl) dayEl.textContent = String(Math.max(1, Number(state?.day) || 1)).padStart(2, '0');
  const open = !!state?.storeOpen;
  const badge = $('storeOpenBadge');
  if (badge) { badge.textContent = open ? 'مفتوح' : 'مغلق'; badge.classList.toggle('closed', !open); }
  const status = $('storeStatusValue');
  if (status) status.textContent = open ? 'الدكان مفتوح' : 'الدكان مغلق';
}
function updateStoreButtonUi(state = gameState) {
  const button = $('storeToggle');
  if (!button) return;
  const open = !!state?.storeOpen;
  button.innerHTML = `<span>${open ? '🔒' : '🔓'}</span> ${open ? 'إغلاق الدكان' : 'فتح الدكان'} <em>${open ? 'مفتوح الآن' : 'مغلق الآن'}</em>`;
  const hostCanChange = currentMode !== 'multi' || isRoomHost;
  button.disabled = !hostCanChange;
  button.title = hostCanChange ? 'تغيير حالة الدكان' : 'منشئ الغرفة فقط يستطيع فتح الدكان أو إغلاقه';
  const sched = $('scheduleStatus');
  if (sched) sched.textContent = state?.storeManualOverride === null ? 'الجدول فعّال' : 'التحكم يدوي';
  const scheduleButton = $('storeSchedule');
  if (scheduleButton) { scheduleButton.disabled = (currentMode === 'multi' && !isRoomHost) || state?.storeManualOverride === null; }
}
function renderState(state) {
  if (!state || !state.inventory) return;
  state = normalizeGameState(state);
  gameState = state;
  if (state.cartPose && !cartPickedUp) applyCartPose(state.cartPose, false);
  if (state.vehiclePose && !isDriving) applyVehiclePose(state.vehiclePose, false);
  checkoutStationGroup.visible = !!state.fixtures?.register;
  orderDeskGroup.visible = !!state.fixtures?.computer;
  fridgeGroup.visible = !!state.fixtures?.fridges;
  itBenchGroup.visible = !!state.fixtures?.itBench;
  electronicsBenchGroup.visible = !!state.fixtures?.electronics;
  shoppingCart.visible = !!state.fixtures?.cart;
  for (const key of itemKeys) {
    if (shelfRackGroups[key]) shelfRackGroups[key].visible = !!state.fixtures?.shelves?.[key];
    if (stockStationGroups[key]) stockStationGroups[key].visible = Number(state.inventory?.[key]?.stock || 0) > 0;
  }
  if (typeof fixtureBlockers !== 'undefined') {
    for (const key of itemKeys) { if (fixtureBlockers.shelves?.[key]) fixtureBlockers.shelves[key].active = !!state.fixtures?.shelves?.[key]; if (fixtureBlockers.stock?.[key]) fixtureBlockers.stock[key].active = Number(state.inventory?.[key]?.stock || 0) > 0; }
    if (fixtureBlockers.register) fixtureBlockers.register.active = !!state.fixtures?.register;
    if (fixtureBlockers.computer) fixtureBlockers.computer.active = !!state.fixtures?.computer;
    if (fixtureBlockers.fridges) fixtureBlockers.fridges.forEach(b => b.active = !!state.fixtures?.fridges);
    if (fixtureBlockers.itBench) fixtureBlockers.itBench.active = !!state.fixtures?.itBench;
    if (fixtureBlockers.electronics) fixtureBlockers.electronics.active = !!state.fixtures?.electronics;
    if (cartBlocker) cartBlocker.active = !!state.fixtures?.cart && !cartPickedUp;
  }
  // In a room the shopping trolley is shared: every player sees the same items in it.
  if (currentMode === 'multi' && Array.isArray(state.cart)) playerCart = [...state.cart];
  $('balanceValue').textContent = moneyFmt(state.balance);
  $('levelValue').textContent = `LV. ${state.level || 1}`;
  $('salesValue').textContent = moneyFmt(state.totalSales || 0);
  updateClockUi(state);
  updateStoreButtonUi(state);
  const selectedItem = state.inventory[selectedProduct] || state.inventory.water;
  const orderCost = (selectedItem.cost || 2) * (selectedItem.pack || 6);
  const orderCostEl = $('orderCost'); if (orderCostEl) orderCostEl.textContent = `${moneyFmt(orderCost)} · ${selectedItem.pack || 6} حبات`;
  const totalStock = Object.values(state.inventory).reduce((sum,p) => sum + (p.stock||0) + (p.shelf||0), 0);
  $('stockValue').textContent = `${totalStock} قطعة`;
  const list = $('inventoryList'); list.innerHTML = '';
  for (const key of itemKeys) {
    const p = state.inventory[key]; if (!p) continue;
    const row = document.createElement('button'); row.className = 'productRow' + (selectedProduct === key ? ' selected' : '');
    row.type = 'button'; row.style.outline = selectedProduct === key ? '1px solid #79c6a544' : 'none';
    const swatch = document.createElement('span'); swatch.className = 'productSwatch'; swatch.style.background = p.color || (key === 'water' ? '#62c3f5' : key === 'chips' ? '#f5ad42' : '#f0eee8');
    const info = document.createElement('span'); info.className = 'productInfo';
    const title = document.createElement('b'); title.textContent = p.name;
    const small = document.createElement('small'); small.textContent = `بيع ${moneyFmt(p.price)} · شراء ${moneyFmt(p.cost || 0)}`;
    info.append(title,small);
    const nums = document.createElement('span'); nums.className = 'stockNumbers'; nums.textContent = `${p.shelf || 0}`; const backroom = document.createElement('span'); backroom.textContent = `رف · ${p.stock || 0} مخزن`; nums.appendChild(backroom);
    row.append(swatch,info,nums);
    row.addEventListener('click', () => { selectedProduct = key; renderState(gameState); toast(`اخترت منتج ${p.name}` , 1300); });
    list.appendChild(row);
  }
  for (const mesh of products) {
    const item = state.inventory?.[mesh.userData.productKey];
    const slots = Array.isArray(item?.shelfSlots) ? item.shelfSlots : Array.from({ length: Number(item?.shelf || 0) }, (_, i) => i);
    mesh.visible = !!state.fixtures?.shelves?.[mesh.userData.productKey] && slots.includes(mesh.userData.productSlot);
  }
  for (const key of itemKeys) {
    const stockCount = Math.max(0, Number(state.inventory?.[key]?.stock) || 0);
    for (const mesh of stockProductMeshes[key] || []) mesh.visible = Number(state.inventory?.[key]?.stock || 0) > 0 && mesh.userData.stockIndex < Math.min(stockCount, stockProductMeshes[key].length);
  }
  updateClockUi(state);
  updateStoreButtonUi(state);
  syncUpgradeVisuals(state);
  updateCartUI();
  renderHeldVisual();
  if (currentMode === 'solo') {
    state.cart = [...playerCart];
    state.playerHeldItem = heldItem || null;
    state.playerHeldSource = heldSource || null;
    state.playerHeldSlot = heldSlot ?? null;
    try { localStorage.setItem(soloStorageKey, JSON.stringify(state)); } catch {}
  }
  $('syncDot').style.background = currentMode === 'multi' ? '#79c6a5' : '#e9bd75';
  $('syncDot').title = currentMode === 'multi' ? 'متزامن مع الغرفة' : 'حفظ محلي';
  updateJobGuide(state, true);
}
function enterWorld(mode) {
  currentMode = mode;
  active = true; paused = false;
  if (soloGameMinuteTimer) clearInterval(soloGameMinuteTimer);
  if (mode === 'solo') {
    soloGameMinuteTimer = setInterval(() => {
      if (!active || paused || currentMode !== 'solo') return;
      const st = normalizeGameState(gameState);
      const previous = Number(st.gameMinutes) || 480;
      st.gameMinutes = (previous + 1) % 1440;
      if (st.gameMinutes < previous) st.day = (Number(st.day) || 1) + 1;
      if (st.storeManualOverride === null) st.storeOpen = st.gameMinutes >= 480 && st.gameMinutes < 1320;
      gameState = st; updateClockUi(st); updateStoreButtonUi(st);
      if (Math.floor(st.gameMinutes) % 5 === 0) { try { localStorage.setItem(soloStorageKey, JSON.stringify(st)); } catch {} }
    }, 1000);
  }
  $('entryScreen').classList.add('hidden'); $('pauseMenu').classList.add('hidden');
  setHudVisible(true);
  $('modeLabel').textContent = mode === 'multi' ? `غرفة ${roomCode}` : 'عالم فردي محفوظ';
  $('viewLabel').textContent = cameraView === 'first' ? 'منظور أول' : 'منظور ثالث'; $('viewToggle').classList.toggle('active', cameraView === 'third');
  $('jobValue').textContent = `${(JOBS[currentJob] || JOBS.unassigned).icon} ${(JOBS[currentJob] || JOBS.unassigned).label}`;
  refreshSelfAvatar();
  if (selfAvatar) selfAvatar.visible = cameraView === 'third';
  updateStoreButtonUi(gameState); updateClockUi(gameState);
  updateCameraPose();
  $('worldLabel').textContent = mode === 'multi' ? `غرفة ${roomCode} · المدينة المفتوحة` : 'حيّ الرمال · المدينة المفتوحة';
  updateJobGuide(gameState, true);
  $('chatPanel').classList.toggle('mobileHidden', true);
  $('chatPanel').classList.toggle('hidden', true);
  $('cartPanel').classList.add('hidden');
  $('playersCount').textContent = String(mode === 'multi' ? remoteAvatars.size + 1 : 1);
  $('voiceButton').classList.toggle('disabled', mode !== 'multi');
  $('restartSoloButton').classList.toggle('hidden', mode !== 'solo');
  $('voiceLabel').textContent = mode === 'multi' ? 'تفعيل الصوت' : 'الصوت للغرف';
  $('voiceStatus').textContent = mode === 'multi' ? 'الصوت مغلق' : 'وضع فردي';
  $('voiceStatus').classList.remove('on');
  // Keep the mouse free until the player clicks the world.
  if (mode === 'solo') toast('بدأت بـ200$ ومعك رف مياه وحاسوب و6 عبوات بداية. افتح «كيف ألعب؟» لأي مساعدة.');
  renderJobAssignments();
  let tutorialSeen = false;
  try { tutorialSeen = localStorage.getItem('alshagheel-tutorial-seen-v1') === 'yes'; } catch {}
  $('tutorialModal').classList.toggle('hidden', tutorialSeen);
  if (!tutorialSeen) {
    paused = true;
    if (document.pointerLockElement === canvas) document.exitPointerLock?.();
  }
}
function resumeWorldIfNoModal() {
  const overlayIds=['tutorialModal','paymentModal','upgradesModal','pauseMenu','jobModal','shortcutsModal'];
  if(active&&overlayIds.every(id=>$(id)?.classList.contains('hidden')))paused=false;
}
function openShortcutsModal(){if(!active)return;paused=true;$('shortcutsModal').classList.remove('hidden');if(document.pointerLockElement===canvas)document.exitPointerLock?.();}
function closeShortcutsModal(){$('shortcutsModal').classList.add('hidden');resumeWorldIfNoModal();}
$('shortcutsToggle').addEventListener('click',openShortcutsModal);
$('shortcutsClose').addEventListener('click',closeShortcutsModal);
$('shortcutsDone').addEventListener('click',closeShortcutsModal);
function openTutorial() {
  if (!active) return;
  paused = true;
  $('tutorialModal').classList.remove('hidden');
  if (document.pointerLockElement === canvas) document.exitPointerLock?.();
}
function closeTutorial() {
  $('tutorialModal').classList.add('hidden');
  try { localStorage.setItem('alshagheel-tutorial-seen-v1', 'yes'); } catch {}
  resumeWorldIfNoModal();
}
$('tutorialStartButton').addEventListener('click', closeTutorial);
$('tutorialClose').addEventListener('click', closeTutorial);
$('helpToggle').addEventListener('click', openTutorial);
function addSystemChat(text) {
  addChatMessage({ system: true, text, time: Date.now() });
}
function addChatMessage(message) {
  chatMessages.push(message);
  if (chatMessages.length > 80) chatMessages.shift();
  const container = $('chatMessages'); container.innerHTML = '';
  if (!chatMessages.length) { container.innerHTML = '<div class="emptyChat">ابدأوا الحديث 👋</div>'; return; }
  for (const msg of chatMessages) {
    const el = document.createElement('div');
    if (msg.system) { el.className = 'chatMessage system'; el.textContent = msg.text; container.appendChild(el); continue; }
    el.className = 'chatMessage' + ((msg.id && socket && msg.id.includes(socket.id)) || msg.name === playerName ? ' self' : '');
    const name = document.createElement('div'); name.className = 'messageName'; name.textContent = msg.name || 'لاعب';
    const text = document.createElement('div'); text.className = 'messageText'; text.textContent = msg.text || '';
    const time = document.createElement('div'); time.className = 'messageTime'; time.textContent = new Date(msg.time || Date.now()).toLocaleTimeString('ar-JO', { hour:'2-digit', minute:'2-digit' });
    el.append(name,text,time); container.appendChild(el);
  }
  container.scrollTop = container.scrollHeight;
}
function refreshPlayersUi() {
  const count = remoteAvatars.size + (currentMode === 'multi' ? 1 : 0);
  $('playersCount').textContent = String(count);
  const status = [...voiceStates.entries()].filter(([id,ready]) => ready && id !== selfPlayerId).length + (selfVoiceReady ? 1 : 0);
  $('voiceStatus').textContent = status > 0 ? `الصوت جاهز · ${status}` : 'الصوت مغلق';
  $('voiceStatus').classList.toggle('on', status > 0);
}
function createRemoteAvatar(player) {
  if (!player?.id || player.id === selfPlayerId) return;
  if (remoteAvatars.has(player.id)) { updateRemoteAvatar(player); return; }
  const avatar = makeAvatar(player.name || 'لاعب', (JOBS[player.job] || JOBS.unassigned).color, player.job || 'unassigned', player.wanted);
  avatar.position.set(Number(player.x)||0,0,Number(player.z)||4.1); avatar.rotation.y = Number(player.rot)||0; avatar.visible = !player.driving; avatar.userData.driving=!!player.driving;avatar.userData.remoteMoveUntil=0;
  scene.add(avatar); remoteAvatars.set(player.id, avatar); voiceStates.set(player.id, !!player.voiceReady);
  updateRemoteHeldProduct(player.id, player.heldItem || null);
}
function updateRemoteAvatar(player) {
  if (!player?.id || player.id === selfPlayerId) return;
  let avatar = remoteAvatars.get(player.id);
  if (!avatar) { createRemoteAvatar(player); return; }
  const oldX=avatar.position.x,oldZ=avatar.position.z;
  if (Number.isFinite(Number(player.x))) avatar.position.x = Number(player.x);
  if (Number.isFinite(Number(player.z))) avatar.position.z = Number(player.z);
  if(Math.hypot(avatar.position.x-oldX,avatar.position.z-oldZ)>.01)avatar.userData.remoteMoveUntil=performance.now()+180;
  if(Object.prototype.hasOwnProperty.call(player,'driving'))avatar.userData.driving=!!player.driving;
  if ((avatar.userData.job || 'unassigned') !== (player.job || 'unassigned') || !!avatar.userData.wanted !== !!player.wanted) {
    const pos = avatar.position.clone(), rot = avatar.rotation.y; scene.remove(avatar); avatar.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    const replacement = makeAvatar(player.name || 'لاعب', (JOBS[player.job] || JOBS.unassigned).color, player.job || 'unassigned', player.wanted); replacement.position.copy(pos); replacement.rotation.y = rot; replacement.userData.remoteMoveUntil=avatar.userData.remoteMoveUntil||0;replacement.userData.driving=!!player.driving;scene.add(replacement); remoteAvatars.set(player.id, replacement); avatar = replacement;
  }
  if (Number.isFinite(Number(player.rot))) avatar.rotation.y = Number(player.rot);
  if (Object.prototype.hasOwnProperty.call(player,'driving')) avatar.visible = !player.driving;
  if (Object.prototype.hasOwnProperty.call(player, 'heldItem')) updateRemoteHeldProduct(player.id, player.heldItem || null);
  if (Object.prototype.hasOwnProperty.call(player, 'voiceReady')) voiceStates.set(player.id, !!player.voiceReady);
}
function updateRemoteHeldProduct(id, key) {
  const avatar = remoteAvatars.get(id); if (!avatar) return;
  const nextKey = key && gameState.inventory?.[key] ? key : null;
  if (avatar.userData.heldProductKey === nextKey) return;
  if (avatar.userData.heldProduct) {
    avatar.remove(avatar.userData.heldProduct);
    avatar.userData.heldProduct.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    avatar.userData.heldProduct = null;
  }
  avatar.userData.heldProductKey = nextKey;
  if (!nextKey) return;
  const model = makeProductModel(nextKey); model.scale.set(.55,.55,.55); model.position.set(.37,.69,-.1);
  avatar.add(model); avatar.userData.heldProduct = model;
}
function applyCartPose(pose, persist = false) {
  if (!pose || !shoppingCart) return;
  const x = Number(pose.x), z = Number(pose.z), rot = Number(pose.rot) || 0;
  if (!Number.isFinite(x) || !Number.isFinite(z)) return;
  shoppingCart.position.set(x, 0, z); shoppingCart.rotation.y = rot;
  if (cartBlocker) {
    const hx = .62, hz = .70;
    cartBlocker.minX = x-hx; cartBlocker.maxX = x+hx;
    cartBlocker.minZ = z-hz; cartBlocker.maxZ = z+hz;
  }
  const target = targets?.find(t => t.id === 'shopping-cart');
  if (target) { target.x = x; target.z = z; }
  gameState.cartPose = { x, z, rot };
  if (persist && currentMode === 'solo') {
    try { localStorage.setItem(soloStorageKey, JSON.stringify(gameState)); } catch {}
  }
}
function applyCartOwnership(data) {
  cartHolderId = data?.holderId || null;
  const owns = currentMode === 'solo' ? cartPickedUp : (!!selfPlayerId && cartHolderId === selfPlayerId);
  cartPickedUp = owns;
  if (cartBlocker) cartBlocker.active = !owns;
  if (data?.pose && !owns) applyCartPose(data.pose, false);
}
function removeRemoteAvatar(id) {
  const avatar = remoteAvatars.get(id); if (avatar) { scene.remove(avatar); avatar.traverse(o => { if (o.geometry) o.geometry.dispose(); }); remoteAvatars.delete(id); }
  voiceStates.delete(id);
  const rec = peerConnections.get(id);
  if (rec) { try { rec.pc.close(); } catch {} if (rec.audio) rec.audio.remove(); peerConnections.delete(id); }
  refreshPlayersUi();
}
function clearRemotePlayers() {
  for (const id of [...remoteAvatars.keys()]) removeRemoteAvatar(id);
  for (const [id,rec] of peerConnections) { try { rec.pc.close(); } catch {} if (rec.audio) rec.audio.remove(); }
  peerConnections.clear(); voiceStates.clear();
}
function appendJoinResult(result) {
  jobWorkSession=null;
  if (!result?.ok) { toast(result?.error || 'تعذّر الدخول للغرفة.'); return false; }
  roomCode = result.code;
  selfPlayerId = socket?.id || result.self?.id || null;
  roomHostId = result.hostId || null;
  isRoomHost = !!result.isHost || !!result.self?.isHost || roomHostId === selfPlayerId;
  roomPlayers = Array.isArray(result.roomPlayers) ? result.roomPlayers : [result.self, ...(result.players || [])].filter(Boolean);
  currentJob = result.self?.job || (isRoomHost ? 'shopkeeper' : 'unassigned');
  clearRemotePlayers(); chatMessages = [];
  playerCart = Array.isArray(result.state?.cart) ? [...result.state.cart] : [];
  cartHolderId = result.cartHolderId || null;
  vehicleHolderId = result.vehicleHolderId || null; isDriving = !!result.self?.driving; $('vehicleExit').classList.toggle('hidden', !isDriving);
  if (result.state?.vehiclePose) applyVehiclePose(result.state.vehiclePose, false);
  cartPickedUp = false;
  if (cartBlocker) cartBlocker.active = true;
  if (result.state?.cartPose) applyCartPose(result.state.cartPose, false);
  applyCartOwnership({ holderId: cartHolderId, pose: result.state?.cartPose });
  setHeldItem(result.self?.heldItem || null, result.self?.heldSource || null, result.self?.heldSlot ?? null);
  if (result.chat?.length) result.chat.forEach(addChatMessage);
  renderState(result.state);
  setCameraFromPlayer(result.self || { x:0,z:4.1,rot:0 });
  for (const p of (result.players || [])) createRemoteAvatar(p);
  enterWorld('multi'); refreshPlayersUi(); renderJobAssignments();
  addSystemChat(`أنت الآن في غرفة ${roomCode}. ${isRoomHost ? 'أنت منشئ الغرفة وتستطيع توزيع الوظائف وفتح/إغلاق الدكان.' : 'منشئ الغرفة يحدد وظائف اللاعبين.'}`);
  return true;
}
function updateJobGuide(state = gameState, force = false) {
  const title=$('jobGuideTitle'),text=$('jobGuideText');if(!title||!text)return;
  const now=performance.now();if(!force&&now-lastJobGuideAt<450)return;lastJobGuideAt=now;
  const job=JOBS[currentJob]||JOBS.unassigned;title.textContent=`${job.icon} ${job.label} · هدفك الآن`;
  if(currentJob==='shopkeeper') {
    const shelfReady=itemKeys.some(key=>!!state.fixtures?.shelves?.[key]);
    const anyGoods=itemKeys.some(key=>(Number(state.inventory?.[key]?.stock)||0)+(Number(state.inventory?.[key]?.shelf)||0)>0);
    if(!state.fixtures?.computer)text.textContent='افتح كتالوج التجهيزات B واشترِ حاسوب الإدارة بـ$15 قبل طلب البضاعة.';
    else if(!shelfReady)text.textContent='افتح كتالوج التجهيزات B، اختر صنفاً ثم اشترِ رفّه بـ$25. بعدها اطلب البضاعة من لوحة المتجر.';
    else if(!anyGoods)text.textContent='اختر صنفاً من القائمة ثم اضغط «شراء بضاعة للمخزن». خذ القطع من المخزن وضعها على الرف المطابق.';
    else if(!state.fixtures?.register)text.textContent='هذا دكانك الخاص. خذ عبوة من صندوق «مخزون المياه» بزر E، وضعها على رف المياه بزر E. بعد تعبئة الرف، افتح كتالوج B واشترِ الكاشير بـ$20. الزبائن لن يشتروا قبل تركيب الكاشير.';
    else if(!state.storeOpen)text.textContent='الكاشير جاهز لكن الدكان مغلق. افتحه من زر «فتح الدكان» في لوحة الإدارة ليبدأ الزبائن بالشراء.';
    else text.textContent='دكانك جاهز للبيع: خذ البضاعة من المخزون وضعها على الرف الصحيح. الزبائن يتحركون إلى الرف ويشترون تلقائياً عند وجود بضاعة وكاشير. راقب الرصيد والمخزون؛ دخل الدكان يأتي من المبيعات الفعلية.';
    return;
  }
  const flow=JOB_WORKFLOWS[currentJob];
  if(flow){
    if(!jobWorkSession&&currentJob==='police'&&!robberNpc?.visible){text.textContent='تم إيقاف المشتبه به وتسجيل البلاغ. انتظر عودته إلى الشارع ليظهر الهدف التالي.';return;}
    if(!jobWorkSession&&currentJob==='criminal'&&!stolenGoodsCrate.visible){text.textContent='أُخذت الشحنة بالفعل. انتظر وصول شحنة جديدة إلى نقطة البداية.';return;}
    const stepIndex=jobWorkSession?.job===currentJob?jobWorkSession.step:0;const step=flow[stepIndex];
    if(step){const target=targets.find(t=>t.type==='jobTask'&&t.job===currentJob&&t.stepIndex===stepIndex);const tx=currentJob==='police'&&stepIndex===0&&robberNpc?.visible?robberNpc.position.x:(target?.x??step.x);const tz=currentJob==='police'&&stepIndex===0&&robberNpc?.visible?robberNpc.position.z:(target?.z??step.z);const distance=Math.round(distanceXZ(playerPosition.x,playerPosition.z,tx,tz));text.textContent=`مهمتك ${stepIndex+1} من ${flow.length}: ${step.title}. اتبع العلامة الخضراء؛ المسافة ${distance} م، ثم اضغط E. بعد إنهاء الخطوات تستلم أجرك.`;}
    else text.textContent='اكتملت دورة العمل. تحرّك إلى مقر وظيفتك لبدء دورة جديدة.';
    return;
  }
  text.textContent='افتح قائمة الوظائف لاختيار مهنة، ثم اتبع العلامة الخضراء في العالم.';
}
function setSoloJob(job) {
  if (!JOBS[job] || job === 'unassigned') return;
  if (currentMode === 'multi') return toast('في اللعب الجماعي، منشئ الغرفة هو الذي يوزّع الوظائف.');
  currentJob = job; jobWorkSession = null;
  try { localStorage.setItem(soloJobStorageKey, job); } catch {}
  $('jobValue').textContent = `${JOBS[job].icon} ${JOBS[job].label}`;
  refreshSelfAvatar(); renderJobAssignments(); updateJobGuide(gameState, true);
  toast(`تم اختيار وظيفة ${JOBS[job].label}؛ زيّك تغيّر.`);
}
function renderJobAssignments() {
  const list = $('jobAssignments'); if (!list) return;
  list.innerHTML = '';
  const jobOptions = Object.entries(JOBS).filter(([id]) => id !== 'unassigned');
  if (currentMode !== 'multi') {
    $('jobModalHint').textContent = 'اختَر وظيفة بنفسك؛ يمكنك تبديلها لاحقاً من القائمة، ويتغير الزي حسب المهنة.';
    for (const [id, job] of jobOptions) {
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'jobOption' + (currentJob === id ? ' selected' : '');
      btn.innerHTML = `<span class="jobOptionIcon">${job.icon}</span><span class="jobOptionInfo"><b>${job.label}</b><small>${job.uniform}</small></span><span class="jobOptionCheck">${currentJob === id ? '✓' : 'اختيار'}</span>`;
      btn.addEventListener('click', () => setSoloJob(id)); list.appendChild(btn);
    }
    return;
  }
  $('jobModalHint').textContent = isRoomHost ? 'أنت منشئ الغرفة. عيّن لكل لاعب وظيفة؛ الزي والاسم فوق الشخصية يتحدّثان للجميع.' : 'منشئ الغرفة فقط يعيّن الوظائف. وظيفتك الحالية مبيّنة بالأسفل.';
  const people = roomPlayers.length ? roomPlayers : [{id:selfPlayerId,name:playerName,job:currentJob,isHost:isRoomHost}];
  for (const player of people) {
    const row = document.createElement('div'); row.className = 'jobAssignRow';
    const info = document.createElement('div'); info.className = 'jobAssignPerson';
    const icon = document.createElement('span'); icon.className = 'jobOptionIcon'; icon.textContent = player.isHost ? '👑' : '👤';
    const txt = document.createElement('span'); txt.innerHTML = `<b>${escapeUi(player.name || 'لاعب')}</b><small>${player.isHost ? 'منشئ الغرفة' : 'لاعب'} · ${(JOBS[player.job] || JOBS.unassigned).label}</small>`;
    info.append(icon, txt); row.appendChild(info);
    const select = document.createElement('select'); select.className = 'jobSelect'; select.setAttribute('aria-label', `وظيفة ${player.name || 'اللاعب'}`);
    const unassigned = document.createElement('option'); unassigned.value = 'unassigned'; unassigned.textContent = 'لم تُعيّن'; select.appendChild(unassigned);
    for (const [id, job] of jobOptions) { const opt = document.createElement('option'); opt.value = id; opt.textContent = `${job.icon} ${job.label}`; select.appendChild(opt); }
    select.value = player.job || 'unassigned';
    select.disabled = !isRoomHost;
    select.addEventListener('change', () => {
      if (!isRoomHost || !socket?.connected) return;
      socket.emit('job:assign', { playerId: player.id, job: select.value }, result => {
        if (!result?.ok) { toast(result?.error || 'تعذّر تعيين الوظيفة.'); renderJobAssignments(); return; }
        if (result.message) toast(result.message);
      });
    });
    row.appendChild(select); list.appendChild(row);
  }
  if (!isRoomHost) {
    const note = document.createElement('p'); note.className = 'jobReadonlyNote'; note.textContent = `وظيفتك: ${(JOBS[currentJob] || JOBS.unassigned).label} — اطلب من منشئ الغرفة تغييرها.`; list.appendChild(note);
  }
}
function escapeUi(value) { return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function openJobModal() { if (!active) return; paused = true; renderJobAssignments(); $('jobModal').classList.remove('hidden'); if (document.pointerLockElement === canvas) document.exitPointerLock?.(); }
function closeJobModal() { $('jobModal').classList.add('hidden'); resumeWorldIfNoModal(); }
function setStorePanelVisible(show) {
  const panel=$('storePanel'),button=$('sidebarToggle');
  panel.classList.toggle('hidden',!show);
  if(button){button.setAttribute('aria-expanded',String(!!show));button.title=show?'إغلاق الشريط الجانبي':'فتح الشريط الجانبي';button.classList.toggle('active',!!show);}
}
$('sidebarToggle').addEventListener('click',()=>setStorePanelVisible($('storePanel').classList.contains('hidden')));
$('storePanelClose').addEventListener('click',()=>setStorePanelVisible(false));
$('jobToggle').addEventListener('click', openJobModal);
$('tutorialJobButton').addEventListener('click', () => { closeTutorial(); openJobModal(); });
$('jobsPauseButton').addEventListener('click', () => { closePauseMenu(); openJobModal(); });
$('jobsClose').addEventListener('click', closeJobModal);
$('viewToggle').addEventListener('click', () => setCameraView(cameraView === 'first' ? 'third' : 'first'));
$('viewPauseButton').addEventListener('click', () => setCameraView(cameraView === 'first' ? 'third' : 'first'));
$('storeToggle').addEventListener('click', toggleStoreOpen);
$('storeSchedule').addEventListener('click', resetStoreSchedule);
$('buildButton').addEventListener('click', openUpgradesModal);
$('vehicleExit').addEventListener('click', exitVehicle);
$('buildShelf').addEventListener('click', () => { closeUpgradesModal(); performAction('build', selectedProduct, { fixtureType: 'shelf' }); });
$('buildRegister').addEventListener('click', () => { closeUpgradesModal(); performAction('build', selectedProduct, { fixtureType: 'register' }); });
$('buildComputer').addEventListener('click', () => { closeUpgradesModal(); performAction('build', selectedProduct, { fixtureType: 'computer' }); });
$('buildCart').addEventListener('click', () => { closeUpgradesModal(); performAction('build', selectedProduct, { fixtureType: 'cart' }); });
$('buildFridges').addEventListener('click', () => { closeUpgradesModal(); performAction('build', selectedProduct, { fixtureType: 'fridges' }); });
$('buildItBench').addEventListener('click', () => { closeUpgradesModal(); performAction('build', selectedProduct, { fixtureType: 'itBench' }); });
$('buildElectronics').addEventListener('click', () => { closeUpgradesModal(); performAction('build', selectedProduct, { fixtureType: 'electronics' }); });
function resetStoreSchedule() {
  if (currentMode === 'multi') {
    if (!isRoomHost) return toast('منشئ الغرفة فقط يستطيع تغيير الدوام.');
    if (!socket?.connected) return toast('الاتصال بالغرفة انقطع.');
    socket.emit('store:schedule', {}, result => { if (!result?.ok) toast(result?.error || 'تعذّر تفعيل الدوام التلقائي.'); else toast(result.message || 'عاد الدكان للعمل حسب الساعة.'); });
    return;
  }
  if (currentMode !== 'solo') return;
  gameState.storeManualOverride = null;
  gameState.storeOpen = gameState.gameMinutes >= 480 && gameState.gameMinutes < 1320;
  renderState(gameState); toast('تم تفعيل الدوام التلقائي: 08:00–22:00.');
}
function toggleStoreOpen() {
  const nextOpen = !gameState.storeOpen;
  if (currentMode === 'multi') {
    if (!isRoomHost) return toast('منشئ الغرفة فقط يستطيع فتح الدكان أو إغلاقه.');
    if (!socket?.connected) return toast('الاتصال بالغرفة انقطع.');
    socket.emit('store:toggle', { open: nextOpen }, result => { if (!result?.ok) toast(result?.error || 'تعذّر تغيير حالة الدكان.'); else if (result.message) toast(result.message); });
    return;
  }
  if (currentMode !== 'solo') return;
  gameState.storeOpen = nextOpen; gameState.storeManualOverride = nextOpen;
  renderState(gameState);
  toast(nextOpen ? 'فتحت الدكان؛ تقدر تشتغل وتبيع.' : 'أغلقت الدكان؛ البيع والطلبات متوقفة.');
}
function enterPoliceVehicle() {
  if (currentJob !== 'police') return toast('سيارة الدورية للموظف المعيّن في الشرطة.');
  if (isDriving) return toast('أنت داخل السيارة بالفعل.');
  if (distanceXZ(playerPosition.x,playerPosition.z,patrolCar.position.x,patrolCar.position.z)>4.1) return toast('اقترب من سيارة الدورية أولاً.');
  const finishEnter = pose => {
    if (pose) applyVehiclePose(pose,false);
    isDriving = true; vehicleHolderId = currentMode === 'multi' ? selfPlayerId : 'solo';
    if (policeCarBlocker) policeCarBlocker.active = false;
    playerPosition.set(patrolCar.position.x,0,patrolCar.position.z); yaw = -Math.PI/2; pitch=0;
    $('vehicleExit').classList.remove('hidden'); updateCameraPose(); toast('بدأت قيادة الدورية. WASD للحركة، Shift للتسريع، E عند الخروج من السيارة.');
  };
  if (currentMode === 'multi') {
    if (!socket?.connected) return toast('اتصال الغرفة غير متاح.');
    socket.emit('vehicle:claim', {}, result => { if (!result?.ok) return toast(result?.error || 'لا يمكن أخذ سيارة الدورية.'); vehicleHolderId = result.holderId || selfPlayerId; finishEnter(result.pose); });
  } else finishEnter({x:patrolCar.position.x,z:patrolCar.position.z,rot:patrolCar.rotation.y});
}
function exitVehicle() {
  if (!isDriving) return;
  if (currentMode === 'multi' && socket?.connected) {
    socket.emit('vehicle:release', {}, result => { if (!result?.ok) return toast(result?.error || 'تعذّر الخروج من السيارة.'); finishVehicleExit(result.pose); });
  } else finishVehicleExit({x:patrolCar.position.x,z:patrolCar.position.z,rot:patrolCar.rotation.y});
}
function finishVehicleExit(pose) {
  if (pose) applyVehiclePose(pose,false);
  isDriving = false; vehicleHolderId = null;
  playerPosition.set(patrolCar.position.x-0.15,0,patrolCar.position.z+1.45);
  if (policeCarBlocker) policeCarBlocker.active = true;
  $('vehicleExit').classList.add('hidden'); setCameraView(cameraView,false); updateCameraPose();
  if (currentMode === 'multi' && socket?.connected) socket.volatile.emit('player:move',{x:playerPosition.x,z:playerPosition.z,rot:yaw,job:currentJob,driving:false});
  if (currentMode === 'solo') { gameState.vehiclePose={x:patrolCar.position.x,z:patrolCar.position.z,rot:patrolCar.rotation.y}; try{localStorage.setItem(soloStorageKey,JSON.stringify(gameState));}catch{} }
  toast('خرجت من سيارة الدورية.');
}
function pulseJobObject(name) {
  const obj=world.getObjectByName(name);if(!obj?.material)return;
  const materials=Array.isArray(obj.material)?obj.material:[obj.material];
  const snapshot=materials.map(m=>({m,emissive:m.emissive?.getHex?.(),intensity:m.emissiveIntensity}));
  for(const item of snapshot){if(item.m.emissive)item.m.emissive.set('#8ee3ae');if('emissiveIntensity' in item.m)item.m.emissiveIntensity=Math.max(.38,Number(item.m.emissiveIntensity)||0);}
  window.setTimeout(()=>{for(const item of snapshot){if(item.m.emissive&&item.emissive!==undefined)item.m.emissive.setHex(item.emissive);if(item.intensity!==undefined)item.m.emissiveIntensity=item.intensity;}},1800);
}
function showJobWorkEffect(job,step) {
  const visuals={mechanic:['repair vehicle body','tool cabinet','repair vehicle body'],it:['IT station display','IT station keyboard','IT station display'],electronics:['device under repair','soldering station','device under repair'],delivery:['delivery pallet crate','delivery sorting table','delivery parcel'],police:['police noticeboard','police service desk'],criminal:['electronics shipment crate','shipment label']};
  const name=visuals[job]?.[step];if(name)pulseJobObject(name);
  if(job==='delivery'&&step===0){const parcel=world.getObjectByName('delivery pallet crate');if(parcel){parcel.visible=false;window.setTimeout(()=>{parcel.visible=true;},25000);}}
  if(job==='delivery'&&step===2){const parcel=deliveryDropoff.getObjectByName('delivery dropoff parcel');if(parcel){parcel.visible=false;window.setTimeout(()=>{parcel.visible=true;},25000);}}
  if(job==='criminal'&&step===0){stolenGoodsCrate.visible=false;window.setTimeout(()=>{stolenGoodsCrate.visible=true;},25000);}
}
function finishCriminalUniform() {
  if(selfAvatar){scene.remove(selfAvatar);selfAvatar.traverse(o=>{if(o.geometry)o.geometry.dispose();});}
  selfAvatar=makeAvatar(playerName,JOBS.criminal.color,'criminal',true);selfAvatar.position.copy(playerPosition);selfAvatar.visible=active&&cameraView==='third'&&!isDriving;scene.add(selfAvatar);updateCameraPose();
}
function performJobTask(job,target=nearestInteraction) {
  if(!active||!JOBS[job])return;
  if(currentJob!==job)return toast(`وظيفتك الحالية ${(JOBS[currentJob]||JOBS.unassigned).label}، وهذه المهمة لمهنة ${JOBS[job].label}.`);
  const flow=JOB_WORKFLOWS[job];if(!flow)return toast('شغل الدكان يعتمد على ترتيب البضاعة وبيعها للزبائن عند الكاشير.');
  const session=jobWorkSession?.job===job?jobWorkSession:{job,step:0};
  const stepIndex=Number(target?.stepIndex);
  if(!target||target.job!==job||stepIndex!==session.step)return toast(`الخطوة المطلوبة الآن: ${flow[session.step]?.title||'ارجع إلى مقر العمل'}.`);
  const step=flow[stepIndex];if(!step)return toast('ارجع إلى مقر العمل لبدء مهمة جديدة.');
  const tx=Number(target.x),tz=Number(target.z);
  if(!Number.isFinite(tx)||!Number.isFinite(tz)||distanceXZ(playerPosition.x,playerPosition.z,tx,tz)>3.7)return toast('اقترب من علامة المهمة الخضراء ثم اضغط E.');
  if(job==='police'&&stepIndex===0){if(!robberNpc?.visible||distanceXZ(playerPosition.x,playerPosition.z,robberNpc.position.x,robberNpc.position.z)>3.7)return toast('المشتبه به تحرّك؛ اقترب منه أولاً.');robberNpc.visible=false;window.setTimeout(()=>{if(!robberNpc.visible)robberNpc.visible=true;},45000);}
  showJobWorkEffect(job,stepIndex);avatarActionUntil=performance.now()+850;
  if(stepIndex<flow.length-1){jobWorkSession={job,step:stepIndex+1};toast(`✓ ${step.title}. الخطوة التالية: ${flow[stepIndex+1].title}`,3600);updateJobGuide(gameState,true);return;}
  const rewards={mechanic:28,it:32,electronics:30,delivery:24,police:40,criminal:25};
  const messages={mechanic:'اكتمل فحص المركبة وإصلاحها واختبارها 🔧',it:'اكتمل تشخيص الحاسوب وإصلاحه واختبار تشغيله 💻',electronics:'اكتملت صيانة الجهاز واختباره 📱',delivery:'استلمت الشحنة وجهزتها وسلّمتها بنجاح 🚚',police:'أوقفت المشتبه به وسجّلت البلاغ في المركز 🚓',criminal:'وصلت بالشحنة إلى نقطة الهروب وأصبحت مطلوباً 🕶️'};
  if(currentMode==='multi'){
    if(!socket?.connected)return toast('الاتصال بالغرفة انقطع؛ تقدم المهمة محفوظ عند آخر خطوة، أعد الاتصال ثم جرّب.');
    socket.emit('job:task',{job,stage:'complete'},result=>{
      if(!result?.ok){toast(result?.error||'تعذّر تسجيل العمل لدى الخادم.');return;}
      jobWorkSession=null;
      if(job==='criminal'){currentJob='criminal';finishCriminalUniform();$('jobValue').textContent=`${JOBS.criminal.icon} ${JOBS.criminal.label}`;}
      toast(result.message||messages[job]||'اكتمل العمل.');updateJobGuide(gameState,true);
    });
    return;
  }
  const now=Date.now();if(now-localJobCooldown<2200)return toast('انتظر قليلاً قبل بدء دورة عمل جديدة.');localJobCooldown=now;
  if(job==='criminal'){currentJob='criminal';try{localStorage.setItem(soloJobStorageKey,'criminal');}catch{}finishCriminalUniform();$('jobValue').textContent=`${JOBS.criminal.icon} ${JOBS.criminal.label}`;}
  gameState.balance=(Number(gameState.balance)||0)+(rewards[job]||20);gameState.totalSales=(Number(gameState.totalSales)||0)+(rewards[job]||20);jobWorkSession=null;
  renderState(gameState);toast(`${messages[job]||'أنجزت المهمة'} — أجرك ${moneyFmt(rewards[job]||20)} أُضيف إلى خزنة العالم.`);updateJobGuide(gameState,true);
}
function setServerStatus(message, kind = '') {
  const el = $('serverConnectionStatus');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('checking', 'success', 'error');
  if (kind) el.classList.add(kind);
}
function ensureSocket() {
  if (socket) return true;
  if (typeof window.io !== 'function') {
    const panel = $('serverConfigPanel'); if (panel) panel.open = true;
    setServerStatus('تعذّر تحميل مكتبة الاتصال Socket.IO. حدّث الصفحة وتأكد أن الاتصال بالإنترنت يعمل.', 'error');
    toast('لم يتم تحميل مكتبة الاتصال الجماعي. حدّث الصفحة ثم جرّب مجدداً.', 6500);
    return false;
  }
  const configuredUrl = String(window.MA3ASHAT_SERVER_URL || localStorage.getItem('alshagheel-server-url-v1') || '').trim();
  const host = window.location.hostname;
  const canUseSameOrigin = ['localhost', '127.0.0.1'].includes(host) || host.endsWith('.onrender.com');
  if (!configuredUrl && !canUseSameOrigin) {
    const panel = $('serverConfigPanel'); if (panel) panel.open = true;
    const field = $('serverUrlInput'); if (field) field.focus({preventScroll:true});
    setServerStatus('غير متصل: لم يتم إعداد خادم الغرف بعد. تحتاج رابط خدمة Render التي تشغّل server.js؛ رابط Netlify لا يكفي.', 'error');
    toast('الغرف غير متاحة حتى تربط خادم الجماعي. افتح إعداد اتصال اللعب الجماعي والصق رابط Render.', 7500);
    return false;
  }
  const serverUrl = (configuredUrl || window.location.origin).replace(/\/$/, '');
  socket = window.io(serverUrl, { autoConnect: false, timeout: 12000, reconnection: true, reconnectionAttempts: 3, reconnectionDelay: 1000 });
  socket.on('connect', () => { setServerStatus(`متصل بخادم الغرف: ${serverUrl}`, 'success'); runPendingRoomAction(); });
  socket.on('disconnect', reason => { if (currentMode === 'multi') setServerStatus(`انقطع اتصال الغرفة (${reason}). جرّب إعادة الاتصال.`, 'error'); });
  socket.on('connect_error', err => {
    setServerStatus(`فشل الاتصال بالخادم: ${err?.message || 'خطأ اتصال'}. تأكد من رابط Render وأن الخدمة تعمل.`, 'error');
    toast('تعذّر الاتصال بخادم الغرف. افتح الإعدادات واستخدم اختبار الاتصال للتأكد من رابط Render.', 6500);
  });
  socket.on('room:state', state => renderState(state));
  socket.on('room:player-joined', p => {
    createRemoteAvatar(p); refreshPlayersUi();
    addSystemChat(`${p.name || 'لاعب'} دخل العالم`);
  });
  socket.on('room:player-left', p => {
    removeRemoteAvatar(p.id); addSystemChat(`${p.name || 'لاعب'} خرج من العالم`);
  });
  socket.on('player:moved', p => updateRemoteAvatar(p));
  socket.on('room:player-updated', p => {
    updateRemoteAvatar(p);
    if (p?.id === selfPlayerId) {
      const nextJob=p.job||'unassigned';if(nextJob!==currentJob)jobWorkSession=null;currentJob = nextJob;
      $('jobValue').textContent = `${(JOBS[currentJob] || JOBS.unassigned).icon} ${(JOBS[currentJob] || JOBS.unassigned).label}`;
      isDriving = !!p.driving; $('vehicleExit').classList.toggle('hidden', !isDriving);
      refreshSelfAvatar();
    }
  });
  socket.on('room:players', players => {
    roomPlayers = Array.isArray(players) ? players : [];
    const me = roomPlayers.find(p => p.id === selfPlayerId);
    if (me) { const nextJob=me.job||'unassigned';if(nextJob!==currentJob)jobWorkSession=null;isRoomHost = !!me.isHost; roomHostId = roomPlayers.find(p => p.isHost)?.id || roomHostId; currentJob = nextJob; refreshSelfAvatar(); }
    renderJobAssignments(); updateStoreButtonUi(gameState);
  });
  socket.on('vehicle:state', data => {
    vehicleHolderId = data?.holderId || null;
    if (data?.pose) { gameState.vehiclePose = {...data.pose}; if (!isDriving) applyVehiclePose(data.pose, false); }
  });
  socket.on('vehicle:moved', data => {
    if (data?.pose) { gameState.vehiclePose = {...data.pose}; if (!isDriving) applyVehiclePose(data.pose, false); }
  });
  socket.on('room:clock', data => {
    if (!data) return;
    gameState.gameMinutes = Number(data.gameMinutes) || 0;
    gameState.day = Number(data.day) || gameState.day || 1;
    gameState.storeOpen = !!data.storeOpen;
    gameState.storeManualOverride = data.storeManualOverride ?? null;
    updateClockUi(gameState); updateStoreButtonUi(gameState);
  });
  socket.on('room:cart-state', data => applyCartOwnership(data));
  socket.on('cart:moved', data => {
    if (data?.pose && cartHolderId !== selfPlayerId) applyCartPose(data.pose, false);
  });
  socket.on('chat:message', msg => addChatMessage(msg));
  socket.on('room:system', data => { if (data?.text) { addSystemChat(data.text); toast(data.text); } });
  socket.on('game:notice', data => { if (data?.text) toast(`${data.actor ? data.actor + ': ' : ''}${data.text}`); });
  socket.on('voice:status', data => {
    voiceStates.set(data.id, !!data.ready); refreshPlayersUi();
    if (data.ready && selfVoiceReady && data.id !== selfPlayerId && String(selfPlayerId).localeCompare(String(data.id)) < 0) startPeerOffer(data.id);
    if (!data.ready) closePeer(data.id);
  });
  socket.on('voice:signal', async ({ from, data }) => {
    if (!from || !data) return;
    const rec = getPeer(from);
    try {
      if (data.description) {
        await rec.pc.setRemoteDescription(new RTCSessionDescription(data.description));
        for (const candidate of rec.pendingCandidates.splice(0)) await rec.pc.addIceCandidate(new RTCIceCandidate(candidate));
        if (data.description.type === 'offer') {
          const answer = await rec.pc.createAnswer(); await rec.pc.setLocalDescription(answer);
          socket.emit('voice:signal', { to: from, data: { description: rec.pc.localDescription } });
        }
      } else if (data.candidate) {
        if (rec.pc.remoteDescription) await rec.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        else rec.pendingCandidates.push(data.candidate);
      }
    } catch (err) { console.warn('Voice signaling:', err); }
  });
  return true;
}
function runPendingRoomAction() {
  if (!pendingRoomAction || !socket?.connected) return;
  const action = pendingRoomAction; pendingRoomAction = null;
  const payload = { name: playerName };
  if (action.type === 'join') payload.code = action.code;
  socket.timeout(12000).emit(action.type === 'create' ? 'room:create' : 'room:join', payload, (timeoutError, result) => {
    if (timeoutError) {
      pendingRoomAction = null;
      $('entryScreen').classList.remove('hidden');
      setServerStatus('الخادم اتصل لكن لم يرد على طلب الغرفة خلال 12 ثانية. أعد تشغيل خدمة Render وتحقق من السجلات.', 'error');
      toast('الخادم لم يرد على طلب إنشاء/دخول الغرفة. جرّب بعد التأكد من حالة Render.', 6500);
      return;
    }
    if (appendJoinResult(result)) {
      setServerStatus(`تم الاتصال بنجاح. رمز غرفتك: ${roomCode}`, 'success');
      toast(action.type === 'create' ? `غرفتك جاهزة — الرمز ${roomCode}` : `أهلاً في غرفة ${roomCode}`);
    } else {
      $('entryScreen').classList.remove('hidden');
      if (result?.error) toast(result.error, 6000);
    }
  });
}
function createMultiRoom(type) {
  playerName = $('playerName').value.trim().slice(0,18) || 'لاعب';
  const code = $('roomCodeInput').value.trim().toUpperCase();
  if (type === 'join' && code.length !== 5) { toast('رمز الغرفة يتكون من 5 أحرف أو أرقام. اطلب الرمز كاملاً من منشئ الغرفة.'); $('roomCodeInput').focus(); return; }
  if (!ensureSocket()) return;
  pendingRoomAction = { type, code };
  toast('جارٍ الاتصال بالعالم...', 3500);
  if (!socket.connected) socket.connect(); else runPendingRoomAction();
}
function startSoloWorld({ fresh = false } = {}) {
  playerName = $('playerName').value.trim().slice(0,18) || 'لاعب';
  currentJob = 'shopkeeper';
  if (fresh) { try { localStorage.removeItem(soloJobStorageKey); } catch {} }
  else { try { const savedJob = localStorage.getItem(soloJobStorageKey); if (JOBS[savedJob] && savedJob !== 'unassigned') currentJob = savedJob; } catch {} }
  isRoomHost = false; roomHostId = null; roomPlayers = [];
  try {
    if (fresh) localStorage.removeItem(soloStorageKey);
    const saved = JSON.parse(localStorage.getItem(soloStorageKey) || 'null');
    gameState = !fresh && saved?.inventory ? normalizeGameState(saved) : defaultGame();
    playerCart = !fresh && Array.isArray(gameState.cart) ? [...gameState.cart] : [];
    setHeldItem(!fresh ? (gameState.playerHeldItem || null) : null, !fresh ? (gameState.playerHeldSource || null) : null, !fresh ? (gameState.playerHeldSlot ?? null) : null);
  } catch { gameState = defaultGame(); playerCart = []; setHeldItem(null); }
  $('cartPanel').classList.add('hidden');
  clearRemotePlayers(); roomCode = ''; selfPlayerId = null; chatMessages = []; cartHolderId = 'solo'; cartPickedUp = false;
  if (cartBlocker) cartBlocker.active = true;
  renderState(gameState); setCameraFromPlayer({x:0,z:4.1,rot:0}); enterWorld('solo');
  if (fresh) toast('بدأت حياة جديدة من الصفر: 200$ وتجهيزات بداية جاهزة، بلا ديون.');
}
$('soloButton').addEventListener('click', () => startSoloWorld({ fresh: false }));
$('freshStartButton').addEventListener('click', () => startSoloWorld({ fresh: true }));
$('restartSoloButton').addEventListener('click', () => {
  if (currentMode !== 'solo') return toast('ابدأ حياة جديدة من شاشة البداية لإنشاء عالم فردي مستقل.');
  if (!window.confirm('متأكد أنك تريد حذف تقدم العالم الفردي والبدء من الصفر؟')) return;
  localStorage.removeItem(soloStorageKey); gameState = defaultGame(); playerCart = []; setHeldItem(null); cartPickedUp = false; cartHolderId = null; if (cartBlocker) cartBlocker.active = true; applyCartPose({x:6.35,z:4.05,rot:0}, false);
  closePauseMenu(); setCameraFromPlayer({x:0,z:4.1,rot:0}); renderState(gameState); toast('تمت إعادة العالم إلى 200$ مع رف المياه والحاسوب و6 عبوات.');
});
$('createButton').addEventListener('click', () => createMultiRoom('create'));
$('joinButton').addEventListener('click', () => createMultiRoom('join'));
$('roomCodeInput').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5); });
$('roomCodeInput').addEventListener('keydown', e => { if (e.key === 'Enter') createMultiRoom('join'); });
// A user may save the backend URL here after deploying the multiplayer server; no frontend redeploy is needed.
const savedServerUrl = localStorage.getItem('alshagheel-server-url-v1') || '';
$('serverUrlInput').value = String(window.MA3ASHAT_SERVER_URL || savedServerUrl || '');
$('saveServerUrlButton').addEventListener('click', () => {
  if (currentMode === 'multi' && socket?.connected) return toast('اخرج من الغرفة أولاً قبل تغيير رابط الخادم.');
  const value = $('serverUrlInput').value.trim().replace(/\/$/, '');
  if (!value) {
    localStorage.removeItem('alshagheel-server-url-v1');
    if (socket) { socket.disconnect(); socket = null; }
    toast('تم حذف رابط الخادم المحفوظ. لن يعمل الجماعي حتى تضيف رابطاً صحيحاً.');
    return;
  }
  let parsed;
  try { parsed = new URL(value); } catch { return toast('الرابط غير صحيح؛ الصق رابط Render كاملاً مع https://.'); }
  if (!['https:','http:'].includes(parsed.protocol) || (location.protocol === 'https:' && parsed.protocol !== 'https:')) return toast('استخدم رابط HTTPS لخادم الجماعي حتى يعمل من Netlify بأمان.');
  localStorage.setItem('alshagheel-server-url-v1', parsed.origin);
  if (socket) { socket.disconnect(); socket = null; }
  toast('تم حفظ رابط خادم الجماعي على هذا الجهاز. جرّب إنشاء غرفة أو دخول غرفة الآن.');
});
$('testServerButton').addEventListener('click', async () => {
  if (currentMode === 'multi' && socket?.connected) return toast('اخرج من الغرفة أولاً قبل اختبار رابط آخر.');
  const value = $('serverUrlInput').value.trim().replace(/\/$/, '');
  let parsed;
  try { parsed = new URL(value); } catch { setServerStatus('اكتب رابط الخادم كاملاً، مثل https://اسم-الخادم.onrender.com', 'error'); return; }
  if (!['https:','http:'].includes(parsed.protocol) || (location.protocol === 'https:' && parsed.protocol !== 'https:')) { setServerStatus('يجب استخدام HTTPS لأن واجهة اللعبة منشورة على HTTPS.', 'error'); return; }
  if (parsed.origin === location.origin && !['localhost','127.0.0.1'].includes(location.hostname)) { setServerStatus('هذا رابط واجهة الموقع نفسها. أدخل رابط خدمة Render التي تشغّل الخادم.', 'error'); return; }
  const button = $('testServerButton'); button.disabled = true; button.textContent = 'جارٍ اختبار الخادم…';
  setServerStatus('جارٍ الاتصال بـ /health؛ قد تحتاج خدمة Render المجانية إلى وقت لتستيقظ…', 'checking');
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 35000);
  try {
    const response = await fetch(`${parsed.origin}/health`, { method: 'GET', cache: 'no-store', headers: { 'Accept': 'application/json' }, signal: controller.signal });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.ok !== true || data.game !== 'الشغيل') {
      throw new Error('الرابط استجاب لكنه لا يبدو خادم الشغيل. تأكد أنك نشرت المشروع الكامل على Render وليس ملفات Netlify وحدها.');
    }
    localStorage.setItem('alshagheel-server-url-v1', parsed.origin);
    if (socket) { socket.disconnect(); socket = null; }
    setServerStatus(`نجح الاتصال بخادم الشغيل (${data.version || 'نسخة الخادم'}). تم حفظ الرابط على هذا الجهاز. أنشئ غرفة الآن.`, 'success');
    toast('خادم الغرف يعمل وتم حفظ الرابط. اضغط «أنشئ غرفة خاصة».', 5500);
  } catch (err) {
    const message = err?.name === 'AbortError' ? 'انتهت مهلة الاتصال. قد تكون خدمة Render نائمة؛ انتظر ثم اختبر مجدداً.' : (err?.message || 'تعذّر الوصول إلى الخادم.');
    setServerStatus(`فشل الاختبار: ${message}`, 'error'); toast(message, 6500);
  } finally { clearTimeout(timer); button.disabled = false; button.textContent = 'اختبر الاتصال واحفظ الرابط'; }
});


function openPaymentModal(type, product = selectedProduct) {
  if (!active || paused) return;
  let amount = 0;
  if (type === 'order') {
    const item = gameState.inventory[product];
    if (!item) return toast('اختر منتجاً أولاً.');
    amount = Number(item.cost || 0) * Number(item.pack || 6);
    $('paymentIcon').textContent = '📦'; $('paymentKicker').textContent = 'طلبية المورد';
    $('paymentTitle').textContent = `شراء ${item.name}`;
    $('paymentDescription').textContent = `سيضاف ${item.pack} قطع إلى مخزون المستودع. اختر طريقة الدفع.`;
  } else if (type === 'checkout') {
    if (!state.fixtures?.register) return toast('اشترِ الكاشير أولاً من كتالوج التجهيزات.');
    if (!state.storeOpen) return toast('الدكان مغلق؛ افتحه قبل المحاسبة.');
    if (!state.fixtures?.cart && playerCart.length) return toast('اشترِ عربة التسوق أولاً أو أعد المنتجات إلى الرفوف.');
    if (!playerCart.length) return toast('عربة التسوق فارغة.');
    amount = cartTotal(); $('paymentIcon').textContent = '🛒'; $('paymentKicker').textContent = 'الكاشير';
    $('paymentTitle').textContent = 'إتمام مشترياتك';
    $('paymentDescription').textContent = `عدد القطع في العربة: ${playerCart.length}. سيتم خصم المبلغ من خزنة العالم المشتركة.`;
  } else if (type === 'sale') {
    const item = gameState.inventory[product];
    if (!item || !(item.shelf > 0)) return toast('لا توجد قطعة على الرف لبيعها. اشترِ مخزوناً وأعد تعبئة الرف.');
    amount = Number(item.price || 0); $('paymentIcon').textContent = '🧾'; $('paymentKicker').textContent = 'خدمة الزبائن';
    $('paymentTitle').textContent = `محاسبة زبون · ${item.name}`;
    $('paymentDescription').textContent = `اختر كيف سيدفع الزبون. ستُضاف قيمة البيع إلى خزنة المتجر المشتركة.`;
  }
  $('paymentAmount').textContent = moneyFmt(amount);
  pendingPayment = { type, product };
  paused = true; $('paymentModal').classList.remove('hidden');
}
function closePaymentModal() {
  $('paymentModal').classList.add('hidden'); pendingPayment = null;
  resumeWorldIfNoModal();
}
function confirmPayment(method) {
  if (!pendingPayment) return;
  const pending = { ...pendingPayment }; closePaymentModal();
  if (pending.type === 'order') performAction('order', pending.product, { paymentMethod: method });
  else if (pending.type === 'checkout') performAction('checkout', null, { paymentMethod: method });
  else if (pending.type === 'sale') performAction('sell', pending.product, { paymentMethod: method });
}
$('paymentCancel').addEventListener('click', closePaymentModal);
$('payCash').addEventListener('click', () => confirmPayment('cash'));
$('payVisa').addEventListener('click', () => confirmPayment('visa'));
function openUpgradesModal() { if (!active) return; paused = true; $('upgradesModal').classList.remove('hidden'); }
function closeUpgradesModal() { $('upgradesModal').classList.add('hidden'); resumeWorldIfNoModal(); }
$('upgradesCancel').addEventListener('click', closeUpgradesModal);
$('upgradeShelf').addEventListener('click', () => { closeUpgradesModal(); performAction('upgrade', selectedProduct, { upgradeType: 'topShelf' }); });
$('upgradeWarehouse').addEventListener('click', () => { closeUpgradesModal(); performAction('upgrade', selectedProduct, { upgradeType: 'warehouse' }); });
$('upgradeCheckout').addEventListener('click', () => { closeUpgradesModal(); performAction('upgrade', selectedProduct, { upgradeType: 'checkout' }); });
$('upgradeExpansion').addEventListener('click', () => { closeUpgradesModal(); performAction('upgrade', selectedProduct, { upgradeType: 'expansion' }); });

function performAction(type, product = selectedProduct, extra = {}) {
  if (currentMode === 'multi') {
    if (!socket?.connected) return toast('الاتصال بالغرفة انقطع.');
    socket.emit('game:action', { type, product, ...extra }, result => {
      if (!result?.ok) { toast(result?.error || 'لم تتم العملية.'); return; }
      if (result.message) toast(result.message);
      if (Array.isArray(result.cart)) playerCart = [...result.cart];
      if (Object.prototype.hasOwnProperty.call(result, 'heldItem')) setHeldItem(result.heldItem, result.heldSource, result.heldSlot);
      if (result?.state) renderState(result.state);
      updateCartUI(); renderHeldVisual();
    });
    return;
  }
  if (currentMode !== 'solo') return;
  const state = normalizeGameState(JSON.parse(JSON.stringify(gameState)));
  const item = state.inventory[product];
  let message = '';
  if (type === 'build') {
    const typeKey = String(extra.fixtureType || '');
    const builds = {
      shelf: { cost:25, title:`رف ${item?.name || ''}`, done:!!state.fixtures?.shelves?.[product] },
      register: { cost:20, title:'الكاشير', done:!!state.fixtures?.register },
      computer: { cost:15, title:'حاسوب إدارة الدكان', done:!!state.fixtures?.computer },
      cart: { cost:10, title:'عربة التسوق', done:!!state.fixtures?.cart },
      fridges: { cost:45, title:'ثلاجات العرض', done:!!state.fixtures?.fridges },
      itBench: { cost:45, title:'طاولة صيانة IT', done:!!state.fixtures?.itBench },
      electronics: { cost:55, title:'ركن صيانة الإلكترونيات', done:!!state.fixtures?.electronics }
    };
    const build = builds[typeKey]; if (!build) return toast('التجهيز غير معروف.');
    if (build.done) return toast('هذا التجهيز موجود بالفعل.');
    if (state.balance < build.cost) return toast(`تحتاج ${moneyFmt(build.cost)} لشراء ${build.title}؛ رصيدك ${moneyFmt(state.balance)}.`);
    state.balance -= build.cost;
    state.fixtures ||= { shelves:{}, register:false, computer:false, cart:false, fridges:false, itBench:false, electronics:false };
    state.fixtures.shelves ||= {};
    if (typeKey === 'shelf') state.fixtures.shelves[product] = true;
    else state.fixtures[typeKey] = true;
    state.level = Number(state.level || 1) + 1;
    message = `اشتريت ${build.title} بمبلغ ${moneyFmt(build.cost)}. أصبح التجهيز موجوداً في العالم.`;
  } else if (type === 'order') {
    if (!state.fixtures?.computer) return toast('اشترِ حاسوب الإدارة من كتالوج التجهيزات أولاً.');
    if (!state.storeOpen) return toast('الدكان مغلق. افتحه أولاً لطلب البضاعة.');
    if (!item) return toast('اختر منتجاً أولاً.');
    const packCost = Number(item.cost || 2) * Number(item.pack || 6);
    if (state.balance < packCost) return toast(`رصيدك ${moneyFmt(state.balance)} لا يكفي. تحتاج ${moneyFmt(packCost)} لشراء ${item.pack} قطع.`);
    state.balance -= packCost; item.stock += item.pack;
    message = `تم شراء ${item.pack} قطع من ${item.name} بالدفع ${extra.paymentMethod === 'visa' ? 'Visa' : 'نقداً'} مقابل ${moneyFmt(packCost)}.`;
  } else if (type === 'pickStock') {
    if (heldItem) return toast('يداك مشغولتان. ضع المنتج أولاً.');
    if (!item || item.stock < 1) return toast('لا يوجد مخزون خلفي من هذا المنتج.');
    item.stock--; setHeldItem(product, 'stock', null); message = `أمسكت ${item.name} من المستودع. اقترب من الرف واضغط E لوضعه.`;
  } else if (type === 'pickShelf') {
    if (heldItem) return toast('يداك مشغولتان. ضع المنتج أولاً.');
    if (!item) return toast('المنتج غير معروف.');
    item.shelfSlots ||= Array.from({ length: item.shelf || 0 }, (_, i) => i);
    const slot = Number(extra.slot);
    if (!item.shelfSlots.includes(slot)) return toast('هذه الخانة فارغة الآن؛ اختر قطعة أخرى.');
    item.shelfSlots = item.shelfSlots.filter(s => s !== slot); item.shelf = item.shelfSlots.length;
    setHeldItem(product, 'shelf', slot); message = `أخذت ${item.name} من الرف. ضعها في العربة أو أعدها إلى الرف.`;
  } else if (type === 'placeShelf') {
    if (!heldItem) return toast('لا تحمل منتجاً الآن.');
    if (!state.fixtures?.shelves?.[heldItem]) return toast(`اشترِ رف ${state.inventory[heldItem]?.name || ''} أولاً من كتالوج التجهيزات.`);
    if (extra.shelfProduct && extra.shelfProduct !== heldItem) return toast('لا يمكن وضع المنتج في رف من نوع مختلف.');
    const held = state.inventory[heldItem]; if (!held) return toast('المنتج غير معروف.');
    held.shelfSlots ||= [];
    if (held.shelf >= (state.capacity || 12)) return toast('الرف ممتلئ. طوّر المتجر لفتح خانات إضافية.');
    let slot = -1; for (let i = 0; i < (state.capacity || 12); i++) if (!held.shelfSlots.includes(i)) { slot = i; break; }
    if (slot < 0) return toast('لا توجد خانة فارغة على الرف.');
    held.shelfSlots.push(slot); held.shelf = held.shelfSlots.length;
    message = `وضعت ${held.name} على الرف فعلياً.`; setHeldItem(null);
  } else if (type === 'returnHeld') {
    if (!heldItem) return toast('لا تحمل منتجاً الآن.');
    const held = state.inventory[heldItem];
    if (heldSource === 'stock') held.stock++;
    else if (heldSlot != null && !held.shelfSlots.includes(heldSlot)) { held.shelfSlots.push(heldSlot); held.shelf = held.shelfSlots.length; }
    else { let free = -1; for (let i=0;i<(state.capacity||12);i++) if(!held.shelfSlots.includes(i)){free=i;break;} if(free>=0){held.shelfSlots.push(free);held.shelf=held.shelfSlots.length;} else held.stock++; }
    message = `أعدت ${held.name} إلى المخزون.`; setHeldItem(null);
  } else if (type === 'addToCart') {
    if (!heldItem) return toast('التقط منتجاً أولاً.');
    playerCart.push(heldItem); message = `وضعت ${state.inventory[heldItem]?.name || 'المنتج'} في عربة التسوق.`; setHeldItem(null);
  } else if (type === 'checkout') {
    if (!playerCart.length) return toast('عربة التسوق فارغة.');
    const total = cartTotal();
    if (state.balance < total) return toast(`الرصيد غير كافٍ. إجمالي العربة ${moneyFmt(total)} ورصيد العالم ${moneyFmt(state.balance)}.`);
    state.balance -= total; const count = playerCart.length; playerCart = [];
    message = `تمت المحاسبة ${extra.paymentMethod === 'visa' ? 'Visa' : 'نقداً'} بنجاح — ${count} قطعة بإجمالي ${moneyFmt(total)}.`;
  } else if (type === 'sell') {
    if (!state.fixtures?.register) return toast('اشترِ الكاشير أولاً من كتالوج التجهيزات.');
    if (!state.storeOpen) return toast('الدكان مغلق؛ لا يمكن البيع الآن.');
    if (!item) return toast('المنتج غير معروف.');
    item.shelfSlots ||= Array.from({ length: item.shelf || 0 }, (_, i) => i);
    if (!item.shelfSlots.length) return toast(`رف ${item.name} فارغ. اطلب بضاعة ثم عبّئ الرف.`);
    item.shelfSlots.pop(); item.shelf = item.shelfSlots.length; state.balance += item.price; state.totalSales += item.price;
    message = `تم بيع ${item.name} لزبون واستلام ${moneyFmt(item.price)} عبر ${extra.paymentMethod === 'visa' ? 'Visa' : 'النقد'}. أضيف المبلغ إلى خزنة العالم.`;
  } else if (type === 'upgrade') {
    const upgradeType = extra.upgradeType || 'topShelf';
    const options = { topShelf: { cost:150, title:'فتح الرف العلوي' }, warehouse:{cost:80,title:'توسعة المستودع'}, checkout:{cost:250,title:'كاشير إضافي'}, expansion:{cost:500,title:'توسعة مساحة المتجر'} };
    const opt = options[upgradeType]; if (!opt) return toast('نوع التطوير غير معروف.');
    state.upgrades ||= { topShelf:false, warehouse:false, checkout:false, expansion:false };
    if (state.upgrades[upgradeType]) return toast('هذا التطوير موجود بالفعل.');
    if (state.balance < opt.cost) return toast(`تحتاج إلى ${moneyFmt(opt.cost)} لتطوير ${opt.title}.`);
    state.balance -= opt.cost; state.upgrades[upgradeType] = true; state.level++;
    if (upgradeType === 'topShelf') state.capacity = 18;
    if (upgradeType === 'warehouse') { state.storageLevel = 1; for (const v of Object.values(state.inventory)) v.pack = 12; }
    message = `تم ${opt.title} بنجاح. أصبح التطوير ظاهراً في العالم.`;
  } else return toast('عملية غير معروفة.');
  renderState(state); toast(message); updateCartUI(); renderHeldVisual();
}
$('orderButton').addEventListener('click', () => {
  if (!gameState.fixtures?.computer) { openUpgradesModal(); toast('أول خطوة: اشترِ حاسوب الإدارة بـ$15، ثم ارجع لشراء البضاعة.'); return; }
  if (!gameState.storeOpen) return toast('الدكان مغلق حالياً. افتحه أو فعّل الدوام التلقائي.');
  openPaymentModal('order', selectedProduct);
});
$('upgradeButton').addEventListener('click', openUpgradesModal);
$('cartToggle').addEventListener('click', () => {
  const panel = $('cartPanel'); panel.classList.toggle('hidden');
  $('chatPanel').classList.add('hidden');
  if (!panel.classList.contains('hidden')) updateCartUI();
});
$('closeCart').addEventListener('click', () => $('cartPanel').classList.add('hidden'));
$('chatForm').addEventListener('submit', e => {
  e.preventDefault(); const text = $('chatInput').value.trim(); if (!text) return;
  if (currentMode !== 'multi' || !socket?.connected) return toast('الدردشة متاحة داخل غرفة أونلاين.');
  socket.emit('chat:send', { text }); $('chatInput').value = '';
});
$('chatToggle').addEventListener('click', () => {
  const panel = $('chatPanel'); panel.classList.toggle('hidden'); $('cartPanel').classList.add('hidden'); panel.classList.toggle('mobileHidden', false);
  if (!panel.classList.contains('hidden')) $('chatInput').focus();
});
$('closeChat').addEventListener('click', () => $('chatPanel').classList.add('hidden'));
$('menuButton').addEventListener('click', openPauseMenu);
$('resumeButton').addEventListener('click', closePauseMenu);
$('resumeX').addEventListener('click', closePauseMenu);
$('leaveButton').addEventListener('click', leaveWorld);
function restoreSoloGoods() {
  const state = normalizeGameState(gameState);
  const returnProduct = key => {
    const item = state.inventory[key]; if (!item) return;
    item.shelfSlots ||= [];
    let free = -1; for (let i=0;i<(state.capacity||12);i++) if(!item.shelfSlots.includes(i)){free=i;break;}
    if (free >= 0) { item.shelfSlots.push(free); item.shelf = item.shelfSlots.length; } else item.stock++;
  };
  if (heldItem) {
    const item = state.inventory[heldItem];
    if (item) {
      if (heldSource === 'stock') item.stock++;
      else if (heldSlot != null && !item.shelfSlots.includes(heldSlot)) { item.shelfSlots.push(heldSlot); item.shelf = item.shelfSlots.length; }
      else returnProduct(heldItem);
    }
  }
  playerCart.forEach(returnProduct); playerCart = []; setHeldItem(null); state.cart = []; state.playerHeldItem = null; state.playerHeldSource = null; state.playerHeldSlot = null; renderState(state);
}
function openPauseMenu() { if (!active) return; paused = true; $('pauseMenu').classList.remove('hidden'); if (document.pointerLockElement === canvas) document.exitPointerLock?.(); }
function closePauseMenu() { paused = false; $('pauseMenu').classList.add('hidden'); }
function leaveWorld() {
  if (soloGameMinuteTimer) { clearInterval(soloGameMinuteTimer); soloGameMinuteTimer = null; }
  $('jobModal').classList.add('hidden');
  if (currentMode === 'solo') restoreSoloGoods();
  if (socket?.connected && currentMode === 'multi') { stopVoice(); socket.emit('room:leave'); }
  $('paymentModal').classList.add('hidden'); $('upgradesModal').classList.add('hidden'); $('cartPanel').classList.add('hidden');
  active = false; paused = false; currentMode = 'none'; roomCode = ''; selfPlayerId = null; isRoomHost = false; roomHostId = null; roomPlayers = []; currentJob = 'shopkeeper'; isDriving=false; vehicleHolderId=null; $('vehicleExit').classList.add('hidden'); cartPickedUp = false; cartHolderId = null; if (cartBlocker) cartBlocker.active = true; if (policeCarBlocker) policeCarBlocker.active=true;
  clearRemotePlayers(); $('pauseMenu').classList.add('hidden'); $('entryScreen').classList.remove('hidden'); setHudVisible(false);
  if (document.pointerLockElement === canvas) document.exitPointerLock?.();
}

// -----------------------------------------------------------------------------
// WebRTC mesh voice chat. Requires HTTPS when deployed, and microphone approval.
// -----------------------------------------------------------------------------
function getPeer(id) {
  let rec = peerConnections.get(id);
  if (rec) return rec;
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] });
  rec = { pc, audio: null, pendingCandidates: [] }; peerConnections.set(id, rec);
  if (voiceStream) voiceStream.getTracks().forEach(track => pc.addTrack(track, voiceStream));
  pc.onicecandidate = e => { if (e.candidate && socket?.connected) socket.emit('voice:signal', { to: id, data: { candidate: e.candidate } }); };
  pc.ontrack = e => {
    let audio = rec.audio;
    if (!audio) { audio = document.createElement('audio'); audio.autoplay = true; audio.playsInline = true; audio.style.display = 'none'; document.body.appendChild(audio); rec.audio = audio; }
    audio.srcObject = e.streams[0]; audio.play().catch(() => toast('اضغط على الصفحة للسماح بتشغيل الصوت.', 2500));
  };
  pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') pc.restartIce?.(); };
  return rec;
}
async function startPeerOffer(id) {
  if (!selfVoiceReady || !voiceStates.get(id) || !socket?.connected || String(selfPlayerId).localeCompare(String(id)) >= 0) return;
  const rec = getPeer(id);
  if (rec.pc.signalingState !== 'stable' || rec.pc.localDescription) return;
  try { const offer = await rec.pc.createOffer(); await rec.pc.setLocalDescription(offer); socket.emit('voice:signal', { to: id, data: { description: rec.pc.localDescription } }); }
  catch (err) { console.warn('Voice offer:', err); }
}
function closePeer(id) { const rec = peerConnections.get(id); if (!rec) return; try { rec.pc.close(); } catch {} rec.audio?.remove(); peerConnections.delete(id); }
async function toggleVoice() {
  if (currentMode !== 'multi' || !socket?.connected) return toast('المحادثة الصوتية تعمل داخل الغرف الجماعية فقط.');
  if (!navigator.mediaDevices?.getUserMedia) return toast('المتصفح لا يدعم المايك هنا. افتح اللعبة عبر HTTPS أو localhost.');
  if (!voiceStream) {
    try {
      voiceStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      voiceMuted = false; selfVoiceReady = true;
      socket.emit('voice:status', { ready: true });
      for (const [id, ready] of voiceStates) if (ready && String(selfPlayerId).localeCompare(String(id)) < 0) startPeerOffer(id);
      $('voiceLabel').textContent = 'كتم المايك'; $('voiceIcon').textContent = '🎙️'; $('voiceButton').classList.add('active');
      $('voiceStatus').textContent = 'الصوت جاهز'; $('voiceStatus').classList.add('on');
      toast('تم تشغيل المايك. إذا لم يسمعك أصحابك، تأكد أن المتصفح سمح باستخدامه.');
    } catch (err) {
      toast(err?.name === 'NotAllowedError' ? 'لم تسمح للعبة باستخدام المايك.' : 'لم نتمكن من فتح المايك. تأكد من توصيله وصلاحيات المتصفح.', 3500);
    }
  } else {
    voiceMuted = !voiceMuted;
    voiceStream.getAudioTracks().forEach(track => { track.enabled = !voiceMuted; });
    $('voiceLabel').textContent = voiceMuted ? 'تشغيل المايك' : 'كتم المايك';
    $('voiceIcon').textContent = voiceMuted ? '🔇' : '🎙️';
    $('voiceButton').classList.toggle('active', !voiceMuted);
    toast(voiceMuted ? 'تم كتم المايك — ستبقى تسمع أصحابك.' : 'المايك يعمل الآن.');
  }
}
function stopVoice() {
  if (voiceStream) voiceStream.getTracks().forEach(t => t.stop()); voiceStream = null; selfVoiceReady = false; voiceMuted = false;
  if (socket?.connected) socket.emit('voice:status', { ready: false });
  for (const id of [...peerConnections.keys()]) closePeer(id);
  $('voiceLabel').textContent = 'تفعيل الصوت'; $('voiceIcon').textContent = '🎙️'; $('voiceButton').classList.remove('active'); refreshPlayersUi();
}
$('voiceButton').addEventListener('click', toggleVoice);

// -----------------------------------------------------------------------------
// First-person movement, touch controls, interactions, and animation loop.
// -----------------------------------------------------------------------------
const PLAYER_RADIUS = 0.29;

let mainBackWallBlocker = null;
function addBlocker(cx, cz, halfX, halfZ, id = '') {
  const blocker = { id, minX: cx - halfX, maxX: cx + halfX, minZ: cz - halfZ, maxZ: cz + halfZ, active: true };
  worldBlockers.push(blocker); return blocker;
}
// Shop shell: all wall sections are solid, except the central front doorway.
addBlocker(-8.2, -1.05, 0.24, 7.65);
addBlocker( 8.2, -1.05, 0.24, 7.65);
mainBackWallBlocker = addBlocker(0, -8.55, 8.2, 0.24, 'main-back-wall');
addBlocker(-4.9, 6.45, 3.3, 0.22);
addBlocker( 4.9, 6.45, 3.3, 0.22);
// Fixture collisions only activate after the player has purchased the equipment.
const fixtureBlockers = { shelves:{}, stock:{}, register:null, computer:null, fridges:[], itBench:null, electronics:null };
for (let i = 0; i < shelfXs.length; i++) {
  const key = shelfProductByX[i], sx = shelfXs[i];
  fixtureBlockers.shelves[key] = addBlocker(sx, -0.53, 0.64, 3.34, `shelf-${key}`); fixtureBlockers.shelves[key].active = false;
}
fixtureBlockers.computer = addBlocker(-5.45, -2.3, 1.17, 0.56, 'stock-desk'); fixtureBlockers.computer.active = false;
for (const [key, z] of Object.entries(stockStationZ)) { fixtureBlockers.stock[key] = addBlocker(-7.16, z, .56, .53, `stock-crate-${key}`); fixtureBlockers.stock[key].active = false; }
fixtureBlockers.register = addBlocker(-5.45, -5.15, 1.3, 0.72, 'checkout-counter'); fixtureBlockers.register.active = false;
for (let i = 0; i < 3; i++) { const b = addBlocker(0.5 + i * 2.1, -7.85, 0.92, 0.42, `fridge-${i}`); b.active = false; fixtureBlockers.fridges.push(b); }
fixtureBlockers.itBench = addBlocker(2.0, -4.5, 1.08, .48, 'it-workbench'); fixtureBlockers.itBench.active = false;
fixtureBlockers.electronics = addBlocker(5.3, -4.5, 1.05, .48, 'electronics-workbench'); fixtureBlockers.electronics.active = false;
// Outside planters and parked vehicles.
addBlocker(-4.7, 7.65, 1.0, 0.48, 'planter-west'); addBlocker(4.7, 7.65, 1.0, 0.48, 'planter-east');
for (const bx of [-2, 2]) addBlocker(bx, 7.35, 0.17, 0.17, `door-bollard-${bx}`);
const policeCarBlocker = addBlocker(-54, 42, 1.9, .9, 'police-car');
addBlocker(42, 21.3, 1.95, 0.98, 'car-east');
addBlocker(82,55,1.95,.98,'car-north');
cartBlocker = addBlocker(6.35, 4.05, 0.62, 0.70, 'shopping-cart'); cartBlocker.active = false;
// Buildings in the street are solid; collision bounds match their visible footprints.
addBlocker(-15, 3, 5.15, 5.65, 'home-west'); addBlocker(15, 3.5, 5.15, 5.65, 'home-east');
addBlocker(-27, 2, 4.65, 5.15, 'market-west'); addBlocker(27, 2, 4.65, 5.15, 'market-east');
addBlocker(-15, 30, 4.65, 5.15, 'home-northwest'); addBlocker(15, 31, 5.15, 5.65, 'home-northeast');
addBlocker(-90,-7,5.25,5.25,'market-far-west');addBlocker(90,-7,5.25,5.25,'market-far-east');
addBlocker(-90,73,5.25,5.75,'home-far-northwest');addBlocker(90,73,5.25,5.75,'home-far-northeast');
for (const lx of [-90,-80,-50,-40,-31,-22,-9,9,22,31,40,50,80,90]) addBlocker(lx, 14.2, 0.14, 0.14, `street-lamp-${lx}`);
function isBlockedPosition(x, z) {
  if (x < -98 || x > 98 || z < -88 || z > 92) return true;
  return worldBlockers.some(b => b.active !== false && x > b.minX - PLAYER_RADIUS && x < b.maxX + PLAYER_RADIUS && z > b.minZ - PLAYER_RADIUS && z < b.maxZ + PLAYER_RADIUS);
}
function isVehicleBlockedPosition(x,z) {
  const halfX=1.85, halfZ=.88;
  if (x-halfX < -98 || x+halfX > 98 || z-halfZ < -88 || z+halfZ > 92) return true;
  return worldBlockers.some(b => b.id !== 'police-car' && b.id !== 'shopping-cart' && b.active !== false && x+halfX>b.minX && x-halfX<b.maxX && z+halfZ>b.minZ && z-halfZ<b.maxZ);
}
function applyVehiclePose(pose, persist=false) {
  if (!pose || !patrolCar) return;
  const x=Number(pose.x), z=Number(pose.z), rot=Number(pose.rot)||0;
  if (!Number.isFinite(x)||!Number.isFinite(z)) return;
  patrolCar.position.set(x,0,z); patrolCar.rotation.y=rot;
  gameState.vehiclePose={x,z,rot};
  if (policeCarBlocker) { policeCarBlocker.minX=x-1.9; policeCarBlocker.maxX=x+1.9; policeCarBlocker.minZ=z-.9; policeCarBlocker.maxZ=z+.9; policeCarBlocker.active=!isDriving; }
  const target=targets?.find(t=>t.id==='police-vehicle'); if(target){target.x=x;target.z=z+1.55;}
  if (persist && currentMode==='solo') { try {localStorage.setItem(soloStorageKey,JSON.stringify(gameState));}catch{} }
}
function isCartBlockedPosition(x, z) {
  const halfX = .62, halfZ = .70;
  if (x-halfX < -98 || x+halfX > 98 || z-halfZ < -88 || z+halfZ > 92) return true;
  return worldBlockers.some(b => b.id !== 'shopping-cart' && b.active !== false && x+halfX > b.minX && x-halfX < b.maxX && z+halfZ > b.minZ && z-halfZ < b.maxZ);
}

const targets = [
  { id:'laptop', label:'الحاسوب — طلب البضاعة', x:-4.0, z:-2.3, type:'order' },
  { id:'register', label:'الكاشير — محاسبة أو بيع', x:-3.85, z:-5.15, type:'register' },
  { id:'stock-water', label:'مخزون المياه', x:-6.0, z:3.5, type:'stock', product:'water' },
  { id:'stock-chips', label:'مخزون الشيبس', x:-6.0, z:1.65, type:'stock', product:'chips' },
  { id:'stock-milk', label:'مخزون الحليب', x:-6.0, z:-0.4, type:'stock', product:'milk' },
  { id:'shelf-water', label:'رف المياه', x:-1.28, z:-0.55, type:'shelf', product:'water' },
  { id:'shelf-chips', label:'رف الشيبس', x:1.87, z:-0.55, type:'shelf', product:'chips' },
  { id:'shelf-milk', label:'رف الألبان', x:5.02, z:-0.55, type:'shelf', product:'milk' },
  { id:'shopping-cart', label:'عربة التسوق', x:6.35, z:4.05, type:'cart' },
  { id:'police-vehicle', label:'سيارة الدورية — اضغط E للقيادة', x:-54, z:43.55, type:'vehicle', job:'police' },
  { id:'job-mechanic-0', label:'فحص السيارة', x:-59.65, z:10.15, type:'jobTask', job:'mechanic', stepIndex:0, icon:'🔧' },
  { id:'job-mechanic-1', label:'خزانة أدوات الورشة', x:-52.35, z:8.45, type:'jobTask', job:'mechanic', stepIndex:1, icon:'🧰' },
  { id:'job-mechanic-2', label:'اختبار السيارة', x:-54.35, z:10.15, type:'jobTask', job:'mechanic', stepIndex:2, icon:'🚗' },
  { id:'job-it-0', label:'تشخيص العطل', x:51.3, z:9.2, type:'jobTask', job:'it', stepIndex:0, icon:'💻' },
  { id:'job-it-1', label:'إصلاح النظام', x:55, z:9.2, type:'jobTask', job:'it', stepIndex:1, icon:'🪛' },
  { id:'job-it-2', label:'اختبار الحاسوب', x:58.7, z:9.2, type:'jobTask', job:'it', stepIndex:2, icon:'✅' },
  { id:'job-electronics-0', label:'فحص الجهاز', x:69.8, z:9.25, type:'jobTask', job:'electronics', stepIndex:0, icon:'📱' },
  { id:'job-electronics-1', label:'إصلاح الدارة', x:73, z:9.25, type:'jobTask', job:'electronics', stepIndex:1, icon:'🔌' },
  { id:'job-electronics-2', label:'اختبار الجهاز', x:76.2, z:9.25, type:'jobTask', job:'electronics', stepIndex:2, icon:'✅' },
  { id:'job-delivery-0', label:'استلام الطرد', x:-46.15, z:32.65, type:'jobTask', job:'delivery', stepIndex:0, icon:'📦' },
  { id:'job-delivery-1', label:'تجهيز الطلب', x:-42, z:35.15, type:'jobTask', job:'delivery', stepIndex:1, icon:'🧾' },
  { id:'job-delivery-2', label:'تسليم الطلب', x:-21, z:20.5, type:'jobTask', job:'delivery', stepIndex:2, icon:'🚚' },
  { id:'job-police-0', label:'المشتبه به — إيقاف', x:6, z:22, type:'jobTask', job:'police', stepIndex:0, icon:'🚓' },
  { id:'job-police-1', label:'مكتب الشرطة — تسجيل البلاغ', x:-63, z:34, type:'jobTask', job:'police', stepIndex:1, icon:'📋' },
  { id:'job-criminal-0', label:'شحنة إلكترونيات — خذها', x:13, z:23.3, type:'jobTask', job:'criminal', stepIndex:0, icon:'🕶️' },
  { id:'job-criminal-1', label:'نقطة الهروب', x:34, z:25.2, type:'jobTask', job:'criminal', stepIndex:1, icon:'🏃' }
];
for(const target of targets.filter(t=>t.type==='jobTask')) {
  const step=JOB_WORKFLOWS[target.job]?.[target.stepIndex];
  const marker=labelSprite(`${target.stepIndex+1}. ${step?.title||target.label}`,{bg:'#175d47ee',color:'#f1ffd8',fontSize:27,width:540,height:86});
  marker.position.set(target.x,2.55,target.z);marker.scale.set(2.0,.34,1);marker.userData.billboard=true;marker.visible=false;scene.add(marker);target.marker=marker;
}
function claimShoppingCart() {
  if (!gameState.fixtures?.cart) return toast('العربة غير موجودة بعد؛ اشترها من كتالوج تجهيزات الدكان.');
  if (heldItem) return toast('ضع المنتج أولاً، ثم أمسك العربة.');
  if (currentMode === 'solo') {
    cartPickedUp = true; cartHolderId = 'solo'; if (cartBlocker) cartBlocker.active = false;
    updateShoppingCart(0, true); toast('أمسكت العربة. اضغط E قربها لتركها، أو ضع المنتجات فيها.'); return;
  }
  if (currentMode !== 'multi' || !socket?.connected) return toast('العربة تحتاج إلى عالم نشط.');
  socket.emit('cart:claim', {}, result => {
    if (!result?.ok) return toast(result?.error || 'العربة مشغولة بلاعب آخر.');
    applyCartOwnership({ holderId: result.holderId || selfPlayerId, pose: result.pose });
    updateShoppingCart(0, true); toast('أمسكت العربة. كل الموجودين في الغرفة سيرون حركتها.');
  });
}
function releaseShoppingCart() {
  if (currentMode === 'solo') {
    cartPickedUp = false; cartHolderId = null; if (cartBlocker) cartBlocker.active = true;
    gameState.cartPose = { x: shoppingCart.position.x, z: shoppingCart.position.z, rot: shoppingCart.rotation.y };
    renderState(gameState); toast('تركت العربة.'); return;
  }
  if (currentMode !== 'multi' || !socket?.connected) return;
  socket.emit('cart:release', {}, result => {
    if (!result?.ok) return toast(result?.error || 'تعذّر ترك العربة.');
    applyCartOwnership({ holderId: null, pose: result.pose }); toast('تركت العربة.');
  });
}
function updateShoppingCart(_dt = 0, force = false) {
  if (!cartPickedUp || !active || paused) return;
  const distance = 1.55;
  const x = playerPosition.x - Math.sin(yaw) * distance;
  const z = playerPosition.z - Math.cos(yaw) * distance;
  if (isCartBlockedPosition(x, z)) return;
  const now = performance.now();
  const shouldPersist = currentMode === 'solo' && (force || now - lastCartPersist > 500);
  applyCartPose({ x, z, rot: yaw }, shouldPersist);
  if (shouldPersist) lastCartPersist = now;
  if (currentMode === 'multi' && socket?.connected && (force || now-lastCartEmit > 65)) {
    lastCartEmit = now; socket.volatile.emit('cart:move', { x, z, rot: yaw });
  }
}
function distanceXZ(x,z,tx,tz) { return Math.hypot(x-tx,z-tz); }
function interactionLabel(target) {
  if (target.type === 'stock') {
    const item = gameState.inventory[target.product];
    if (heldItem) return 'اليد مشغولة: ضع القطعة على الرف أو في العربة';
    return item?.stock > 0 ? `اضغط E لأخذ ${item.name} من المخزن` : `مخزن ${item?.name || ''} فارغ — اشترِ البضاعة من لوحة المتجر`;
  }
  if (target.type === 'shelf') {
    const item = gameState.inventory[target.product];
    if (heldItem) return target.product === heldItem ? `اضغط E لوضع ${gameState.inventory[heldItem]?.name || 'المنتج'} على الرف` : `هذا رف ${item?.name || ''}. ارجع إلى رف المنتج الذي تحمله`;
    if (item?.shelf > 0) return `وجّه النقطة البيضاء إلى قطعة ${item.name} واضغط F لالتقاطها`;
    if (item?.stock > 0) return `رف ${item.name} فارغ — اذهب للمخزن وخذ قطعة`;
    return `رف ${item?.name || ''} فارغ — اشترِ بضاعة أولاً`;
  }
  if (target.type === 'cart') return heldItem ? `اضغط E لوضع ${gameState.inventory[heldItem]?.name || 'المنتج'} في العربة` : cartPickedUp ? `العربة معك · ${playerCart.length} قطعة · اضغط E لتركها` : `اضغط E لمسك العربة · ${playerCart.length} قطعة`;
  if (target.type === 'vehicle') return `اضغط E لقيادة سيارة الدورية · V لتبديل المنظور`;
  if (target.type === 'register') {
    if (!gameState.storeOpen) return 'الدكان مغلق — افتحه أولاً من لوحة الإدارة';
    return playerCart.length ? `اضغط E للمحاسبة · إجمالي ${moneyFmt(cartTotal())}` : (heldItem ? 'ضع المنتج في العربة أو على الرف أولاً' : `اضغط E عند الكاشير لبيع قطعة ${gameState.inventory[selectedProduct]?.name || 'المنتج'}`);
  }
  if (target.type === 'order') return 'الشراء من زر «شراء بضاعة للمخزن» في لوحة المتجر';
  if (target.type === 'jobTask') { const flow=JOB_WORKFLOWS[target.job]||[];const step=flow[target.stepIndex];return step?`مهمة ${target.stepIndex+1}/${flow.length}: ${step.title} — اضغط E لإنجاز الخطوة`:`موقع عمل ${(JOBS[target.job]||JOBS.unassigned).label}`; }
  return target.label;
}
function updateNearestInteraction() {
  if (!active || paused) { nearestInteraction = null; $('interactionPrompt').classList.add('hidden'); return; }
  let min = 3.25, nearest = null;
  const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0;
  if (forward.lengthSq() > 0.0001) forward.normalize();
  for (const t of targets) {
    if (t.type === 'jobTask') {
      if(t.job!==currentJob)continue;
      const wantedStep=jobWorkSession?.job===currentJob?jobWorkSession.step:0;
      if(t.stepIndex!==wantedStep)continue;
      if(t.job==='police'&&t.stepIndex===0&&!robberNpc?.visible)continue;
      if(t.job==='criminal'&&t.stepIndex===0&&!stolenGoodsCrate.visible)continue;
    }
    if (t.type === 'vehicle') { if (currentJob !== 'police' || isDriving || (currentMode === 'multi' && vehicleHolderId && vehicleHolderId !== selfPlayerId)) continue; t.x = patrolCar.position.x; t.z = patrolCar.position.z + 1.55; }
    if (t.type === 'shelf' && !gameState.fixtures?.shelves?.[t.product]) continue;
    if (t.type === 'stock' && !(gameState.inventory?.[t.product]?.stock > 0)) continue;
    if (t.type === 'register' && !gameState.fixtures?.register) continue;
    if (t.type === 'order' && !gameState.fixtures?.computer) continue;
    if (t.type === 'cart' && !gameState.fixtures?.cart) continue;
    if (t.type === 'jobTask' && t.job === 'police' && t.stepIndex===0 && robberNpc?.visible) { t.x = robberNpc.position.x; t.z = robberNpc.position.z; }
    const dx = t.x - playerPosition.x, dz = t.z - playerPosition.z;
    const d = Math.hypot(dx, dz);
    if (d >= min) continue;
    const facing = d > 0.001 ? (dx * forward.x + dz * forward.z) / d : 1;
    if (facing < 0.12 && !(heldItem && t.type === 'shelf' && t.product === heldItem)) continue; // Easier placement: matching shelf can be selected while carrying its product.
    nearest = t; min = d;
  }
  nearestInteraction = nearest;
  const stage=jobWorkSession?.job===currentJob?jobWorkSession.step:0;
  for(const t of targets.filter(item=>item.type==='jobTask')) {
    if(!t.marker)continue;
    const activeMarker=t.job===currentJob&&t.stepIndex===stage&&!(t.job==='police'&&t.stepIndex===0&&!robberNpc?.visible)&&!(t.job==='criminal'&&t.stepIndex===0&&!stolenGoodsCrate.visible);
    t.marker.visible=!!active&&activeMarker;t.marker.position.set(t.x,2.55,t.z);
  }
  if (nearest) {
    $('interactionText').textContent = interactionLabel(nearest);
    const keyEl = $('interactionKey');
    if (keyEl) keyEl.textContent = (nearest.type === 'shelf' && !heldItem && (gameState.inventory[nearest.product]?.shelf || 0) > 0) ? 'F' : 'E';
    $('interactionPrompt').classList.remove('hidden');
  } else $('interactionPrompt').classList.add('hidden');
}
function nearestVisibleSlot(productKey) {
  const visible = (productMeshesByKey[productKey] || []).filter(mesh => mesh.visible);
  if (!visible.length) return null;
  visible.sort((a,b) => {
    const pa = new THREE.Vector3(), pb = new THREE.Vector3(); a.getWorldPosition(pa); b.getWorldPosition(pb);
    return distanceXZ(playerPosition.x, playerPosition.z, pa.x, pa.z) - distanceXZ(playerPosition.x, playerPosition.z, pb.x, pb.z);
  });
  const pos = new THREE.Vector3(); visible[0].getWorldPosition(pos);
  return distanceXZ(playerPosition.x, playerPosition.z, pos.x, pos.z) < 3.2 ? visible[0].userData.productSlot : null;
}
function interact() {
  if (!active || paused) return;
  if (!nearestInteraction) return toast('اقترب من الحاسوب أو الرف أو العربة أو الكاشير للتفاعل.', 1800);
  const target = nearestInteraction;
  if (target.type === 'jobTask') { performJobTask(target.job,target); return; }
  if (target.type === 'vehicle') { enterPoliceVehicle(); return; }
  if (target.type === 'order') { openPaymentModal('order', selectedProduct); return; }
  if (target.type === 'stock') {
    if (heldItem) return toast('يداك مشغولتان. ضع المنتج على رف أو في العربة أولاً.');
    const stockItem = gameState.inventory[target.product];
    if (!(stockItem?.stock > 0)) return toast(`مخزون ${stockItem?.name || ''} فارغ. اشترِ بضاعة من الحاسوب.`);
    performAction('pickStock', target.product); return;
  }
  if (target.type === 'shelf') {
    if (heldItem) {
      if (target.product !== heldItem) return toast(`هذا رف ${gameState.inventory[target.product]?.name || ''}. المنتج الذي تحمله ${gameState.inventory[heldItem]?.name || ''} له رف مختلف.`);
      performAction('placeShelf', heldItem, { shelfProduct: target.product }); return;
    }
    const item = gameState.inventory[target.product];
    if (item?.shelf > 0) {
      const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
      const focused = raycaster.intersectObjects(products.filter(mesh => mesh.visible && mesh.userData.productKey === target.product), true);
      let slot = null;
      if (focused.length) {
        let root = focused[0].object;
        while (root && !Object.prototype.hasOwnProperty.call(root.userData || {}, 'productKey')) root = root.parent;
        if (root?.userData?.productKey === target.product) {
          const p = new THREE.Vector3(); root.getWorldPosition(p);
          if (distanceXZ(playerPosition.x, playerPosition.z, p.x, p.z) < 3.2) slot = root.userData.productSlot;
        }
      }
      if (slot == null) return toast('وجّه المؤشر إلى قطعة ظاهرة على الرف ثم اضغط E أو F.');
      performAction('pickShelf', target.product, { slot });
    } else if (item?.stock > 0) toast(`رف ${item.name} فارغ. اذهب إلى مخزون المستودع عند الجدار الأيسر، التقط المنتج ثم أعده إلى الرف.`);
    else toast(`رف ${item?.name || ''} فارغ. اذهب إلى الحاسوب لشراء بضاعة.`);
    return;
  }
  if (target.type === 'cart') {
    if (heldItem) { performAction('addToCart', heldItem); return; }
    if (cartPickedUp) { releaseShoppingCart(); return; }
    claimShoppingCart(); return;
  }
  if (target.type === 'register') {
    if (heldItem) return toast('ضع المنتج في العربة أو على الرف أولاً.');
    if (playerCart.length) { openPaymentModal('checkout'); return; }
    openPaymentModal('sale', selectedProduct); return;
  }
}
function pickFocusedProduct() {
  if (!active || paused || heldItem) return;
  const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects(products.filter(mesh => mesh.visible), true);
  for (const hit of hits) {
    let root = hit.object;
    while (root && !Object.prototype.hasOwnProperty.call(root.userData || {}, 'productKey')) root = root.parent;
    if (!root?.userData?.productKey || !root.visible) continue;
    const pos = new THREE.Vector3(); root.getWorldPosition(pos);
    if (distanceXZ(playerPosition.x, playerPosition.z, pos.x, pos.z) > 3.1) break;
    performAction('pickShelf', root.userData.productKey, { slot: root.userData.productSlot }); return;
  }
  if (nearestInteraction?.type === 'stock' && (gameState.inventory[nearestInteraction.product]?.stock || 0) > 0) performAction('pickStock', nearestInteraction.product);
  else toast('وجّه المؤشر إلى منتج على الرف، أو اقترب من مخزون المستودع لالتقاط قطعة.', 1800);
}
$('touchAction').addEventListener('click', interact);
$('touchPickup').addEventListener('click', pickFocusedProduct);
window.addEventListener('keydown', e => {
  const target=e.target;
  const typing=target instanceof HTMLElement&&(target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target.tagName));
  if(typing)return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&active)e.preventDefault();
  if(e.code==='Escape'&&active&&!e.repeat){
    if(!$('shortcutsModal').classList.contains('hidden'))closeShortcutsModal();
    else if(!$('tutorialModal').classList.contains('hidden'))closeTutorial();
    else if(!$('jobModal').classList.contains('hidden'))closeJobModal();
    else if(!$('upgradesModal').classList.contains('hidden'))closeUpgradesModal();
    else if(!$('paymentModal').classList.contains('hidden'))closePaymentModal();
    else if(!$('pauseMenu').classList.contains('hidden'))closePauseMenu();
    else openPauseMenu();
    return;
  }
  keys[e.code]=true;
  if(!active||paused||e.repeat)return;
  if(e.code==='KeyV')setCameraView(cameraView==='first'?'third':'first');
  else if(e.code==='KeyE')interact();
  else if(e.code==='KeyF')pickFocusedProduct();
  else if(e.code==='KeyG'&&heldItem)performAction('returnHeld',heldItem);
  else if(e.code==='KeyB')openUpgradesModal();
  else if(e.code==='KeyJ')openJobModal();
  else if(e.code==='KeyH')openTutorial();
  else if(e.code==='KeyK'){const panel=$('cartPanel');panel.classList.toggle('hidden');$('chatPanel').classList.add('hidden');if(!panel.classList.contains('hidden'))updateCartUI();}
  else if(e.code==='KeyC'&&currentMode==='multi'){const panel=$('chatPanel');panel.classList.toggle('hidden');$('cartPanel').classList.add('hidden');panel.classList.toggle('mobileHidden',false);if(!panel.classList.contains('hidden'))$('chatInput').focus();}
  else if(['Digit1','Digit2','Digit3'].includes(e.code)){
    const key=itemKeys[Number(e.code.slice(-1))-1];
    if(key){selectedProduct=key;renderState(gameState);toast('اخترت '+(gameState.inventory[key]?.name||key),1100);}
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k of Object.keys(keys)) keys[k] = false; touchMove.x = 0; touchMove.y = 0; });
canvas.addEventListener('click', () => {
  if (!active || paused || ('ontouchstart' in window)) return;
  if (document.pointerLockElement !== canvas && canvas.requestPointerLock) canvas.requestPointerLock();
});
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas || !active || paused) return;
  yaw -= e.movementX * .0022; pitch = Math.max(-1.25, Math.min(1.25, pitch - e.movementY * .0019));
  updateCameraPose();
});
// Touch joystick.
const joystick = $('joystick'), joystickKnob = $('joystickKnob');
function updateJoystick(e) {
  const rect = joystick.getBoundingClientRect(); const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
  let dx=e.clientX-cx, dy=e.clientY-cy; const max=35; const len=Math.hypot(dx,dy);
  if (len>max) { dx=dx/len*max; dy=dy/len*max; }
  touchMove.x=dx/max; touchMove.y=dy/max; joystickKnob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
}
joystick.addEventListener('pointerdown', e => { if (!active) return; joystickPointer=e.pointerId; joystick.setPointerCapture?.(e.pointerId); updateJoystick(e); });
joystick.addEventListener('pointermove', e => { if (e.pointerId===joystickPointer) updateJoystick(e); });
function endJoystick(e) { if (e.pointerId !== joystickPointer) return; joystickPointer=null; touchMove.x=0;touchMove.y=0;joystickKnob.style.transform='translate(-50%,-50%)'; }
joystick.addEventListener('pointerup',endJoystick); joystick.addEventListener('pointercancel',endJoystick); joystick.addEventListener('lostpointercapture',()=>{joystickPointer=null;touchMove.x=0;touchMove.y=0;joystickKnob.style.transform='translate(-50%,-50%)';});
// Drag on empty screen to rotate camera on mobile.
canvas.addEventListener('pointerdown', e => {
  if (!active || paused || !('ontouchstart' in window)) return;
  if (e.clientX < window.innerWidth * .30) return;
  lookPointer=e.pointerId; lastLookPoint={x:e.clientX,y:e.clientY};
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId !== lookPointer || !lastLookPoint || !active || paused) return;
  const dx=e.clientX-lastLookPoint.x, dy=e.clientY-lastLookPoint.y; lastLookPoint={x:e.clientX,y:e.clientY};
  yaw -= dx*.006; pitch=Math.max(-1.25,Math.min(1.25,pitch-dy*.004)); updateCameraPose();
});
function endLook(e){if(e.pointerId===lookPointer){lookPointer=null;lastLookPoint=null;}}
canvas.addEventListener('pointerup',endLook); canvas.addEventListener('pointercancel',endLook);

function animateAvatarModel(avatar,dt,moving,working=false) {
  const motion=avatar?.userData?.motion;if(!motion)return;
  if(moving)motion.walkPhase=(motion.walkPhase||0)+dt*(keys.ShiftLeft||keys.ShiftRight?11.5:8.2);
  const phase=(motion.walkPhase||0)+(motion.phase||0);
  for(const limb of motion.legs||[]) {const target=working?0:Math.sin(phase+(limb.side<0?Math.PI:0))*.58*(moving?1:0);limb.pivot.rotation.x+=(target-limb.pivot.rotation.x)*Math.min(1,dt*12);}
  for(const limb of motion.arms||[]) {const target=working?(-.65+(limb.side<0?.18:0)):Math.sin(phase+(limb.side>0?Math.PI:0))*.38*(moving?1:0);limb.pivot.rotation.x+=(target-limb.pivot.rotation.x)*Math.min(1,dt*10);limb.pivot.rotation.z+=(0-limb.pivot.rotation.z)*Math.min(1,dt*8);}
  if(motion.body){const bob=moving?Math.abs(Math.sin(phase*2))*.045:0;motion.body.position.y+=(.98+bob-motion.body.position.y)*Math.min(1,dt*10);const tilt=working?0.045:moving?0.025:0;motion.body.rotation.x+=(tilt-motion.body.rotation.x)*Math.min(1,dt*8);}
}
function animateLocalAvatar(dt,moving) {animateAvatarModel(selfAvatar,dt,moving,performance.now()<avatarActionUntil);}
function updateMovement(dt) {
  if (!active || paused) { animateLocalAvatar(dt,false); return; }
  const forward = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - touchMove.y;
  const right = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + touchMove.x;
  const len=Math.hypot(forward,right); if (len<0.03) { animateLocalAvatar(dt,false); updateCameraPose(); return; }
  const f=forward/Math.max(1,len), r=right/Math.max(1,len);
  const speed = isDriving ? ((keys.ShiftLeft||keys.ShiftRight) ? 13.5 : 8.4) : ((keys.ShiftLeft||keys.ShiftRight)?6.3:4.2);
  const dx=(-Math.sin(yaw)*f + Math.cos(yaw)*r)*speed*dt;
  const dz=(-Math.cos(yaw)*f - Math.sin(yaw)*r)*speed*dt;
  const ox=playerPosition.x, oz=playerPosition.z;
  const substeps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.075));
  const stepX = dx / substeps, stepZ = dz / substeps;
  for (let i = 0; i < substeps; i++) {
    const nx = THREE.MathUtils.clamp(playerPosition.x + stepX, -96, 96);
    const nz = THREE.MathUtils.clamp(playerPosition.z + stepZ, -86, 90);
    const isBlocked = (x,z) => isDriving ? isVehicleBlockedPosition(x,z) : isBlockedPosition(x,z);
    if (!isBlocked(nx, playerPosition.z)) playerPosition.x = nx;
    if (!isBlocked(playerPosition.x, nz)) playerPosition.z = nz;
  }
  const moved = Math.hypot(playerPosition.x-ox, playerPosition.z-oz);
  const moving=Math.min(1,moved / Math.max(0.001,speed*dt)); animateLocalAvatar(dt,moved>.002&&!isDriving); elapsed += dt*9*moving;
  if (firstPersonHands) { firstPersonHands.position.y = Math.sin(elapsed) * .014 * moving; firstPersonHands.rotation.z = Math.sin(elapsed*.5)*.012*moving; }
  if (isDriving) {
    patrolCar.position.set(playerPosition.x,0,playerPosition.z); patrolCar.rotation.y=yaw+Math.PI/2;
    gameState.vehiclePose={x:patrolCar.position.x,z:patrolCar.position.z,rot:patrolCar.rotation.y};
    if (policeCarBlocker) { policeCarBlocker.minX=patrolCar.position.x-1.9; policeCarBlocker.maxX=patrolCar.position.x+1.9; policeCarBlocker.minZ=patrolCar.position.z-.9; policeCarBlocker.maxZ=patrolCar.position.z+.9; policeCarBlocker.active=false; }
    const now=performance.now();
    if (currentMode==='multi' && socket?.connected && now-vehicleEmitAt>45) { vehicleEmitAt=now; socket.volatile.emit('vehicle:move',{x:patrolCar.position.x,z:patrolCar.position.z,rot:patrolCar.rotation.y}); }
  }
  updateCameraPose();
  if (currentMode==='multi' && socket?.connected && performance.now()-lastMoveEmit>45) {
    lastMoveEmit=performance.now(); socket.volatile.emit('player:move',{x:playerPosition.x,z:playerPosition.z,rot:yaw,job:currentJob,driving:isDriving});
  }
}

function npcCanWalk(x,z,zone) {
  if (x < zone.minX || x > zone.maxX || z < zone.minZ || z > zone.maxZ) return false;
  return !isBlockedPosition(x,z);
}
function findNpcPath(startX,startZ,targetX,targetZ,zone) {
  const step=zone.step||.72;
  const cols=Math.floor((zone.maxX-zone.minX)/step)+1;
  const rows=Math.floor((zone.maxZ-zone.minZ)/step)+1;
  const total=cols*rows;
  const clampCell=(v,max)=>Math.max(0,Math.min(max,Math.round(v)));
  const toCell=(x,z)=>({x:clampCell((x-zone.minX)/step,cols-1),z:clampCell((z-zone.minZ)/step,rows-1)});
  const idOf=(x,z)=>z*cols+x;
  const pointOf=id=>({x:zone.minX+(id%cols)*step,z:zone.minZ+Math.floor(id/cols)*step});
  const s=toCell(startX,startZ), goal=toCell(targetX,targetZ);
  let startId=idOf(s.x,s.z), goalId=idOf(goal.x,goal.z);
  const isCellWalkable=(cx,cz,id)=>id===startId || npcCanWalk(zone.minX+cx*step,zone.minZ+cz*step,zone);
  const goalPoint=pointOf(goalId);
  if (!npcCanWalk(goalPoint.x,goalPoint.z,zone)) return [];
  // If a newly bought fixture has appeared under an NPC, choose a nearby safe start cell so it can walk clear.
  if (!npcCanWalk(startX,startZ,zone)) {
    let best=null, bestDistance=Infinity;
    for(let radius=1;radius<=3&&!best;radius++) {
      for(let dz=-radius;dz<=radius;dz++) for(let dx=-radius;dx<=radius;dx++) {
        const cx=s.x+dx,cz=s.z+dz;
        if(cx<0||cx>=cols||cz<0||cz>=rows)continue;
        const p={x:zone.minX+cx*step,z:zone.minZ+cz*step};
        const d=Math.hypot(p.x-startX,p.z-startZ);
        if(d<bestDistance&&npcCanWalk(p.x,p.z,zone)){best={cx,cz,d};bestDistance=d;}
      }
    }
    if(best) startId=idOf(best.cx,best.cz);
  }
  if (startId===goalId) return [pointOf(goalId)];
  const heuristic=(a,b)=>{const ax=a%cols,az=Math.floor(a/cols),bx=b%cols,bz=Math.floor(b/cols);const dx=Math.abs(ax-bx),dz=Math.abs(az-bz);return Math.max(dx,dz)+(Math.SQRT2-1)*Math.min(dx,dz);};
  const open=[{id:startId,f:heuristic(startId,goalId)}], openSet=new Set([startId]);
  const cameFrom=new Int32Array(total); cameFrom.fill(-1);
  const gScore=new Float64Array(total); gScore.fill(Infinity); gScore[startId]=0;
  const closed=new Uint8Array(total);
  const dirs=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
  let found=false, iterations=0;
  while(open.length&&iterations++<1200) {
    open.sort((a,b)=>a.f-b.f);
    const current=open.shift(); if(!current)break;
    openSet.delete(current.id);
    if(current.id===goalId){found=true;break;}
    if(closed[current.id])continue; closed[current.id]=1;
    const cx=current.id%cols,cz=Math.floor(current.id/cols);
    for(const [dx,dz] of dirs) {
      const nx=cx+dx,nz=cz+dz;
      if(nx<0||nx>=cols||nz<0||nz>=rows)continue;
      const nid=idOf(nx,nz);
      if(closed[nid]||!isCellWalkable(nx,nz,nid))continue;
      if(dx&&dz&&(!npcCanWalk(zone.minX+(cx+dx)*step,zone.minZ+cz*step,zone)||!npcCanWalk(zone.minX+cx*step,zone.minZ+(cz+dz)*step,zone)))continue;
      const tentative=gScore[current.id]+(dx&&dz?Math.SQRT2:1);
      if(tentative>=gScore[nid])continue;
      cameFrom[nid]=current.id;gScore[nid]=tentative;
      const f=tentative+heuristic(nid,goalId);
      if(openSet.has(nid)){const item=open.find(n=>n.id===nid);if(item)item.f=f;}
      else {open.push({id:nid,f});openSet.add(nid);}
    }
  }
  if(!found)return [];
  const raw=[];let cursor=goalId;
  while(cursor!==-1){raw.push(pointOf(cursor));if(cursor===startId)break;cursor=cameFrom[cursor];}
  raw.reverse();
  if(!raw.length)return [];
  // Smooth the grid path by skipping intermediate nodes whenever the direct route is collision-free.
  const lineClear=(a,b)=>{
    const distance=Math.hypot(b.x-a.x,b.z-a.z), checks=Math.max(1,Math.ceil(distance/.28));
    for(let i=1;i<=checks;i++){const t=i/checks,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;if(!npcCanWalk(x,z,zone))return false;}
    return true;
  };
  const smooth=[];let anchor={x:startX,z:startZ},idx=0;
  while(idx<raw.length) {
    let far=idx;
    for(let j=raw.length-1;j>=idx;j--)if(lineClear(anchor,raw[j])){far=j;break;}
    if(far===idx&&!lineClear(anchor,raw[idx])){smooth.push(raw[idx]);anchor=raw[idx];idx++;continue;}
    smooth.push(raw[far]);anchor=raw[far];idx=far+1;
  }
  return smooth;
}
function chooseNpcDestination(g,time=0) {
  const data=g.userData,zone=data.zone;
  const fleeing=data.behavior==='suspect'&&currentJob==='police'&&!isDriving&&distanceXZ(g.position.x,g.position.z,playerPosition.x,playerPosition.z)<8.5;
  if(fleeing)data.fleeUntil=time+2.8;
  for(let tries=0;tries<22;tries++) {
    let targetX,targetZ;
    if(fleeing) {
      const awayX=g.position.x-playerPosition.x,awayZ=g.position.z-playerPosition.z;
      const len=Math.max(.001,Math.hypot(awayX,awayZ));
      const escapeDistance=3.0+Math.random()*2.5;
      targetX=THREE.MathUtils.clamp(g.position.x+awayX/len*escapeDistance+(Math.random()-.5)*1.6,zone.minX+.45,zone.maxX-.45);
      targetZ=THREE.MathUtils.clamp(g.position.z+awayZ/len*escapeDistance+(Math.random()-.5)*1.6,zone.minZ+.45,zone.maxZ-.45);
    } else {
      targetX=zone.minX+.7+Math.random()*Math.max(.1,zone.maxX-zone.minX-1.4);
      targetZ=zone.minZ+.7+Math.random()*Math.max(.1,zone.maxZ-zone.minZ-1.4);
    }
    if(Math.hypot(targetX-g.position.x,targetZ-g.position.z)<1.45)continue;
    const path=findNpcPath(g.position.x,g.position.z,targetX,targetZ,zone);
    if(path.length) {
      data.targetX=targetX;data.targetZ=targetZ;data.path=path;data.pathIndex=0;data.wait=0;
      return true;
    }
  }
  data.path=[];data.wait=.7;return false;
}
function npcRouteTo(g,x,z) {
  const data=g.userData;
  const path=findNpcPath(g.position.x,g.position.z,x,z,data.zone);
  if(!path.length){data.path=[];data.pathIndex=0;return false;}
  data.targetX=x;data.targetZ=z;data.path=path;data.pathIndex=0;data.wait=0;
  return true;
}
function availableCustomerProducts() {
  return itemKeys.filter(key=>{
    const item=gameState.inventory?.[key];
    if(!item||!gameState.fixtures?.shelves?.[key])return false;
    const slots=Array.isArray(item.shelfSlots)?item.shelfSlots:Array.from({length:Number(item.shelf)||0},(_,i)=>i);
    return slots.length>0;
  });
}
function clearCustomerProduct(g) {
  const data=g.userData,model=data.customerProductVisual;
  if(model?.parent)model.parent.remove(model);
  if(model)model.traverse(o=>{if(o.geometry)o.geometry.dispose();});
  data.customerProductVisual=null;data.customerProductKey=null;
}
function showCustomerProduct(g,key) {
  clearCustomerProduct(g);
  const arm=g.userData.npcArms?.find(a=>a.side===1);
  if(!arm?.elbow)return;
  const model=makeProductModel(key);model.scale.set(.42,.42,.42);model.position.set(0,-.235,-.12);
  arm.elbow.add(model);g.userData.customerProductVisual=model;g.userData.customerProductKey=key;
}
function customerRouteDone(data) {
  return !data.path||data.pathIndex>=data.path.length;
}
function beginCustomerExit(g) {
  const data=g.userData;
  data.customerState='leaving';
  if(!npcRouteTo(g,data.customerDoorX,10.2)){data.customerState='waiting';data.customerTimer=1.7;}
}
function purchaseFromCustomer(g) {
  const data=g.userData,key=data.customerProductKey;
  if(!key||!gameState.storeOpen||!gameState.fixtures?.register)return false;
  const item=gameState.inventory?.[key];
  const slots=Array.isArray(item?.shelfSlots)?[...item.shelfSlots]:Array.from({length:Number(item?.shelf)||0},(_,i)=>i);
  if(!item||!slots.length)return false;
  if(currentMode==='solo') {
    slots.pop();item.shelfSlots=slots;item.shelf=slots.length;
    const price=Math.max(0,Number(item.price)||0);
    gameState.balance=(Number(gameState.balance)||0)+price;
    gameState.totalSales=(Number(gameState.totalSales)||0)+price;
    renderState(gameState);
    return true;
  }
  if(currentMode==='multi'&&isRoomHost&&socket?.connected) {
    socket.emit('game:action',{type:'sell',product:key,paymentMethod:'cash'},result=>{
      if(result?.ok&&result.state)renderState(result.state);
    });
    return true;
  }
  return false;
}
function updateCustomerBehavior(g,dt,time) {
  const data=g.userData;
  // Only the room host can bill a shared customer in multiplayer.
  if(currentMode==='multi'&&(!isRoomHost||!socket?.connected))return;
  data.customerTimer=Math.max(0,(data.customerTimer||0)-dt);
  switch(data.customerState) {
    case 'waiting': {
      if(!gameState.storeOpen){data.customerTimer=Math.max(data.customerTimer,.9);return;}
      if(data.customerTimer>0)return;
      const available=availableCustomerProducts().sort(()=>Math.random()-.5);
      for(const key of available) {
        const shelfIndex=itemKeys.indexOf(key),sx=shelfXs[shelfIndex];
        const aisleX=sx+(shelfIndex===2?-1.3:1.3),aisleZ=3.15;
        if(npcRouteTo(g,aisleX,aisleZ)){data.customerProductKey=key;data.customerState='toShelf';return;}
      }
      data.customerTimer=1.5+Math.random()*2;
      return;
    }
    case 'toShelf':
      if(customerRouteDone(data)){data.customerState='browsing';data.customerTimer=1.1+Math.random()*1.0;}
      return;
    case 'browsing':
      if(data.customerTimer>0)return;
      if(data.customerProductKey)showCustomerProduct(g,data.customerProductKey);
      if(gameState.storeOpen&&gameState.fixtures?.register) {
        if(npcRouteTo(g,-3.35,-5.05))data.customerState='toCheckout';
        else beginCustomerExit(g);
      } else beginCustomerExit(g);
      return;
    case 'toCheckout':
      if(customerRouteDone(data)){data.customerState='checkingOut';data.customerTimer=1.15+Math.random()*.55;}
      return;
    case 'checkingOut':
      if(data.customerTimer>0)return;
      purchaseFromCustomer(g);
      beginCustomerExit(g);
      return;
    case 'leaving':
      if(customerRouteDone(data)){
        clearCustomerProduct(g);
        data.customerState='waiting';data.customerTimer=1.8+Math.random()*3.2;
      }
      return;
    default:
      data.customerState='waiting';data.customerTimer=1.2;
  }
}

function updateAmbient(dt,time) {
  if(!active||paused||(currentMode!=='multi'&&currentMode!=='solo'))return;
  npcGroups.forEach((g,i)=>{
    if(!g.visible)return;
    const data=g.userData,zone=data.zone;
    if(data.behavior==='worker') {
      // Small repeating work motions: mechanics inspect, technicians type, and couriers handle parcels.
      const phase=time*2.1+(data.workPhase||0);
      for(const arm of data.npcArms||[]) {
        const side=arm.side;
        arm.shoulder.rotation.x=Math.sin(phase+(side>0?0:Math.PI))*.22-.12;
        arm.shoulder.rotation.z=side*(data.workJob==='mechanic' ? 0.28 : data.workJob==='delivery' ? 0.18 : 0.12);
        arm.elbow.rotation.x=-.28+Math.sin(phase*1.3+side)*.2;
      }
      for(const leg of data.npcLegs||[]) { leg.hip.rotation.x=0; leg.knee.rotation.x=0; }
      data.body.position.y=1.02+Math.sin(phase)*.018;
      return;
    }
    const managedShopper=data.behavior==='shopper'&&(currentMode==='solo'||(currentMode==='multi'&&isRoomHost&&socket?.connected));
    if(managedShopper)updateCustomerBehavior(g,dt,time);
    data.wait=Math.max(0,(data.wait||0)-dt);
    let walking=false;
    const policeNear=data.behavior==='suspect'&&currentJob==='police'&&!isDriving&&distanceXZ(g.position.x,g.position.z,playerPosition.x,playerPosition.z)<8.5;
    if(policeNear&&(!data.fleeUntil||data.fleeUntil<=time)) {
      data.path=[];data.pathIndex=0;data.wait=0;
    }
    if(!managedShopper&&(!data.path||data.pathIndex>=data.path.length)&&data.wait<=0) {
      chooseNpcDestination(g,time);
      if(!data.path?.length)data.wait=.6+Math.random()*1.2;
    }
    const point=data.path?.[data.pathIndex];
    if(point) {
      const dx=point.x-g.position.x,dz=point.z-g.position.z,distance=Math.hypot(dx,dz);
      if(distance<.2) {
        data.pathIndex++;
        if(data.pathIndex>=data.path.length){data.path=[];data.wait=1.0+Math.random()*2.2;}
      } else {
        const desiredYaw=Math.atan2(-dx,-dz);
        let turn=desiredYaw-g.rotation.y;turn=Math.atan2(Math.sin(turn),Math.cos(turn));
        g.rotation.y+=turn*Math.min(1,dt*3.8);
        const speed=data.behavior==='suspect'?(data.fleeUntil>time?2.35:1.2):.78+(i%2)*.15;
        const step=Math.min(distance,speed*dt);
        const nx=g.position.x+dx/distance*step,nz=g.position.z+dz/distance*step;
        const crowding=npcGroups.some(other=>other!==g&&other.visible&&Math.hypot(other.position.x-nx,other.position.z-nz)<.52);
        if(!crowding&&npcCanWalk(nx,nz,zone)) {
          g.position.x=nx;g.position.z=nz;walking=true;
        } else if(!npcCanWalk(nx,nz,zone)) {
          data.path=[];data.pathIndex=0;data.wait=.25+Math.random()*.4;
        } else if(crowding) {
          // Yield to nearby people without discarding the current shopping destination.
          data.wait=.08;
        }
      }
    }
    const gait=data.walkPhase||data.phase;
    if(walking)data.walkPhase=gait+dt*(data.behavior==='suspect'&&data.fleeUntil>time?11:7.3);
    const phase=data.walkPhase||data.phase;
    const swing=walking?Math.sin(phase)*(data.behavior==='suspect'&&data.fleeUntil>time?.48:.34):0;
    for(const limb of data.npcLegs||[]) {
      const legPhase=phase+(limb.side<0?Math.PI:0);
      limb.hip.rotation.x=walking?Math.sin(legPhase)*.34:limb.hip.rotation.x+(0-limb.hip.rotation.x)*Math.min(1,dt*5);
      limb.knee.rotation.x=walking?Math.max(0,Math.sin(legPhase+Math.PI*.2))*.55:limb.knee.rotation.x+(0-limb.knee.rotation.x)*Math.min(1,dt*5);
    }
    for(const limb of data.npcArms||[]) {
      const armPhase=phase+(limb.side>0?Math.PI:0);
      limb.shoulder.rotation.x=walking?-Math.sin(armPhase)*.25:limb.shoulder.rotation.x+(0-limb.shoulder.rotation.x)*Math.min(1,dt*5);
      limb.elbow.rotation.x=walking?-.12-Math.max(0,Math.sin(armPhase))*.22:limb.elbow.rotation.x+(0-limb.elbow.rotation.x)*Math.min(1,dt*5);
    }
    if(data.body){data.body.rotation.x=walking?-.025:0;data.body.position.y=1.02+Math.abs(Math.sin(phase))*(walking?.018:.004);}
    if(data.head)data.head.rotation.y=walking?0:Math.sin(time*.65+data.phase)*.07;
  });
}
function updateDayNight() {
  const minutes=((Math.floor(Number(gameState?.gameMinutes)||480)%1440)+1440)%1440;
  const hour=minutes/60;
  const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
  const daylight=Math.min(smooth(5.2,8,hour),1-smooth(16.5,19.4,hour));
  const dawn=smooth(4.6,5.8,hour)*(1-smooth(6.7,8,hour));
  const dusk=smooth(16.4,17.8,hour)*(1-smooth(18.8,20.3,hour));
  const twilight=Math.max(dawn,dusk);
  if(hour<5)currentSkyColor.copy(nightSkyColor);
  else if(hour<6.6)currentSkyColor.lerpColors(nightSkyColor,duskSkyColor,smooth(5,6.6,hour));
  else if(hour<8)currentSkyColor.lerpColors(duskSkyColor,daySkyColor,smooth(6.6,8,hour));
  else if(hour<16.5)currentSkyColor.copy(daySkyColor);
  else if(hour<18.5)currentSkyColor.lerpColors(daySkyColor,duskSkyColor,smooth(16.5,18.5,hour));
  else if(hour<20.2)currentSkyColor.lerpColors(duskSkyColor,nightSkyColor,smooth(18.5,20.2,hour));
  else currentSkyColor.copy(nightSkyColor);
  scene.background.copy(currentSkyColor);scene.fog.color.copy(currentSkyColor);
  hemi.intensity=.3+daylight*1.7+twilight*.42;
  hemi.groundColor.copy(nightGroundColor).lerp(dayGroundColor,daylight);
  sun.intensity=.12+daylight*2.9+twilight*.58;
  sun.color.copy(nightSunColor).lerp(daySunColor,Math.min(1,daylight+twilight*.7));
  const angle=(hour-6)/12*Math.PI;
  sun.position.set(Math.cos(angle)*66,8+Math.sin(angle)*62,28);
  sun.castShadow=daylight>.12;
  for(const light of cityPointLights){light.intensity=.02+(1-daylight)*1.25+twilight*.12;light.visible=light.intensity>.18;}
  const lampMat=mats['lamp glow'];if(lampMat)lampMat.emissiveIntensity=.03+(1-daylight)*.36+twilight*.16;
  for(const windowMat of nightWindowMaterials)windowMat.emissiveIntensity=(1-daylight)*.5+twilight*.12;
}
let lastFrame=performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt=Math.min(.04,(now-lastFrame)/1000); lastFrame=now;
  updateMovement(dt); updateShoppingCart(dt); updateAmbient(dt,now/1000); updateDayNight(); updateNearestInteraction(); updateJobGuide();
  // Keep remote avatars readable as the camera moves.
  for (const avatar of remoteAvatars.values()) {
    animateAvatarModel(avatar,dt,performance.now()<(avatar.userData.remoteMoveUntil||0)&&!avatar.userData.driving,false);
    for (const tag of avatar.children) if (tag.userData?.billboard) tag.quaternion.copy(camera.quaternion);
  }
  for(const npc of npcGroups)for(const tag of npc.children)if(tag.userData?.billboard)tag.quaternion.copy(camera.quaternion);
  if (selfAvatar) for (const tag of selfAvatar.children) if (tag.userData?.billboard) tag.quaternion.copy(camera.quaternion);
  renderer.render(scene,camera);
}
requestAnimationFrame(animate);

window.addEventListener('resize', () => {
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.65)); renderer.setSize(innerWidth,innerHeight,false);
});

// Start with HUD hidden until a solo world or multiplayer room is selected.
setHudVisible(false);
$('chatPanel').classList.add('hidden');
renderState(gameState);

window.__SHAGHEEL_GAME_READY = true;
} catch (gameInitError) {
  showGameInitError(gameInitError);
}
