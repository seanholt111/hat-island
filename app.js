import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvas = document.getElementById("c");
const loaderEl = document.getElementById("loader");
const hintEl = document.getElementById("hint");
const attribEl = document.getElementById("attrib");

const VERT_EXAG = 3.0;
const WATER_Y = -0.4;
const TREE_CLEAR_M = 12;
const TARGET_TREES = 650;
const B25_LAT = 48.0125031;
const B25_LNG = -122.3257859;
const B25_SUPPRESS_M = 90; // suppress island-wide auto trees/houses near hand-placed B25

const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, alpha: false, powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071820);
scene.fog = new THREE.FogExp2(0x6a8fa3, 0.00055);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 20000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = true;
controls.screenSpacePanning = false;
controls.minDistance = 180;
controls.maxDistance = 4200;
controls.maxPolarAngle = Math.PI * 0.495;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
controls.rotateSpeed = 0.7;
controls.zoomSpeed = 0.9;

scene.add(new THREE.AmbientLight(0xb8d4e8, 0.5));
const sun = new THREE.DirectionalLight(0xffe2b8, 1.4);
sun.position.set(800, 1100, 450);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x7eb6d9, 0.32);
fill.position.set(-600, 400, -300);
scene.add(fill);
scene.add(new THREE.HemisphereLight(0xffe8c8, 0x1a3040, 0.38));

let defaultCamPos = new THREE.Vector3(900, 720, 1100);
let defaultTarget = new THREE.Vector3(0, 40, 0);

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Color();

function metersPerDeg(latDeg) {
  const lat = latDeg * Math.PI / 180;
  const mLat = 111132.92 - 559.82 * Math.cos(2 * lat) + 1.175 * Math.cos(4 * lat);
  const mLng = 111412.84 * Math.cos(lat) - 93.5 * Math.cos(3 * lat);
  return { mLat, mLng };
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mergeGeometries(parts) {
  let vCount = 0, iCount = 0;
  for (const { geo } of parts) {
    vCount += geo.attributes.position.count;
    iCount += geo.index ? geo.index.count : geo.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3);
  const col = new Float32Array(vCount * 3);
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  const tmp = new THREE.Color();
  for (const { geo, color } of parts) {
    tmp.set(color);
    const p = geo.attributes.position;
    const base = vo;
    for (let i = 0; i < p.count; i++) {
      pos[(vo + i) * 3] = p.getX(i);
      pos[(vo + i) * 3 + 1] = p.getY(i);
      pos[(vo + i) * 3 + 2] = p.getZ(i);
      col[(vo + i) * 3] = tmp.r;
      col[(vo + i) * 3 + 1] = tmp.g;
      col[(vo + i) * 3 + 2] = tmp.b;
    }
    if (geo.index) {
      for (let i = 0; i < geo.index.count; i++) idx[io++] = geo.index.getX(i) + base;
    } else {
      for (let i = 0; i < p.count; i++) idx[io++] = base + i;
    }
    vo += p.count;
    geo.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeVertexNormals();
  return out;
}

function makeTreeGeometry() {
  const trunk = new THREE.CylinderGeometry(0.18, 0.28, 1.4, 5);
  trunk.translate(0, 0.7, 0);
  const c1 = new THREE.ConeGeometry(1.35, 2.2, 6);
  c1.translate(0, 2.2, 0);
  const c2 = new THREE.ConeGeometry(1.05, 1.8, 6);
  c2.translate(0, 3.35, 0);
  const c3 = new THREE.ConeGeometry(0.7, 1.4, 6);
  c3.translate(0, 4.35, 0);
  return mergeGeometries([
    { geo: trunk, color: 0x5c3a22 },
    { geo: c1, color: 0x1f6b3a },
    { geo: c2, color: 0x2a8348 },
    { geo: c3, color: 0x247040 }
  ]);
}

function makeTallEvergreenGeometry() {
  const trunk = new THREE.CylinderGeometry(0.22, 0.36, 2.0, 6);
  trunk.translate(0, 1.0, 0);
  const layers = [
    { r: 1.7, h: 2.6, y: 2.6, c: 0x1a5c32 },
    { r: 1.35, h: 2.2, y: 4.0, c: 0x226b3c },
    { r: 1.0, h: 1.9, y: 5.3, c: 0x2a7a48 },
    { r: 0.65, h: 1.5, y: 6.4, c: 0x1f6840 }
  ];
  const parts = [{ geo: trunk, color: 0x4a3020 }];
  for (const L of layers) {
    const cone = new THREE.ConeGeometry(L.r, L.h, 7);
    cone.translate(0, L.y, 0);
    parts.push({ geo: cone, color: L.c });
  }
  return mergeGeometries(parts);
}

function makeCabinGeometry(featured = false) {
  const bodyH = featured ? 3.4 : 2.6;
  const bodyW = featured ? 6.2 : 4.6;
  const bodyD = featured ? 5.0 : 3.8;
  const body = new THREE.BoxGeometry(bodyW, bodyH, bodyD);
  body.translate(0, bodyH * 0.5, 0);
  const roof = new THREE.ConeGeometry(Math.max(bodyW, bodyD) * 0.72, featured ? 2.4 : 1.8, 4);
  roof.rotateY(Math.PI / 4);
  roof.translate(0, bodyH + (featured ? 1.15 : 0.85), 0);
  const chimney = new THREE.BoxGeometry(featured ? 0.55 : 0.4, featured ? 1.4 : 1.0, featured ? 0.55 : 0.4);
  chimney.translate(bodyW * 0.28, bodyH + (featured ? 2.0 : 1.45), -bodyD * 0.15);
  const porch = new THREE.BoxGeometry(bodyW * 0.55, 0.18, 1.1);
  porch.translate(0, 0.2, bodyD * 0.5 + 0.4);
  const parts = [
    { geo: body, color: featured ? 0xe8d5b5 : 0xd4b896 },
    { geo: roof, color: featured ? 0x8b3a2a : 0x6b4a3a },
    { geo: chimney, color: 0x5a5a5a },
    { geo: porch, color: 0xa67c52 }
  ];
  if (featured) {
    const win = new THREE.BoxGeometry(1.1, 0.9, 0.12);
    win.translate(-1.2, bodyH * 0.55, bodyD * 0.5 + 0.02);
    parts.push({ geo: win, color: 0xfff0b0 });
    const win2 = new THREE.BoxGeometry(1.1, 0.9, 0.12);
    win2.translate(1.2, bodyH * 0.55, bodyD * 0.5 + 0.02);
    parts.push({ geo: win2, color: 0xfff0b0 });
  }
  return mergeGeometries(parts);
}

/** B25 main house from sat: dark forest-green gabled roof, E–W ridge, lower west porch. */
function makeHeroHouseGeometry() {
  const parts = [];
  const mainW = 9.6, mainD = 6.6, mainH = 3.55;
  const body = new THREE.BoxGeometry(mainW, mainH, mainD);
  body.translate(0, mainH * 0.5, 0);
  parts.push({ geo: body, color: 0xe4d2b4 });

  // Gable roof: triangle in Z/Y, extrude along X (ridge E–W) — forest green
  const roofShape = new THREE.Shape();
  const rd = mainD * 0.58, rh = 2.45;
  roofShape.moveTo(-rd, 0);
  roofShape.lineTo(rd, 0);
  roofShape.lineTo(0, rh);
  roofShape.lineTo(-rd, 0);
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: mainW + 0.65, bevelEnabled: false });
  roofGeo.rotateY(Math.PI / 2);
  roofGeo.translate(-(mainW + 0.65) * 0.5, mainH - 0.05, 0);
  parts.push({ geo: roofGeo, color: 0x2a4a32 });

  // Lower west porch / annex
  const wingW = 3.6, wingD = 4.4, wingH = 2.55;
  const wing = new THREE.BoxGeometry(wingW, wingH, wingD);
  wing.translate(-(mainW * 0.5 + wingW * 0.32), wingH * 0.5, 0.15);
  parts.push({ geo: wing, color: 0xd8c4a4 });
  const wingRoofShape = new THREE.Shape();
  const wrd = wingD * 0.55, wrh = 1.55;
  wingRoofShape.moveTo(-wrd, 0);
  wingRoofShape.lineTo(wrd, 0);
  wingRoofShape.lineTo(0, wrh);
  wingRoofShape.lineTo(-wrd, 0);
  const wingRoof = new THREE.ExtrudeGeometry(wingRoofShape, { depth: wingW + 0.45, bevelEnabled: false });
  wingRoof.rotateY(Math.PI / 2);
  const wingCx = -(mainW * 0.5 + wingW * 0.32);
  wingRoof.translate(wingCx - (wingW + 0.45) * 0.5, wingH - 0.04, 0.15);
  parts.push({ geo: wingRoof, color: 0x243e2c });

  // Stone chimney on main ridge
  const chim = new THREE.BoxGeometry(0.65, 2.1, 0.65);
  chim.translate(mainW * 0.22, mainH + 1.55, -mainD * 0.1);
  parts.push({ geo: chim, color: 0x6a6560 });
  const chimCap = new THREE.BoxGeometry(0.8, 0.16, 0.8);
  chimCap.translate(mainW * 0.22, mainH + 2.65, -mainD * 0.1);
  parts.push({ geo: chimCap, color: 0x4a4844 });

  // North porch (faces driveway / road)
  const porch = new THREE.BoxGeometry(mainW * 0.55, 0.2, 1.85);
  porch.translate(0.4, 0.22, mainD * 0.5 + 0.75);
  parts.push({ geo: porch, color: 0xa67c52 });
  const porchRoof = new THREE.BoxGeometry(mainW * 0.58, 0.12, 2.0);
  porchRoof.translate(0.4, 2.4, mainD * 0.5 + 0.75);
  parts.push({ geo: porchRoof, color: 0x1f3828 });
  for (const ox of [-mainW * 0.18, mainW * 0.22]) {
    const post = new THREE.CylinderGeometry(0.11, 0.13, 2.15, 6);
    post.translate(ox + 0.4, 1.25, mainD * 0.5 + 1.4);
    parts.push({ geo: post, color: 0x8b6914 });
  }

  // Warm windows — north face
  for (const ox of [-2.6, -0.9, 0.9, 2.6]) {
    const win = new THREE.BoxGeometry(1.0, 1.0, 0.1);
    win.translate(ox, mainH * 0.55, mainD * 0.5 + 0.04);
    parts.push({ geo: win, color: 0xfff1bc });
  }
  // South windows
  for (const ox of [-2.2, 0, 2.2]) {
    const win = new THREE.BoxGeometry(1.0, 0.95, 0.1);
    win.translate(ox, mainH * 0.55, -mainD * 0.5 - 0.04);
    parts.push({ geo: win, color: 0xffe9a8 });
  }

  const door = new THREE.BoxGeometry(1.05, 2.05, 0.12);
  door.translate(0.35, 1.12, mainD * 0.5 + 0.05);
  parts.push({ geo: door, color: 0x5c3a22 });

  const found = new THREE.BoxGeometry(mainW + 0.25, 0.42, mainD + 0.25);
  found.translate(0, 0.14, 0);
  parts.push({ geo: found, color: 0x8a8680 });

  return mergeGeometries(parts);
}

/** Guest / garage immediately east of main — terracotta/red-brown gable. */
function makeHeroOutbuildingGeometry() {
  const parts = [];
  const w = 5.4, d = 4.8, h = 2.85;
  const body = new THREE.BoxGeometry(w, h, d);
  body.translate(0, h * 0.5, 0);
  parts.push({ geo: body, color: 0xdcc6a0 });

  const roofShape = new THREE.Shape();
  const rd = d * 0.58, rh = 1.85;
  roofShape.moveTo(-rd, 0);
  roofShape.lineTo(rd, 0);
  roofShape.lineTo(0, rh);
  roofShape.lineTo(-rd, 0);
  const roof = new THREE.ExtrudeGeometry(roofShape, { depth: w + 0.5, bevelEnabled: false });
  roof.rotateY(Math.PI / 2);
  roof.translate(-(w + 0.5) * 0.5, h - 0.04, 0);
  parts.push({ geo: roof, color: 0x9a3f2c });

  for (const ox of [-1.3, 1.3]) {
    const win = new THREE.BoxGeometry(1.0, 0.85, 0.1);
    win.translate(ox, h * 0.52, d * 0.5 + 0.04);
    parts.push({ geo: win, color: 0xffefb8 });
  }
  const door = new THREE.BoxGeometry(1.6, 2.0, 0.1);
  door.translate(0, 1.05, -d * 0.5 - 0.04);
  parts.push({ geo: door, color: 0x5a4030 });
  const found = new THREE.BoxGeometry(w + 0.2, 0.35, d + 0.2);
  found.translate(0, 0.12, 0);
  parts.push({ geo: found, color: 0x85817c });
  return mergeGeometries(parts);
}

function makeTrailerGeometry() {
  const parts = [];
  const body = new THREE.BoxGeometry(2.4, 2.2, 6.2);
  body.translate(0, 1.35, 0);
  parts.push({ geo: body, color: 0xf4f4f0 });
  const roof = new THREE.BoxGeometry(2.55, 0.18, 6.35);
  roof.translate(0, 2.5, 0);
  parts.push({ geo: roof, color: 0xe8e8e4 });
  for (const oz of [-1.8, 0, 1.8]) {
    const win = new THREE.BoxGeometry(0.08, 0.7, 1.1);
    win.translate(1.22, 1.55, oz);
    parts.push({ geo: win, color: 0xa8c8e0 });
  }
  for (const oz of [-1.6, 1.6]) {
    for (const ox of [-0.95, 0.95]) {
      const wheel = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 10);
      wheel.rotateZ(Math.PI / 2);
      wheel.translate(ox, 0.38, oz);
      parts.push({ geo: wheel, color: 0x222222 });
    }
  }
  return mergeGeometries(parts);
}

function makeTinyShedGeometry() {
  const parts = [];
  const body = new THREE.BoxGeometry(2.2, 1.8, 2.0);
  body.translate(0, 0.95, 0);
  parts.push({ geo: body, color: 0x8a7a62 });
  const roof = new THREE.ConeGeometry(1.7, 1.1, 4);
  roof.rotateY(Math.PI / 4);
  roof.translate(0, 2.25, 0);
  parts.push({ geo: roof, color: 0x3a3a38 });
  return mergeGeometries(parts);
}

function makeDrivewayGeometry() {
  // Gravel stub from house north toward Whidbey Island Drive (+Z = north)
  const pad = new THREE.BoxGeometry(3.2, 0.12, 18);
  pad.translate(0.4, 0.06, 11);
  const apron = new THREE.BoxGeometry(8.5, 0.1, 6.5);
  apron.translate(0.2, 0.05, 2.0);
  const yard = new THREE.BoxGeometry(22, 0.06, 18);
  yard.translate(1.5, 0.02, 1.0);
  return mergeGeometries([
    { geo: yard, color: 0xc9b98a },
    { geo: pad, color: 0xc4b59a },
    { geo: apron, color: 0xb8a888 }
  ]);
}

function makeLabelSprite(text) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 96;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = "rgba(8, 28, 40, 0.78)";
  ctx.strokeStyle = "rgba(255, 210, 120, 0.9)";
  ctx.lineWidth = 4;
  roundRect(ctx, 16, 16, 224, 64, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffe6b0";
  ctx.font = "bold 36px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(28, 10.5, 1);
  return spr;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function sampleElev(elevs, cols, rows, c, r) {
  const cc = Math.max(0, Math.min(cols - 1, c));
  const rr = Math.max(0, Math.min(rows - 1, r));
  const c0 = Math.floor(cc), r0 = Math.floor(rr);
  const c1 = Math.min(cols - 1, c0 + 1), r1 = Math.min(rows - 1, r0 + 1);
  const tx = cc - c0, ty = rr - r0;
  const e00 = elevs[r0 * cols + c0];
  const e10 = elevs[r0 * cols + c1];
  const e01 = elevs[r1 * cols + c0];
  const e11 = elevs[r1 * cols + c1];
  return e00 * (1 - tx) * (1 - ty) + e10 * tx * (1 - ty) + e01 * (1 - tx) * ty + e11 * tx * ty;
}

function latLngToGrid(lat, lng, data) {
  const { cols, rows, south, north, west, east } = data;
  const c = cols === 1 ? 0 : ((lng - west) / (east - west)) * (cols - 1);
  const r = rows === 1 ? 0 : ((north - lat) / (north - south)) * (rows - 1);
  return { c, r };
}

function latLngToWorld(lat, lng, elev, centerLat, centerLng, mLat, mLng) {
  return {
    x: (lng - centerLng) * mLng,
    y: elev * VERT_EXAG,
    z: (lat - centerLat) * mLat
  };
}

function elevAtLatLng(elevData, lat, lng) {
  const { c, r } = latLngToGrid(lat, lng, elevData);
  return sampleElev(elevData.elevations, elevData.cols, elevData.rows, c, r);
}

function buildTerrain(data, texture) {
  const { cols, rows, elevations, south, north, west, east, dataset } = data;
  const centerLat = (south + north) / 2;
  const centerLng = (west + east) / 2;
  const { mLat, mLng } = metersPerDeg(centerLat);
  const widthM = (east - west) * mLng;
  const heightM = (north - south) * mLat;

  const positions = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);
  const colors = new Float32Array(cols * rows * 3);
  const elevs = new Float32Array(cols * rows);
  let maxElev = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      let e = elevations[i];
      if (e == null || Number.isNaN(e) || e < 0) e = 0;
      elevs[i] = e;
      if (e > maxElev) maxElev = e;
    }
  }

  for (let r = 0; r < rows; r++) {
    const latFrac = rows === 1 ? 0.5 : r / (rows - 1);
    const lat = north - latFrac * (north - south);
    const z = (lat - centerLat) * mLat;
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const lngFrac = cols === 1 ? 0.5 : c / (cols - 1);
      const lng = west + lngFrac * (east - west);
      const x = (lng - centerLng) * mLng;
      const y = elevs[i] * VERT_EXAG;
      const pi = i * 3;
      positions[pi] = x;
      positions[pi + 1] = y;
      positions[pi + 2] = z;
      uvs[i * 2] = lngFrac;
      uvs[i * 2 + 1] = 1 - latFrac;
      const wet = elevs[i] <= 0.15 ? 1 : elevs[i] < 1.5 ? (1.5 - elevs[i]) / 1.35 : 0;
      colors[pi] = 1 - wet * 0.35;
      colors[pi + 1] = 1 - wet * 0.15;
      colors[pi + 2] = 1;
    }
  }

  const indices = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = (r + 1) * cols + c;
      const eIdx = d + 1;
      indices.push(a, b, d, b, eIdx, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  const mat = new THREE.MeshStandardMaterial({
    map: texture, vertexColors: true, roughness: 0.92, metalness: 0.02, side: THREE.DoubleSide
  });
  scene.add(new THREE.Mesh(geo, mat));

  const waterSize = Math.max(widthM, heightM) * 2.4;
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(waterSize, waterSize),
    new THREE.MeshStandardMaterial({
      color: 0x0a3a52, roughness: 0.28, metalness: 0.15,
      transparent: true, opacity: 0.92, side: THREE.DoubleSide
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_Y;
  scene.add(water);

  const deep = new THREE.Mesh(
    new THREE.PlaneGeometry(waterSize * 1.6, waterSize * 1.6),
    new THREE.MeshBasicMaterial({ color: 0x042230, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  deep.rotation.x = -Math.PI / 2;
  deep.position.y = WATER_Y - 2;
  scene.add(deep);

  const halfW = widthM * 0.5;
  const halfH = heightM * 0.5;
  const peakY = maxElev * VERT_EXAG;
  defaultTarget.set(0, peakY * 0.25, 0);
  defaultCamPos.set(halfW * 0.55, Math.max(peakY * 2.2, 520), -halfH * 1.15);
  camera.position.copy(defaultCamPos);
  controls.target.copy(defaultTarget);
  controls.minDistance = Math.max(120, Math.min(halfW, halfH) * 0.35);
  controls.maxDistance = Math.max(halfW, halfH) * 3.2;
  controls.update();

  attribEl.textContent =
    "Elevation: OpenTopoData " + dataset + " · Imagery © Esri, Maxar, Earthstar Geographics · Vert. ×" + VERT_EXAG +
    " · B25 hand-placed on island DEM";

  return {
    maxElev, widthM, heightM, dataset, elevs, cols, rows, positions,
    centerLat, centerLng, mLat, mLng, south, north, west, east, data
  };
}

function placeLocalRoads(islandCtx, local) {
  if (!local || !local.roads || !local.roads.length) return 0;
  const { centerLat, centerLng, mLat, mLng, elevs, cols, rows, data } = islandCtx;
  const halfW = 2.35;
  let count = 0;
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc9b896, roughness: 0.95, metalness: 0.0
  });

  for (const road of local.roads) {
    const coords = road.coords;
    if (!coords || coords.length < 2) continue;
    const name = (road.name || "").toLowerCase();
    const isWhidbey = name.includes("whidbey");
    const isNear = coords.some(([lat, lng]) => {
      const dlat = (lat - B25_LAT) * mLat;
      const dlng = (lng - B25_LNG) * mLng;
      return Math.hypot(dlat, dlng) < 200;
    });
    if (!isWhidbey && !isNear) continue;
    // Only keep segments near B25 (trim long island roads)
    const trimmed = [];
    for (const [lat, lng] of coords) {
      const dlat = (lat - B25_LAT) * mLat;
      const dlng = (lng - B25_LNG) * mLng;
      if (Math.hypot(dlat, dlng) < 160) trimmed.push([lat, lng]);
    }
    if (trimmed.length < 2) continue;

    const left = [], right = [], idx = [];
    for (let i = 0; i < trimmed.length; i++) {
      const [lat, lng] = trimmed[i];
      const g = latLngToGrid(lat, lng, data);
      const elev = Math.max(sampleElev(elevs, cols, rows, g.c, g.r), 0.5);
      const w = latLngToWorld(lat, lng, elev, centerLat, centerLng, mLat, mLng);
      let tx = 0, tz = 1;
      if (i < trimmed.length - 1) {
        const [lat2, lng2] = trimmed[i + 1];
        tx = (lng2 - lng) * mLng;
        tz = (lat2 - lat) * mLat;
      } else if (i > 0) {
        const [lat0, lng0] = trimmed[i - 1];
        tx = (lng - lng0) * mLng;
        tz = (lat - lat0) * mLat;
      }
      const len = Math.hypot(tx, tz) || 1;
      const nx = -tz / len, nz = tx / len;
      const y = w.y + 0.35;
      left.push(w.x + nx * halfW, y, w.z + nz * halfW);
      right.push(w.x - nx * halfW, y, w.z - nz * halfW);
    }
    const n = trimmed.length;
    const pos = new Float32Array(n * 2 * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = left[i * 3];
      pos[i * 3 + 1] = left[i * 3 + 1];
      pos[i * 3 + 2] = left[i * 3 + 2];
      pos[(n + i) * 3] = right[i * 3];
      pos[(n + i) * 3 + 1] = right[i * 3 + 1];
      pos[(n + i) * 3 + 2] = right[i * 3 + 2];
    }
    for (let i = 0; i < n - 1; i++) {
      const a = i, b = i + 1, c = n + i, d = n + i + 1;
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, mat));
    count++;
  }
  return count;
}

/**
 * Hand-placed evergreens around B25 from sat reference.
 * Local offsets: +X east, +Z north. Yard clear ~14–18 m; open driveway north corridor.
 */
const B25_TREE_OFFSETS = [
  // North tree line (between house and road), leaving driveway gap ~x∈[-2,4]
  { dx: -14, dz: 20, sc: 3.4 }, { dx: -10, dz: 22, sc: 3.8 }, { dx: -7, dz: 19, sc: 3.1 },
  { dx: 7, dz: 20, sc: 3.5 }, { dx: 11, dz: 22, sc: 3.9 }, { dx: 15, dz: 19, sc: 3.2 },
  { dx: -18, dz: 16, sc: 3.6 }, { dx: 18, dz: 17, sc: 3.7 },
  // Northeast clump (dense)
  { dx: 14, dz: 10, sc: 4.0 }, { dx: 18, dz: 8, sc: 3.6 }, { dx: 21, dz: 12, sc: 3.3 },
  { dx: 16, dz: 4, sc: 3.8 },
  // East / SE of red outbuilding (thick)
  { dx: 16, dz: -2, sc: 4.1 }, { dx: 19, dz: -6, sc: 3.7 }, { dx: 14, dz: -8, sc: 3.9 },
  { dx: 21, dz: -10, sc: 3.4 }, { dx: 12, dz: -12, sc: 3.5 },
  // South wall
  { dx: 6, dz: -16, sc: 3.8 }, { dx: 1, dz: -18, sc: 4.0 }, { dx: -4, dz: -17, sc: 3.6 },
  { dx: -9, dz: -15, sc: 3.9 }, { dx: -14, dz: -14, sc: 3.4 }, { dx: 10, dz: -18, sc: 3.3 },
  // West ring
  { dx: -16, dz: -6, sc: 3.7 }, { dx: -18, dz: 0, sc: 4.0 }, { dx: -17, dz: 6, sc: 3.5 },
  { dx: -20, dz: -10, sc: 3.2 }, { dx: -13, dz: 10, sc: 3.6 },
  // Outer fillers matching sat density
  { dx: 8, dz: -14, sc: 3.1 }, { dx: -8, dz: -12, sc: 3.0 },
  { dx: 22, dz: 2, sc: 3.4 }, { dx: -22, dz: 4, sc: 3.3 },
  { dx: 5, dz: 24, sc: 2.9 }, { dx: -5, dz: 24, sc: 2.8 }
];

function placeLocalB25Trees(islandCtx, featured) {
  const { centerLat, centerLng, mLat, mLng, elevs, cols, rows, data } = islandCtx;
  if (!featured) return 0;
  const fx = featured.x, fz = featured.z;
  const rand = mulberry32(0xB25EE);
  const placements = [];

  for (const t of B25_TREE_OFFSETS) {
    const x = fx + t.dx;
    const z = fz + t.dz;
    // Keep driveway corridor clear (north strip)
    if (t.dz > 4 && t.dz < 26 && Math.abs(t.dx - 0.4) < 3.2) continue;
    const lng = centerLng + x / mLng;
    const lat = centerLat + z / mLat;
    const g = latLngToGrid(lat, lng, data);
    const elev = sampleElev(elevs, cols, rows, g.c, g.r);
    if (elev < 1.2) continue;
    placements.push({ x, y: elev * VERT_EXAG, z, sc: t.sc * (0.92 + rand() * 0.14) });
  }

  if (!placements.length) return 0;
  const treeGeo = makeTallEvergreenGeometry();
  const treeMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.88, metalness: 0.0
  });
  const trees = new THREE.InstancedMesh(treeGeo, treeMat, placements.length);
  trees.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  trees.frustumCulled = true;
  if ("setColorAt" in trees) {
    trees.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(placements.length * 3), 3);
  }
  for (let i = 0; i < placements.length; i++) {
    const t = placements[i];
    _p.set(t.x, t.y, t.z);
    _q.setFromAxisAngle(_up, rand() * Math.PI * 2);
    _s.set(t.sc * 0.95, t.sc, t.sc * 0.95);
    _m.compose(_p, _q, _s);
    trees.setMatrixAt(i, _m);
    if (trees.instanceColor) {
      _c.setHSL(0.30 + rand() * 0.06, 0.5 + rand() * 0.2, 0.20 + rand() * 0.1);
      trees.setColorAt(i, _c);
    }
  }
  trees.instanceMatrix.needsUpdate = true;
  if (trees.instanceColor) trees.instanceColor.needsUpdate = true;
  scene.add(trees);
  return placements.length;
}

const CABIN_PALETTE = [
  0xf0e6d4, 0xd2a679, 0xc45c4a, 0x7a9bb5, 0xe8c9a0, 0xb86b4a, 0xdfe7ef, 0xc9a66b
];

function placeHouses(ctx, buildings, lots) {
  const { elevs, cols, rows, centerLat, centerLng, mLat, mLng, data, maxElev } = ctx;
  const rand = mulberry32(0xB25A);
  const houseXY = [];
  const placements = [];

  function elevFor(lat, lng) {
    const { c, r } = latLngToGrid(lat, lng, data);
    return sampleElev(elevs, cols, rows, c, r);
  }

  const b25x = (B25_LNG - centerLng) * mLng;
  const b25z = (B25_LAT - centerLat) * mLat;

  for (const b of buildings) {
    const elev = elevFor(b.lat, b.lng);
    const { c, r } = latLngToGrid(b.lat, b.lng, data);
    if (c < 0 || r < 0 || c > cols - 1 || r > rows - 1) continue;
    if (elev < 0.8 || elev > maxElev * 0.98) continue;
    const w = latLngToWorld(b.lat, b.lng, elev, centerLat, centerLng, mLat, mLng);
    // Suppress OSM cottages near hand-placed B25 compound
    if (Math.hypot(w.x - b25x, w.z - b25z) < B25_SUPPRESS_M) continue;
    placements.push({
      x: w.x, y: w.y + 0.35, z: w.z,
      yaw: rand() * Math.PI * 2,
      color: CABIN_PALETTE[(rand() * CABIN_PALETTE.length) | 0],
      elev,
      lat: b.lat, lng: b.lng, id: b.id,
      featured: false
    });
    houseXY.push(w.x, w.z);
  }

  let featuredLot = (lots || []).find(l => l.featured) || (lots || []).find(l => l.id === "B25");
  let featuredPos = null;
  if (featuredLot) {
    const elev = Math.max(elevFor(featuredLot.lat, featuredLot.lng), 2);
    const w = latLngToWorld(featuredLot.lat, featuredLot.lng, elev, centerLat, centerLng, mLat, mLng);
    // Porch faces north toward driveway / Whidbey Island Drive (local +Z = world +Z)
    const feat = {
      x: w.x, y: w.y + 0.35, z: w.z,
      yaw: 0.05,
      color: 0xf2e2c4,
      elev,
      lat: featuredLot.lat, lng: featuredLot.lng,
      id: featuredLot.id,
      featured: true,
      label: featuredLot.label || featuredLot.id
    };
    placements.push(feat);
    houseXY.push(feat.x, feat.z);
    featuredPos = feat;
  }

  const regular = placements.filter(p => !p.featured);
  const featured = placements.filter(p => p.featured);

  const cabinGeo = makeCabinGeometry(false);
  const cabinMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.78, metalness: 0.05
  });
  const mesh = new THREE.InstancedMesh(cabinGeo, cabinMat, Math.max(regular.length, 1));
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  mesh.frustumCulled = true;
  const hasIC = "setColorAt" in mesh;
  if (hasIC && regular.length) {
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(regular.length * 3), 3);
  }

  for (let i = 0; i < regular.length; i++) {
    const h = regular[i];
    const sc = 0.85 + rand() * 0.35;
    _p.set(h.x, h.y, h.z);
    _q.setFromAxisAngle(_up, h.yaw);
    _s.set(sc, sc, sc);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(i, _m);
    if (hasIC) {
      _c.setHex(h.color);
      if (rand() < 0.28) _c.offsetHSL(0.05, 0.15, 0.08);
      mesh.setColorAt(i, _c);
    }
  }
  mesh.count = regular.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  if (regular.length) scene.add(mesh);

  const glowCount = Math.min(36, Math.floor(regular.length * 0.22));
  if (glowCount > 0) {
    const glowGeo = new THREE.BoxGeometry(0.9, 0.7, 0.08);
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xffd890, emissive: 0xffb84a, emissiveIntensity: 0.85, roughness: 0.5, metalness: 0
    });
    const glows = new THREE.InstancedMesh(glowGeo, glowMat, glowCount);
    for (let i = 0; i < glowCount; i++) {
      const h = regular[(rand() * regular.length) | 0];
      const sc = 0.9;
      _p.set(h.x + Math.sin(h.yaw) * 1.9 * sc, h.y + 1.4 * sc, h.z + Math.cos(h.yaw) * 1.9 * sc);
      _q.setFromAxisAngle(_up, h.yaw);
      _s.set(1, 1, 1);
      _m.compose(_p, _q, _s);
      glows.setMatrixAt(i, _m);
    }
    glows.instanceMatrix.needsUpdate = true;
    scene.add(glows);
  }

  for (const h of featured) {
    const cy = Math.cos(h.yaw), sy = Math.sin(h.yaw);
    function localToWorld(lx, ly, lz) {
      return {
        x: h.x + cy * lx + sy * lz,
        y: h.y + ly,
        z: h.z - sy * lx + cy * lz
      };
    }

    // Main green-roof house at exact pin
    const featGeo = makeHeroHouseGeometry();
    const featMat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.68, metalness: 0.04,
      emissive: 0x1a2818, emissiveIntensity: 0.08
    });
    const featMesh = new THREE.Mesh(featGeo, featMat);
    featMesh.position.set(h.x, h.y, h.z);
    featMesh.rotation.y = h.yaw;
    featMesh.scale.setScalar(1.0);
    scene.add(featMesh);

    // Terracotta outbuilding immediately east
    const outPos = localToWorld(8.2, 0, -0.4);
    const outMesh = new THREE.Mesh(
      makeHeroOutbuildingGeometry(),
      new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.72, metalness: 0.04
      })
    );
    outMesh.position.set(outPos.x, outPos.y, outPos.z);
    outMesh.rotation.y = h.yaw;
    scene.add(outMesh);

    // Yard apron + gravel driveway stub north toward road
    const drive = new THREE.Mesh(
      makeDrivewayGeometry(),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
    );
    drive.position.set(h.x, h.y + 0.02, h.z);
    drive.rotation.y = h.yaw;
    scene.add(drive);

    // White trailer / RV in north clearing + tiny shed
    const trailPos = localToWorld(-3.5, 0, 13.5);
    const trailer = new THREE.Mesh(
      makeTrailerGeometry(),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 })
    );
    trailer.position.set(trailPos.x, trailPos.y, trailPos.z);
    trailer.rotation.y = h.yaw + 0.12;
    scene.add(trailer);

    const shedPos = localToWorld(1.8, 0, 12.2);
    const shed = new THREE.Mesh(
      makeTinyShedGeometry(),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.02 })
    );
    shed.position.set(shedPos.x, shedPos.y, shedPos.z);
    shed.rotation.y = h.yaw - 0.2;
    scene.add(shed);

    // Extra emissive front windows
    const wMat = new THREE.MeshStandardMaterial({
      color: 0xfff2c4, emissive: 0xffc56a, emissiveIntensity: 1.2, roughness: 0.35
    });
    for (const ox of [-2.6, -0.9, 0.9, 2.6]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.08), wMat);
      const p = localToWorld(ox, 2.0, 3.35);
      win.position.set(p.x, p.y, p.z);
      win.rotation.y = h.yaw;
      scene.add(win);
    }

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 10, 6),
      new THREE.MeshStandardMaterial({ color: 0xc4a35a, roughness: 0.65 })
    );
    const poleP = localToWorld(7.5, 5.0, 4.0);
    pole.position.set(poleP.x, poleP.y, poleP.z);
    scene.add(pole);

    const label = makeLabelSprite(h.label || "B25");
    label.position.set(poleP.x, h.y + 12.5, poleP.z);
    scene.add(label);

    // Closer pleasant orbit on B25
    defaultTarget.set(h.x, h.y + 4, h.z);
    defaultCamPos.set(h.x + 38, h.y + 28, h.z + 48);
    camera.position.copy(defaultCamPos);
    controls.target.copy(defaultTarget);
    controls.minDistance = 18;
    controls.maxDistance = Math.max(controls.maxDistance, 2800);
    controls.update();
    window.__b25 = { x: h.x, y: h.y, z: h.z };
    featuredPos = h;
  }

  return { houseCount: placements.length, houseXY, featuredCount: featured.length, featuredPos };
}

function placeTrees(ctx, houseXY) {
  const { elevs, cols, rows, positions, maxElev, centerLat, centerLng, mLat, mLng } = ctx;
  const rand = mulberry32(0x7EE5);
  const candidates = [];
  // Leave B25 neighborhood to hand-placed evergreens
  const b25x = (B25_LNG - centerLng) * mLng;
  const b25z = (B25_LAT - centerLat) * mLat;

  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const i = r * cols + c;
      const e = elevs[i];
      if (e < 2.4 || e > maxElev * 0.92) continue;
      const eL = elevs[i - 1], eR = elevs[i + 1];
      const eU = elevs[i - cols], eD = elevs[i + cols];
      const slope = Math.hypot(eR - eL, eD - eU) / 2;
      if (slope > 7.5) continue;
      const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
      if (Math.hypot(x - b25x, z - b25z) < B25_SUPPRESS_M) continue;
      let nearHouse = false;
      for (let h = 0; h < houseXY.length; h += 2) {
        if (Math.hypot(x - houseXY[h], z - houseXY[h + 1]) < TREE_CLEAR_M) {
          nearHouse = true;
          break;
        }
      }
      if (nearHouse) continue;
      const prefer = e > 8 && e < maxElev * 0.7 ? 0.55 : 0.28;
      if (rand() > prefer) continue;
      candidates.push(i);
    }
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    const t = candidates[i];
    candidates[i] = candidates[j];
    candidates[j] = t;
  }
  const want = Math.min(900, Math.max(400, TARGET_TREES));
  const n = Math.min(candidates.length, want);
  const picked = candidates.slice(0, n);

  const treeGeo = makeTreeGeometry();
  const treeMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.9, metalness: 0.0
  });
  const trees = new THREE.InstancedMesh(treeGeo, treeMat, picked.length);
  trees.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  trees.frustumCulled = true;
  if ("setColorAt" in trees) {
    trees.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(picked.length * 3), 3);
  }

  for (let i = 0; i < picked.length; i++) {
    const idx = picked[i];
    const x = positions[idx * 3];
    const y = positions[idx * 3 + 1];
    const z = positions[idx * 3 + 2];
    const sc = 1.6 + rand() * 2.4;
    _p.set(x + (rand() - 0.5) * 4, y, z + (rand() - 0.5) * 4);
    _q.setFromAxisAngle(_up, rand() * Math.PI * 2);
    _s.set(sc * (0.9 + rand() * 0.2), sc, sc * (0.9 + rand() * 0.2));
    _m.compose(_p, _q, _s);
    trees.setMatrixAt(i, _m);
    if (trees.instanceColor) {
      _c.setHSL(0.28 + rand() * 0.08, 0.45 + rand() * 0.25, 0.28 + rand() * 0.12);
      trees.setColorAt(i, _c);
    }
  }
  trees.instanceMatrix.needsUpdate = true;
  if (trees.instanceColor) trees.instanceColor.needsUpdate = true;
  scene.add(trees);
  return picked.length;
}

function placeDock(ctx) {
  const lat = 48.02035, lng = -122.32275;
  const { elevs, cols, rows, centerLat, centerLng, mLat, mLng, data } = ctx;
  const { c, r } = latLngToGrid(lat, lng, data);
  const elev = sampleElev(elevs, cols, rows, c, r);
  const w = latLngToWorld(lat, lng, Math.max(elev, 0.2), centerLat, centerLng, mLat, mLng);
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b5344, roughness: 0.85, metalness: 0.05 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(14, 0.35, 3.2), wood);
  board.position.set(0, 0.4, 0);
  group.add(board);
  const pilingMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2e, roughness: 0.9 });
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 3.2, 5), pilingMat);
    p.position.set(-6 + i * 2.4, -0.6, (i % 2 === 0 ? -1.3 : 1.3));
    group.add(p);
  }
  group.position.set(w.x, Math.max(WATER_Y + 0.6, w.y * 0.15 + 0.5), w.z);
  group.rotation.y = -0.6;
  scene.add(group);
}

function resetView() {
  camera.position.copy(defaultCamPos);
  controls.target.copy(defaultTarget);
  controls.update();
}
function zoomBy(factor) {
  const dir = new THREE.Vector3().subVectors(camera.position, controls.target);
  dir.multiplyScalar(factor);
  const next = new THREE.Vector3().addVectors(controls.target, dir);
  const dist = next.distanceTo(controls.target);
  if (dist >= controls.minDistance && dist <= controls.maxDistance) {
    camera.position.copy(next);
    controls.update();
  }
}

function focusB25() {
  const p = window.__b25;
  if (!p) return;
  defaultTarget.set(p.x, p.y + 4, p.z);
  defaultCamPos.set(p.x + 38, p.y + 28, p.z + 48);
  controls.minDistance = 18;
  resetView();
}

document.getElementById("btnReset").addEventListener("click", resetView);
document.getElementById("btnZoomIn").addEventListener("click", () => zoomBy(0.82));
document.getElementById("btnZoomOut").addEventListener("click", () => zoomBy(1.22));
const btnB25 = document.getElementById("btnB25");
if (btnB25) btnB25.addEventListener("click", focusB25);

setTimeout(() => hintEl.classList.add("fade"), 4500);
controls.addEventListener("start", () => hintEl.classList.add("fade"));

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener("resize", onResize);
window.addEventListener("orientationchange", () => setTimeout(onResize, 200));

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

async function loadTexture() {
  const loader = new THREE.TextureLoader();
  try {
    return await loader.loadAsync("./terrain-sat-hi.jpg");
  } catch (_) {
    return loader.loadAsync("./terrain-sat.jpg");
  }
}

async function main() {
  try {
    const [elevRes, tex, buildingsRes, lotsRes, b25LocalRes] = await Promise.all([
      fetch("./elevation.json").then(r => {
        if (!r.ok) throw new Error("elevation.json " + r.status);
        return r.json();
      }),
      loadTexture(),
      fetch("./buildings.json").then(r => (r.ok ? r.json() : { buildings: [] })).catch(() => ({ buildings: [] })),
      fetch("./lots.json").then(r => (r.ok ? r.json() : { lots: [] })).catch(() => ({ lots: [] })),
      fetch("./b25-local.json").then(r => (r.ok ? r.json() : null)).catch(() => null)
    ]);
    // Single island-wide DEM mesh only (no local b25-elevation heightfield overlay)
    const ctx = buildTerrain(elevRes, tex);
    const buildings = buildingsRes.buildings || [];
    const lots = lotsRes.lots || [];
    const { houseCount, houseXY, featuredCount, featuredPos } = placeHouses(ctx, buildings, lots);
    const treeCount = placeTrees(ctx, houseXY);
    const localTrees = placeLocalB25Trees(ctx, featuredPos);
    const roadCount = placeLocalRoads(ctx, b25LocalRes);
    placeDock(ctx);
    console.info("Hat Island terrain ready", {
      maxElev: ctx.maxElev, widthM: ctx.widthM, heightM: ctx.heightM, dataset: ctx.dataset,
      houses: houseCount, featured: featuredCount, trees: treeCount,
      b25HandTrees: localTrees, b25Roads: roadCount,
      singleDem: true
    });
    loaderEl.classList.add("hidden");
    setTimeout(() => loaderEl.remove(), 500);
    animate();
  } catch (err) {
    console.error(err);
    loaderEl.innerHTML = "<p style=\"color:#ffb4b4;padding:1rem;text-align:center\">Failed to load terrain.<br>" + String(err.message || err) + "</p>";
  }
}
main();
