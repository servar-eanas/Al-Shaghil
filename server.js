import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] }, maxHttpBufferSize: 1e6, pingTimeout: 20000, pingInterval: 25000 });
const PORT = Number(process.env.PORT || 3000);
const SAVE_PATH = path.join(__dirname, 'saves.json');

// Health checks are called from the Netlify frontend during setup; explicitly allow this read-only request cross-origin.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, game: 'الشغيل', version: '1.1.0', socketIo: true }));

const JOB_IDS = new Set(['shopkeeper','mechanic','police','it','electronics','criminal','delivery','unassigned']);
const freshGame = () => ({
  schemaVersion: 9, balance: 200, day: 1, gameMinutes: 480, storeOpen: true, storeManualOverride: null, level: 1, totalSales: 0, capacity: 12, storageLevel: 0, easyStartGranted: true, cart: [], cartPose: { x: 6.35, z: 4.05, rot: 0 }, vehiclePose: {x:-8,z:18.6,rot:0},
  fixtures: { shelves:{water:true,chips:false,milk:false}, register:false, computer:true, cart:false, fridges:false, itBench:false, electronics:false },
  upgrades: { topShelf: false, warehouse: false, checkout: false, expansion: false },
  inventory: {
    water: { name: 'مياه', price: 4, cost: 2, pack: 6, stock: 6, shelf: 0, shelfSlots: [], color: '#62c3f5' },
    chips: { name: 'شيبس', price: 6, cost: 3, pack: 6, stock: 0, shelf: 0, shelfSlots: [], color: '#f5ad42' },
    milk: { name: 'حليب', price: 8, cost: 4, pack: 6, stock: 0, shelf: 0, shelfSlots: [], color: '#f0eee8' }
  }
});
function normalizeGame(data) {
  const base = freshGame();
  const needsStarterGrant = data?.easyStartGranted !== true;
  // Old prototypes are intentionally reset so the empty-shop start cannot inherit test money or free fixtures.
  if (!data || typeof data !== 'object' || data.schemaVersion !== 9) return base;
  const merged = { ...base, ...data, cart: Array.isArray(data.cart) ? data.cart.filter(k => ['water','chips','milk'].includes(k)) : [], cartPose: { ...base.cartPose, ...(data.cartPose || {}) }, vehiclePose: { ...base.vehiclePose, ...(data.vehiclePose || {}) }, fixtures: { ...base.fixtures, ...(data.fixtures || {}), shelves: { ...base.fixtures.shelves, ...(data.fixtures?.shelves || {}) } }, upgrades: { ...base.upgrades, ...(data.upgrades || {}) }, inventory: { ...base.inventory, ...(data.inventory || {}) } };
  if (!Number.isFinite(Number(merged.gameMinutes))) merged.gameMinutes = 480;
  if (typeof merged.storeOpen !== 'boolean') merged.storeOpen = merged.gameMinutes >= 480 && merged.gameMinutes < 1320;
  if (merged.storeManualOverride !== null && typeof merged.storeManualOverride !== 'boolean') merged.storeManualOverride = null;
  if (!merged.capacity) merged.capacity = merged.upgrades.topShelf ? 18 : 12;
  if (!merged.storageLevel) merged.storageLevel = merged.upgrades.warehouse ? 1 : 0;
  for (const key of Object.keys(base.inventory)) {
    const item = { ...base.inventory[key], ...(merged.inventory[key] || {}) };
    item.shelfSlots = Array.isArray(item.shelfSlots) ? item.shelfSlots : Array.from({ length: Math.max(0, Number(item.shelf) || 0) }, (_, i) => i);
    item.shelf = item.shelfSlots.length;
    item.stock = Math.max(0, Number(item.stock) || 0);
    merged.inventory[key] = item;
  }
  // Grant the beginner kit once to existing saved rooms while preserving all other progress.
  if (needsStarterGrant) {
    merged.balance = Math.max(0, Number(merged.balance) || 0) + 100;
    merged.fixtures.computer = true;
    merged.fixtures.shelves.water = true;
    const starterWater = merged.inventory.water;
    if (starterWater && (Number(starterWater.stock) || 0) < 1 && (Number(starterWater.shelf) || 0) < 1) starterWater.stock = 6;
    merged.easyStartGranted = true;
  }
  return merged;
}
const rooms = new Map();

function loadSaves() {
  try {
    const json = JSON.parse(fs.readFileSync(SAVE_PATH, 'utf8'));
    for (const [code, data] of Object.entries(json)) {
      rooms.set(code, { data: normalizeGame(data), players: new Map(), chat: [], cartHolderId: null, vehicleHolderId: null, hostId: null, lastGameTaskByPlayer: new Map() });
    }
  } catch { /* first launch */ }
}
function saveRooms() {
  const out = {};
  for (const [code, room] of rooms) out[code] = room.data;
  try { fs.writeFileSync(SAVE_PATH, JSON.stringify(out, null, 2)); } catch (err) { console.error('Save failed:', err.message); }
}
function makeCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join(''); }
  while (rooms.has(code));
  return code;
}
function cleanName(value) {
  const name = String(value || 'لاعب جديد').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 18);
  return name || 'لاعب جديد';
}
function publicPlayer(p, room = null) { return { id: p.id, name: p.name, x: p.x, z: p.z, rot: p.rot, voiceReady: !!p.voiceReady, color: p.color, heldItem: p.heldItem || null, job: JOB_IDS.has(p.job) ? p.job : 'unassigned', wanted: !!p.wanted, driving: !!p.driving, isHost: room ? room.hostId === p.id : !!p.isHost }; }
function getState(room) { return { ...room.data, cart: [...(room.data.cart || [])], upgrades: { ...(room.data.upgrades || {}) }, inventory: Object.fromEntries(Object.entries(room.data.inventory).map(([k,v]) => [k, { ...v, shelfSlots: [...(v.shelfSlots || [])] }])) }; }
function getPlayers(room, exceptId = null) { return [...room.players.values()].filter(p => p.id !== exceptId).map(p => publicPlayer(p, room)); }
function getAllRoomPlayers(room) { return [...room.players.values()].map(p => publicPlayer(p, room)); }
function broadcastState(code, room) { io.to(code).emit('room:state', getState(room)); saveRooms(); }
function firstFreeSlot(item, capacity) {
  const slots = Array.isArray(item.shelfSlots) ? item.shelfSlots : [];
  for (let i = 0; i < capacity; i++) if (!slots.includes(i)) return i;
  return -1;
}
function returnPlayerGoods(room, player) {
  let changed = false;
  const returnOne = key => {
    const item = room.data.inventory[key]; if (!item) return;
    item.shelfSlots = Array.isArray(item.shelfSlots) ? item.shelfSlots : [];
    const slot = firstFreeSlot(item, room.data.capacity || 12);
    if (slot >= 0) { item.shelfSlots.push(slot); item.shelf = item.shelfSlots.length; }
    else item.stock = (Number(item.stock) || 0) + 1;
    changed = true;
  };
  if (player.heldItem) {
    const item = room.data.inventory[player.heldItem];
    if (item) {
      if (player.heldSource === 'stock') item.stock = (Number(item.stock) || 0) + 1;
      else if (player.heldSlot != null && !item.shelfSlots.includes(player.heldSlot)) { item.shelfSlots.push(player.heldSlot); item.shelf = item.shelfSlots.length; }
      else returnOne(player.heldItem);
      changed = true;
    }
  }
  player.heldItem = null; player.heldSource = null; player.heldSlot = null; player.cart = [];
  return changed;
}
function leaveRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  if (room) {
    const player = room.players.get(socket.id);
    const changed = player ? returnPlayerGoods(room, player) : false;
    const releasedCart = room.cartHolderId === socket.id;
    if (releasedCart) room.cartHolderId = null;
    const releasedVehicle = room.vehicleHolderId === socket.id;
    if (releasedVehicle) { room.vehicleHolderId = null; if (player) { player.driving = false; const pose=room.data.vehiclePose || {x:-8,z:18.6,rot:0}; player.x=pose.x-.15; player.z=pose.z+1.45; player.rot=(Number(pose.rot)||0)-Math.PI/2; } }
    room.players.delete(socket.id);
    if (room.hostId === socket.id) {
      room.hostId = room.players.keys().next().value || null;
      for (const p of room.players.values()) p.isHost = p.id === room.hostId;
      if (room.hostId) io.to(code).emit('room:system', { text: 'منشئ الغرفة خرج؛ تم نقل صلاحية المضيف إلى لاعب آخر.' });
    }
    socket.leave(code);
    io.to(code).emit('room:player-left', { id: socket.id, name: player?.name || '' });
    io.to(code).emit('room:players', getAllRoomPlayers(room));
    if (releasedCart) { saveRooms(); io.to(code).emit('room:cart-state', { holderId: null, pose: room.data.cartPose }); }
    if (releasedVehicle) { saveRooms(); io.to(code).emit('vehicle:state', {holderId:null, pose:room.data.vehiclePose}); io.to(code).emit('room:players', getAllRoomPlayers(room)); }
    if (changed) broadcastState(code, room);
  }
  socket.data.roomCode = null;
}

loadSaves();

io.on('connection', socket => {
  socket.data.roomCode = null;

  socket.on('room:create', (payload = {}, ack = () => {}) => {
    leaveRoom(socket);
    const code = makeCode();
    const room = { data: freshGame(), players: new Map(), chat: [], cartHolderId: null, vehicleHolderId: null, hostId: socket.id, lastGameTaskByPlayer: new Map() };
    rooms.set(code, room);
    const player = { id: socket.id, name: cleanName(payload.name), x: 0, z: 4.1, rot: 0, voiceReady: false, color: '#78c6a3', job: 'shopkeeper', isHost: true, wanted: false, driving: false, heldItem: null, heldSource: null, heldSlot: null, wallet: 100, cart: [] };
    room.players.set(socket.id, player);
    socket.data.roomCode = code;
    socket.data.playerName = player.name;
    socket.join(code);
    saveRooms();
    ack({ ok: true, code, hostId: room.hostId, isHost: true, roomPlayers: getAllRoomPlayers(room), cartHolderId: room.cartHolderId, vehicleHolderId: room.vehicleHolderId, state: getState(room), players: getPlayers(room), self: { ...publicPlayer(player, room), heldItem: player.heldItem, heldSource: player.heldSource, heldSlot: player.heldSlot, cart: [...player.cart] }, chat: room.chat });
    io.to(code).emit('room:players', getAllRoomPlayers(room));
    socket.emit('room:system', { text: `أنشأت الغرفة ${code}. أنت المضيف: وزّع الوظائف وافتح أو أغلق الدكان من لوحة الإدارة.` });
  });

  socket.on('room:join', (payload = {}, ack = () => {}) => {
    leaveRoom(socket);
    const code = String(payload.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    const room = rooms.get(code);
    if (!room) return ack({ ok: false, error: 'الغرفة غير موجودة. تأكد من الرمز أو أنشئ غرفة جديدة.' });
    if (room.players.size >= 10) return ack({ ok: false, error: 'الغرفة ممتلئة (الحد الأقصى 10 لاعبين حالياً).' });
    if (!room.hostId || !room.players.has(room.hostId)) { room.hostId = room.players.keys().next().value || socket.id; }
    const willBeHost = room.players.size === 0 || room.hostId === socket.id;
    const player = { id: socket.id, name: cleanName(payload.name), x: Math.random() * 2 - 1, z: 4.1, rot: 0, voiceReady: false, color: ['#78c6a3','#85a8ff','#ffbd69','#d5a1ff','#ff8f9a'][room.players.size % 5], job: willBeHost ? 'shopkeeper' : 'unassigned', isHost: willBeHost, wanted: false, driving: false, wallet: 100, heldItem: null, heldSource: null, heldSlot: null, cart: [] };
    if (willBeHost) room.hostId = socket.id;
    room.players.set(socket.id, player);
    socket.data.roomCode = code;
    socket.data.playerName = player.name;
    socket.join(code);
    ack({ ok: true, code, hostId: room.hostId, isHost: room.hostId === socket.id, roomPlayers: getAllRoomPlayers(room), cartHolderId: room.cartHolderId, vehicleHolderId: room.vehicleHolderId, state: getState(room), players: getPlayers(room, socket.id), self: { ...publicPlayer(player, room), heldItem: player.heldItem, heldSource: player.heldSource, heldSlot: player.heldSlot, cart: [...player.cart] }, chat: room.chat });
    socket.to(code).emit('room:player-joined', publicPlayer(player, room));
    io.to(code).emit('room:players', getAllRoomPlayers(room));
    socket.to(code).emit('chat:message', { system: true, text: `${player.name} دخل العالم`, time: Date.now() });
  });

  socket.on('room:leave', () => leaveRoom(socket));

  socket.on('cart:claim', (payload = {}, ack = () => {}) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    const player = room?.players.get(socket.id);
    if (!room || !player) return ack({ ok: false, error: 'لا توجد غرفة نشطة.' });
    if (!room.data.fixtures?.cart) return ack({ ok: false, error: 'لم يشترِ أحد العربة بعد؛ افتح كتالوج تجهيزات الدكان.' });
    if (room.cartHolderId && room.cartHolderId !== socket.id) return ack({ ok: false, error: 'العربة مع لاعب آخر حالياً.' });
    const pose = room.data.cartPose || { x: 6.35, z: 4.05, rot: 0 };
    if (Math.hypot(player.x - pose.x, player.z - pose.z) > 3.0) return ack({ ok: false, error: 'اقترب من العربة أولاً.' });
    room.cartHolderId = socket.id;
    const data = { holderId: socket.id, pose: { ...pose } };
    io.to(code).emit('room:cart-state', data);
    ack({ ok: true, ...data });
  });

  socket.on('cart:move', payload => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.cartHolderId !== socket.id || !payload) return;
    const old = room.data.cartPose || { x: 6.35, z: 4.05, rot: 0 };
    const x = Number(payload.x), z = Number(payload.z), rot = Number(payload.rot);
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(rot)) return;
    if (x < -58 || x > 58 || z < -52 || z > 57) return;
    if (Math.hypot(x - old.x, z - old.z) > 3.5) return;
    room.data.cartPose = { x, z, rot: Math.max(-Math.PI * 4, Math.min(Math.PI * 4, rot)) };
    socket.to(code).volatile.emit('cart:moved', { holderId: socket.id, pose: { ...room.data.cartPose } });
  });

  socket.on('cart:release', (payload = {}, ack = () => {}) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.cartHolderId !== socket.id) return ack({ ok: false, error: 'أنت لا تمسك العربة.' });
    room.cartHolderId = null;
    saveRooms();
    const data = { holderId: null, pose: { ...(room.data.cartPose || { x: 6.35, z: 4.05, rot: 0 }) } };
    io.to(code).emit('room:cart-state', data);
    ack({ ok: true, ...data });
  });

  socket.on('player:move', payload => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    const p = room?.players.get(socket.id);
    if (!p || !payload) return;
    if (!p.driving) {
      p.x = Math.max(-57, Math.min(57, Number(payload.x) || 0));
      p.z = Math.max(-51, Math.min(56, Number(payload.z) || 0));
      p.rot = Number(payload.rot) || 0;
    }
    socket.to(code).volatile.emit('player:moved', { ...publicPlayer(p, room), x: p.x, z: p.z, rot: p.rot, heldItem: p.heldItem || null });
  });

  socket.on('game:action', (payload = {}, ack = () => {}) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    const actor = room?.players.get(socket.id);
    if (!room || !actor) return ack({ ok: false, error: 'لا توجد غرفة نشطة.' });
    const game = room.data;
    const type = String(payload.type || '');
    const productKey = String(payload.product || 'water');
    const item = game.inventory[productKey];
    const method = payload.paymentMethod === 'visa' ? 'Visa' : 'نقداً';
    let message = '';

    if (type === 'build') {
      const fixtureType = String(payload.fixtureType || '');
      const builds = {
        shelf: { cost:25, title:`رف ${item?.name || ''}`, done:!!game.fixtures?.shelves?.[productKey] },
        register: { cost:20, title:'الكاشير', done:!!game.fixtures?.register },
        computer: { cost:15, title:'حاسوب إدارة الدكان', done:!!game.fixtures?.computer },
        cart: { cost:10, title:'عربة التسوق', done:!!game.fixtures?.cart },
        fridges: { cost:45, title:'ثلاجات العرض', done:!!game.fixtures?.fridges },
        itBench: { cost:45, title:'طاولة صيانة IT', done:!!game.fixtures?.itBench },
        electronics: { cost:55, title:'ركن صيانة الإلكترونيات', done:!!game.fixtures?.electronics }
      };
      const build = builds[fixtureType];
      if (!build) return ack({ ok:false, error:'نوع التجهيز غير معروف.' });
      if (build.done) return ack({ ok:false, error:'هذا التجهيز موجود بالفعل.' });
      if (game.balance < build.cost) return ack({ ok:false, error:`رصيد العالم لا يكفي؛ تحتاج $${build.cost} لشراء ${build.title}.` });
      game.fixtures ||= { shelves:{water:false,chips:false,milk:false}, register:false, computer:false, cart:false, fridges:false, itBench:false, electronics:false };
      game.fixtures.shelves ||= {water:false,chips:false,milk:false};
      if (fixtureType === 'shelf') game.fixtures.shelves[productKey] = true; else game.fixtures[fixtureType] = true;
      game.balance -= build.cost; game.level += 1;
      message = `اشترى ${actor.name} ${build.title} بـ$${build.cost}؛ أصبح متاحاً لكل أعضاء الغرفة.`;
    } else if (type === 'order') {
      if (!game.fixtures?.computer) return ack({ ok:false, error:'اشترِ حاسوب الإدارة من كتالوج التجهيزات أولاً.' });
      if (!game.storeOpen) return ack({ ok:false, error:'الدكان مغلق، افتحه أولاً لطلب البضاعة.' });
      if (!item) return ack({ ok: false, error: 'اختر منتجاً أولاً.' });
      const quantity = Number(item.pack || 6);
      const cost = Number(item.cost || 2) * quantity;
      if (game.balance < cost) return ack({ ok: false, error: `رصيد العالم لا يكفي. تحتاج إلى $${cost} لشراء ${quantity} حبات من ${item.name}.` });
      game.balance -= cost; item.stock = (Number(item.stock) || 0) + quantity;
      message = `تم شراء ${quantity} حبات من ${item.name} بالدفع ${method} مقابل $${cost}.`;
    } else if (type === 'pickStock') {
      if (actor.heldItem) return ack({ ok: false, error: 'يداك مشغولتان. ضع المنتج أولاً.' });
      if (!item) return ack({ ok: false, error: 'المنتج غير معروف.' });
      if (item.stock < 1) return ack({ ok: false, error: `مخزون ${item.name} فارغ. اطلب بضاعة من الحاسوب.` });
      item.stock--; actor.heldItem = productKey; actor.heldSource = 'stock'; actor.heldSlot = null;
      message = `أمسكت ${item.name} من المخزن. اقترب من الرف واضغط E لوضعه.`;
    } else if (type === 'pickShelf') {
      if (!game.fixtures?.shelves?.[productKey]) return ack({ ok:false, error:'لم يتم شراء هذا الرف بعد.' });
      if (actor.heldItem) return ack({ ok: false, error: 'يداك مشغولتان. ضع المنتج أولاً.' });
      if (!item) return ack({ ok: false, error: 'المنتج غير معروف.' });
      item.shelfSlots = Array.isArray(item.shelfSlots) ? item.shelfSlots : Array.from({ length: item.shelf || 0 }, (_, i) => i);
      const slot = Number(payload.slot);
      if (!item.shelfSlots.includes(slot)) return ack({ ok: false, error: 'هذا المكان فارغ الآن؛ حدّث الرف واختر قطعة أخرى.' });
      item.shelfSlots = item.shelfSlots.filter(s => s !== slot); item.shelf = item.shelfSlots.length;
      actor.heldItem = productKey; actor.heldSource = 'shelf'; actor.heldSlot = slot;
      message = `أخذت ${item.name} من الرف. ضعها في العربة أو أعدها إلى رف.`;
    } else if (type === 'placeShelf') {
      const heldKey = actor.heldItem;
      if (!heldKey || !game.fixtures?.shelves?.[heldKey]) return ack({ ok:false, error:'اشترِ رفاً لهذا الصنف أولاً.' });
      if (!heldKey || !game.inventory[heldKey]) return ack({ ok: false, error: 'لا تحمل منتجاً الآن.' });
      if (payload.shelfProduct && payload.shelfProduct !== heldKey) return ack({ ok: false, error: 'لا يمكن وضع المنتج في رف من نوع مختلف.' });
      const held = game.inventory[heldKey];
      held.shelfSlots = Array.isArray(held.shelfSlots) ? held.shelfSlots : [];
      if (held.shelf >= (game.capacity || 12)) return ack({ ok: false, error: 'الرف ممتلئ. طوّر المتجر لفتح خانات إضافية.' });
      const slot = firstFreeSlot(held, game.capacity || 12);
      if (slot < 0) return ack({ ok: false, error: 'لا توجد خانة فارغة على الرف.' });
      held.shelfSlots.push(slot); held.shelf = held.shelfSlots.length;
      actor.heldItem = null; actor.heldSource = null; actor.heldSlot = null;
      message = `وضعت ${held.name} في الرف فعلياً.`;
    } else if (type === 'returnHeld') {
      if (!actor.heldItem) return ack({ ok: false, error: 'لا تحمل منتجاً الآن.' });
      const heldKey = actor.heldItem, held = game.inventory[heldKey];
      if (held) {
        held.shelfSlots = Array.isArray(held.shelfSlots) ? held.shelfSlots : [];
        if (actor.heldSource === 'stock') held.stock = (Number(held.stock) || 0) + 1;
        else {
          const preferred = Number(actor.heldSlot);
          if (actor.heldSlot != null && preferred >= 0 && preferred < (game.capacity || 12) && !held.shelfSlots.includes(preferred)) held.shelfSlots.push(preferred);
          else { const free = firstFreeSlot(held, game.capacity || 12); if (free >= 0) held.shelfSlots.push(free); else held.stock = (Number(held.stock) || 0) + 1; }
          held.shelf = held.shelfSlots.length;
        }
      }
      actor.heldItem = null; actor.heldSource = null; actor.heldSlot = null;
      message = 'أعدت المنتج إلى مكانه.';
    } else if (type === 'addToCart') {
      if (!actor.heldItem) return ack({ ok: false, error: 'التقط منتجاً أولاً.' });
      game.cart = Array.isArray(game.cart) ? game.cart : [];
      game.cart.push(actor.heldItem);
      message = `وضعت ${game.inventory[actor.heldItem]?.name || 'المنتج'} في عربة التسوق المشتركة.`;
      actor.heldItem = null; actor.heldSource = null; actor.heldSlot = null;
    } else if (type === 'checkout') {
      if (!game.fixtures?.register) return ack({ok:false,error:'اشترِ الكاشير أولاً من كتالوج التجهيزات.'});
      if (!game.storeOpen) return ack({ok:false,error:'الدكان مغلق؛ لا يمكن المحاسبة.'});
      if (!game.fixtures?.cart) return ack({ok:false,error:'اشترِ العربة أولاً.'});
      game.cart = Array.isArray(game.cart) ? game.cart : [];
      if (!game.cart.length) return ack({ ok: false, error: 'عربة التسوق فارغة.' });
      const total = game.cart.reduce((sum, key) => sum + Number(game.inventory[key]?.price || 0), 0);
      if (game.balance < total) return ack({ ok: false, error: `لا يوجد رصيد كافٍ. إجمالي العربة ${total} دولاراً ورصيد العالم ${game.balance} دولار.` });
      game.balance -= total;
      const count = game.cart.length; game.cart = [];
      message = `تمت المحاسبة ${method} بنجاح — ${count} قطعة بإجمالي $${total}. خزنة الغرفة مشتركة.`;
    } else if (type === 'sell') {
      if (!game.fixtures?.register) return ack({ok:false,error:'اشترِ الكاشير أولاً من كتالوج التجهيزات.'});
      if (!game.storeOpen) return ack({ok:false,error:'الدكان مغلق؛ لا يمكن البيع الآن.'});
      if (!item) return ack({ ok: false, error: 'المنتج غير معروف.' });
      item.shelfSlots = Array.isArray(item.shelfSlots) ? item.shelfSlots : Array.from({ length: item.shelf || 0 }, (_, i) => i);
      if (!item.shelfSlots.length) return ack({ ok: false, error: `رف ${item.name} فارغ. عبّئه أولاً.` });
      item.shelfSlots.pop(); item.shelf = item.shelfSlots.length;
      game.balance += item.price; game.totalSales += item.price;
      message = `تم بيع ${item.name} للزبون واستلام $${item.price} عبر ${method}. خزنة العالم مشتركة.`;
    } else if (type === 'upgrade') {
      const upgradeType = String(payload.upgradeType || 'topShelf');
      const options = {
        topShelf: { cost: 150, title: 'فتح الرف العلوي' },
        warehouse: { cost: 80, title: 'توسعة المستودع' },
        checkout: { cost: 250, title: 'كاشير إضافي' },
        expansion: { cost: 500, title: 'توسعة مساحة المتجر' }
      };
      const opt = options[upgradeType];
      if (!opt) return ack({ ok: false, error: 'نوع التطوير غير معروف.' });
      game.upgrades ||= { topShelf: false, warehouse: false, checkout: false, expansion: false };
      if (game.upgrades[upgradeType]) return ack({ ok: false, error: 'هذا التطوير موجود بالفعل.' });
      if (game.balance < opt.cost) return ack({ ok: false, error: `تحتاج إلى $${opt.cost} لتطوير ${opt.title}.` });
      game.balance -= opt.cost; game.upgrades[upgradeType] = true; game.level += 1;
      if (upgradeType === 'topShelf') game.capacity = 18;
      if (upgradeType === 'warehouse') { game.storageLevel = 1; for (const v of Object.values(game.inventory)) v.pack = 12; }
      message = `تم ${opt.title} بنجاح. أثر التطوير ظاهر الآن في العالم.`;
    } else {
      return ack({ ok: false, error: 'عملية غير معروفة.' });
    }

    broadcastState(code, room);
    io.to(code).emit('room:player-updated', publicPlayer(actor, room));
    io.to(code).emit('game:notice', { text: message, actor: actor.name || 'لاعب' });
    ack({ ok: true, message, state: getState(room), heldItem: actor.heldItem, heldSource: actor.heldSource, heldSlot: actor.heldSlot, cart: [...(game.cart || [])] });
  });

  socket.on('job:assign', (payload = {}, ack = () => {}) => {
    const code = socket.data.roomCode, room = rooms.get(code);
    if (!room || !room.players.has(socket.id)) return ack({ok:false,error:'لا توجد غرفة نشطة.'});
    if (room.hostId !== socket.id) return ack({ok:false,error:'منشئ الغرفة فقط يستطيع توزيع الوظائف.'});
    const target = room.players.get(String(payload.playerId || ''));
    const job = String(payload.job || 'unassigned');
    if (!target) return ack({ok:false,error:'اللاعب غير موجود في الغرفة.'});
    if (!JOB_IDS.has(job)) return ack({ok:false,error:'الوظيفة غير معروفة.'});
    target.job = job; target.wanted = job === 'criminal' ? target.wanted : false;
    io.to(code).emit('room:player-updated', publicPlayer(target, room));
    io.to(code).emit('room:players', getAllRoomPlayers(room));
    io.to(code).emit('room:system', {text:`تم تعيين ${target.name} في وظيفة ${job === 'shopkeeper' ? 'صاحب الدكان' : job === 'mechanic' ? 'الميكانيكي' : job === 'police' ? 'الشرطة' : job === 'it' ? 'فني IT' : job === 'electronics' ? 'فني إلكترونيات' : job === 'criminal' ? 'مشتبه به' : job === 'delivery' ? 'مندوب توصيل' : 'بانتظار التعيين'}.`});
    ack({ok:true,message:`تم تعيين ${target.name} في الوظيفة المطلوبة.`});
  });

  socket.on('store:toggle', (payload = {}, ack = () => {}) => {
    const code = socket.data.roomCode, room = rooms.get(code);
    if (!room || !room.players.has(socket.id)) return ack({ok:false,error:'لا توجد غرفة نشطة.'});
    if (room.hostId !== socket.id) return ack({ok:false,error:'منشئ الغرفة فقط يستطيع فتح الدكان أو إغلاقه.'});
    const open = !!payload.open;
    room.data.storeOpen = open; room.data.storeManualOverride = open;
    io.to(code).emit('room:clock', {gameMinutes:room.data.gameMinutes,day:room.data.day,storeOpen:room.data.storeOpen,storeManualOverride:room.data.storeManualOverride});
    broadcastState(code, room);
    const message = open ? 'فتح منشئ الغرفة الدكان.' : 'أغلق منشئ الغرفة الدكان.';
    io.to(code).emit('room:system',{text:message}); ack({ok:true,message});
  });

  socket.on('store:schedule', (_payload = {}, ack = () => {}) => {
    const code = socket.data.roomCode, room = rooms.get(code);
    if (!room || !room.players.has(socket.id)) return ack({ok:false,error:'لا توجد غرفة نشطة.'});
    if (room.hostId !== socket.id) return ack({ok:false,error:'منشئ الغرفة فقط يستطيع تغيير الدوام.'});
    room.data.storeManualOverride = null;
    room.data.storeOpen = room.data.gameMinutes >= 480 && room.data.gameMinutes < 1320;
    broadcastState(code, room);
    io.to(code).emit('room:clock', {gameMinutes:room.data.gameMinutes,day:room.data.day,storeOpen:room.data.storeOpen,storeManualOverride:null});
    const message = 'عاد الدكان إلى الدوام التلقائي: يفتح 08:00 ويغلق 22:00.';
    io.to(code).emit('room:system',{text:message}); ack({ok:true,message});
  });

  socket.on('job:task', (payload = {}, ack = () => {}) => {
    const code = socket.data.roomCode, room = rooms.get(code), actor = room?.players.get(socket.id);
    if (!room || !actor) return ack({ok:false,error:'لا توجد غرفة نشطة.'});
    const job = String(payload.job || '');
    if (!JOB_IDS.has(job) || job === 'unassigned' || actor.job !== job) return ack({ok:false,error:'هذه المهمة ليست ضمن وظيفتك الحالية.'});
    const now = Date.now(), last = room.lastGameTaskByPlayer.get(socket.id) || 0;
    if (now-last < 8000) return ack({ok:false,error:'استرح قليلاً قبل تنفيذ المهمة التالية.'});
    const points = {shopkeeper:[-2.15,-5.15],mechanic:[-34,11.25],it:[22,12.25],electronics:[34,11.55],delivery:[-42,11.25],criminal:[13,23.3]};
    let valid = false, message = '', reward = 0;
    if (job === 'police') {
      const nearNpc = Math.hypot(actor.x-6, actor.z-22) < 5.8;
      const wanted = [...room.players.values()].find(p => p.id !== actor.id && p.wanted && Math.hypot(actor.x-p.x, actor.z-p.z) < 4.0);
      valid = !!nearNpc || !!wanted;
      if (valid && wanted) { wanted.wanted = false; io.to(code).emit('room:player-updated', publicPlayer(wanted, room)); io.to(code).emit('room:players', getAllRoomPlayers(room)); }
      reward = 40; message = wanted ? `ألقى ${actor.name} القبض على ${wanted.name}.` : `أنهى ${actor.name} بلاغ المشتبه به.`;
    } else if (job === 'criminal') {
      const [x,z] = points.criminal; valid = Math.hypot(actor.x-x, actor.z-z) < 4.0;
      if (valid) { actor.wanted = true; actor.wallet = (Number(actor.wallet)||100) + 25; io.to(code).emit('room:player-updated', publicPlayer(actor, room)); io.to(code).emit('room:players', getAllRoomPlayers(room)); }
      reward = 0; message = `سرق ${actor.name} شحنة أجهزة وأصبح مطلوباً للشرطة.`;
    } else {
      const [x,z] = points[job] || [999,999]; valid = Math.hypot(actor.x-x, actor.z-z) < 4.5;
      reward = ({mechanic:28,it:32,electronics:30,delivery:24,shopkeeper:16})[job] || 20;
      message = ({mechanic:`أكمل ${actor.name} صيانة مركبة`,it:`أصلح ${actor.name} حاسوباً`,electronics:`أصلح ${actor.name} جهازاً إلكترونياً`,delivery:`سلّم ${actor.name} طلبية`,shopkeeper:`أنجز ${actor.name} أعمال الدكان`})[job] || 'تم إنجاز العمل';
    }
    if (!valid) return ack({ok:false,error:job==='police'?'اقترب من المشتبه به أو من لاعب مطلوب.':'اقترب من موقع عملك ثم جرّب مرة أخرى.'});
    room.lastGameTaskByPlayer.set(socket.id, now);
    if (reward > 0) { room.data.balance += reward; room.data.totalSales += reward; actor.wallet = (Number(actor.wallet)||100) + reward; }
    broadcastState(code, room);
    io.to(code).emit('room:system',{text:`${message}${reward ? ` · دخل الخزنة المشتركة +$${reward}` : ''}`});
    ack({ok:true,message:`${message}${reward ? ` — أُضيف $${reward} إلى خزنة العالم.` : ''}`,reward,wallet:actor.wallet,wanted:!!actor.wanted});
  });

  socket.on('vehicle:claim', (_payload = {}, ack = () => {}) => {
    const code = socket.data.roomCode, room = rooms.get(code), player = room?.players.get(socket.id);
    if (!room || !player) return ack({ok:false,error:'لا توجد غرفة نشطة.'});
    if (player.job !== 'police') return ack({ok:false,error:'سيارة الدورية متاحة للاعب الذي عُيّن في وظيفة الشرطة.'});
    if (room.vehicleHolderId && room.vehicleHolderId !== socket.id) return ack({ok:false,error:'سيارة الدورية يقودها لاعب آخر حالياً.'});
    const pose = room.data.vehiclePose || {x:-8,z:18.6,rot:0};
    if (Math.hypot(player.x-pose.x, player.z-pose.z) > 4.5) return ack({ok:false,error:'اقترب من سيارة الدورية أولاً.'});
    room.vehicleHolderId = socket.id; player.driving = true; player.x=pose.x; player.z=pose.z; player.rot=(Number(pose.rot)||0)-Math.PI/2;
    const data = {holderId:socket.id,pose:{...pose}};
    io.to(code).emit('vehicle:state',data); io.to(code).emit('room:player-updated',publicPlayer(player,room)); io.to(code).emit('room:players',getAllRoomPlayers(room));
    ack({ok:true,...data});
  });

  socket.on('vehicle:move', payload => {
    const code = socket.data.roomCode, room = rooms.get(code), player = room?.players.get(socket.id);
    if (!room || !player || room.vehicleHolderId !== socket.id || !player.driving || !payload) return;
    const old = room.data.vehiclePose || {x:-8,z:18.6,rot:0};
    const x=Number(payload.x), z=Number(payload.z), rot=Number(payload.rot);
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(rot)) return;
    if (x < -56 || x > 56 || z < -50 || z > 55) return;
    // Reject teleport-sized movement while tolerating ordinary websocket jitter.
    if (Math.hypot(x-old.x,z-old.z) > 5.5) return;
    room.data.vehiclePose={x,z,rot:Math.max(-Math.PI*20,Math.min(Math.PI*20,rot))};
    player.x=x; player.z=z; player.rot=room.data.vehiclePose.rot-Math.PI/2;
    socket.to(code).volatile.emit('vehicle:moved',{holderId:socket.id,pose:{...room.data.vehiclePose}});
    socket.to(code).volatile.emit('player:moved',publicPlayer(player,room));
  });

  socket.on('vehicle:release', (_payload = {}, ack = () => {}) => {
    const code=socket.data.roomCode, room=rooms.get(code), player=room?.players.get(socket.id);
    if (!room || !player || room.vehicleHolderId !== socket.id) return ack({ok:false,error:'أنت لا تقود سيارة الدورية.'});
    const pose=room.data.vehiclePose || {x:-8,z:18.6,rot:0};
    room.vehicleHolderId=null; player.driving=false; player.x=pose.x-.15; player.z=pose.z+1.45; player.rot=(Number(pose.rot)||0)-Math.PI/2;
    saveRooms();
    io.to(code).emit('vehicle:state',{holderId:null,pose:{...pose}}); io.to(code).emit('room:player-updated',publicPlayer(player,room)); io.to(code).emit('room:players',getAllRoomPlayers(room));
    ack({ok:true,pose:{...pose}});
  });

  socket.on('chat:send', payload => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;
    const text = String(payload?.text || '').replace(/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, 300);
    if (!text) return;
    const message = { id: `${Date.now()}-${socket.id}`, name: socket.data.playerName || 'لاعب', text, time: Date.now(), system: false };
    room.chat.push(message);
    if (room.chat.length > 80) room.chat.shift();
    io.to(code).emit('chat:message', message);
  });

  socket.on('voice:status', payload => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    const player = room?.players.get(socket.id);
    if (!player) return;
    player.voiceReady = !!payload?.ready;
    io.to(code).emit('voice:status', { id: socket.id, ready: player.voiceReady });
  });
  socket.on('voice:signal', payload => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    const target = room?.players.get(String(payload?.to || ''));
    if (!room || !target || !payload?.data) return;
    io.to(target.id).emit('voice:signal', { from: socket.id, data: payload.data });
  });

  socket.on('disconnect', () => leaveRoom(socket));
});

// The authoritative shared clock advances on the server, so every player sees the same time.
let clockTicks = 0;
setInterval(() => {
  for (const [code, room] of rooms) {
    if (!room.players.size) continue;
    const game = room.data;
    const previousOpen = !!game.storeOpen;
    const prev = Number(game.gameMinutes) || 480;
    game.gameMinutes = (prev + 1) % 1440;
    if (game.gameMinutes < prev) game.day = (Number(game.day) || 1) + 1;
    if (game.storeManualOverride === null) game.storeOpen = game.gameMinutes >= 480 && game.gameMinutes < 1320;
    if (previousOpen !== !!game.storeOpen) io.to(code).emit('room:system', {text: game.storeOpen ? 'بدأ دوام الدكان — الساعة 08:00.' : 'انتهى دوام الدكان — الساعة 22:00.'});
    io.to(code).emit('room:clock', {gameMinutes:game.gameMinutes,day:game.day,storeOpen:game.storeOpen,storeManualOverride:game.storeManualOverride});
  }
  if (++clockTicks % 15 === 0) saveRooms();
}, 1000);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`الشغيل v1.0 يعمل على http://localhost:${PORT}`);
});
