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
const B25_SAT_HI_PAD = 0.0008;
const B25_SAT_MID_PAD = 0.0025;

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

/** PNW craftsman / cabin hero house — gabled terracotta roof + side wing, porch, chimney. */
function makeHeroHouseGeometry() {
  const parts = [];
  // Main mass (long axis E–W); ridge runs along X
  const mainW = 9.2, mainD = 6.4, mainH = 3.6;
  const body = new THREE.BoxGeometry(mainW, mainH, mainD);
  body.translate(0, mainH * 0.5, 0);
  parts.push({ geo: body, color: 0xe6d2b0 });

  // Gable: triangle in Z/Y, extrude along X (ridge E–W)
  const roofShape = new THREE.Shape();
  const rd = mainD * 0.58, rh = 2.55;
  roofShape.moveTo(-rd, 0);
  roofShape.lineTo(rd, 0);
  roofShape.lineTo(0, rh);
  roofShape.lineTo(-rd, 0);
  const roofGeo2 = new THREE.ExtrudeGeometry(roofShape, { depth: mainW + 0.7, bevelEnabled: false });
  roofGeo2.rotateY(-Math.PI / 2); // extrusion +Z → +X
  roofGeo2.translate(-(mainW + 0.7) * 0.5, mainH - 0.05, 0);
  parts.push({ geo: roofGeo2, color: 0x9a3f2c }); // terracotta / reddish-brown

  // Side wing (darker green roof) — west annex
  const wingW = 4.2, wingD = 5.0, wingH = 3.0;
  const wing = new THREE.BoxGeometry(wingW, wingH, wingD);
  wing.translate(-(mainW * 0.5 + wingW * 0.35), wingH * 0.5, -0.4);
  parts.push({ geo: wing, color: 0xdcc6a4 });
  const wingRoof = new THREE.ConeGeometry(Math.max(wingW, wingD) * 0.62, 1.9, 4);
  wingRoof.rotateY(Math.PI / 4);
  wingRoof.translate(-(mainW * 0.5 + wingW * 0.35), wingH + 0.9, -0.4);
  parts.push({ geo: wingRoof, color: 0x2f4a38 });

  // Stone chimney
  const chim = new THREE.BoxGeometry(0.7, 2.2, 0.7);
  chim.translate(mainW * 0.28, mainH + 1.6, -mainD * 0.12);
  parts.push({ geo: chim, color: 0x6a6560 });
  const chimCap = new THREE.BoxGeometry(0.85, 0.18, 0.85);
  chimCap.translate(mainW * 0.28, mainH + 2.75, -mainD * 0.12);
  parts.push({ geo: chimCap, color: 0x4a4844 });

  // Front porch deck + posts + roof overhang
  const porch = new THREE.BoxGeometry(mainW * 0.72, 0.22, 2.0);
  porch.translate(0, 0.22, mainD * 0.5 + 0.85);
  parts.push({ geo: porch, color: 0xa67c52 });
  const porchRoof = new THREE.BoxGeometry(mainW * 0.76, 0.14, 2.15);
  porchRoof.translate(0, 2.55, mainD * 0.5 + 0.85);
  parts.push({ geo: porchRoof, color: 0x7a3428 });
  for (const ox of [-mainW * 0.28, mainW * 0.28]) {
    const post = new THREE.CylinderGeometry(0.12, 0.14, 2.3, 6);
    post.translate(ox, 1.35, mainD * 0.5 + 1.55);
    parts.push({ geo: post, color: 0x8b6914 });
  }

  // Warm windows (front)
  for (const ox of [-2.4, -0.8, 0.8, 2.4]) {
    const win = new THREE.BoxGeometry(1.05, 1.05, 0.1);
    win.translate(ox, mainH * 0.55, mainD * 0.5 + 0.04);
    parts.push({ geo: win, color: 0xfff1bc });
  }
  // Side windows
  for (const oz of [-1.4, 1.4]) {
    const win = new THREE.BoxGeometry(0.1, 0.95, 0.95);
    win.translate(mainW * 0.5 + 0.04, mainH * 0.55, oz);
    parts.push({ geo: win, color: 0xffe9a8 });
  }

  // Door
  const door = new THREE.BoxGeometry(1.1, 2.1, 0.12);
  door.translate(0, 1.15, mainD * 0.5 + 0.05);
  parts.push({ geo: door, color: 0x5c3a22 });

  // Foundation skirt
  const found = new THREE.BoxGeometry(mainW + 0.3, 0.45, mainD + 0.3);
  found.translate(0, 0.15, 0);
  parts.push({ geo: found, color: 0x8a8680 });

  return mergeGeometries(parts);
}

function makeDrivewayGeometry() {
  // Long gravel stub (local +Z = north toward road)
  const pad = new THREE.BoxGeometry(3.4, 0.12, 16);
  pad.translate(0, 0.06, 10);
  const apron = new THREE.BoxGeometry(7.5, 0.1, 5.5);
  apron.translate(0, 0.05, 2.2);
  return mergeGeometries([
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
    " · B25 local DEM patch";

  return {
    maxElev, widthM, heightM, dataset, elevs, cols, rows, positions,
    centerLat, centerLng, mLat, mLng, south, north, west, east, data
  };
}

/**
 * High-detail local terrain around B25.
 * Mid mesh: full dense elev grid + b25-sat-mid.jpg
 * Hi mesh: tighter sat-hi pad, denser resampled elev + b25-sat-hi.jpg (hero yard)
 */
function buildB25LocalPatches(islandCtx, elevPatch, texMid, texHi) {
  if (!elevPatch || !elevPatch.elevations) return null;
  const { centerLat, centerLng, mLat, mLng } = islandCtx;
  const elevArr = Float32Array.from(elevPatch.elevations.map(e => {
    if (e == null || Number.isNaN(e) || e < 0) return 0;
    return e;
  }));
  const elevData = {
    cols: elevPatch.cols, rows: elevPatch.rows,
    south: elevPatch.south, north: elevPatch.north,
    west: elevPatch.west, east: elevPatch.east,
    elevations: elevArr
  };

  function prepTex(tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  }

  function buildGridMesh(south, north, west, east, cols, rows, sampleFn, tex, texSouth, texNorth, texWest, texEast, yBias) {
    const positions = new Float32Array(cols * rows * 3);
    const uvs = new Float32Array(cols * rows * 2);
    for (let r = 0; r < rows; r++) {
      const latFrac = rows === 1 ? 0.5 : r / (rows - 1);
      const lat = north - latFrac * (north - south);
      for (let c = 0; c < cols; c++) {
        const lngFrac = cols === 1 ? 0.5 : c / (cols - 1);
        const lng = west + lngFrac * (east - west);
        const e = sampleFn(lat, lng);
        const i = r * cols + c;
        positions[i * 3] = (lng - centerLng) * mLng;
        positions[i * 3 + 1] = e * VERT_EXAG + yBias;
        positions[i * 3 + 2] = (lat - centerLat) * mLat;
        // UV into texture geographic extent
        uvs[i * 2] = (lng - texWest) / (texEast - texWest);
        uvs[i * 2 + 1] = (lat - texSouth) / (texNorth - texSouth);
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
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      map: prepTex(tex),
      roughness: 0.9,
      metalness: 0.02,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 1;
    scene.add(mesh);
    return mesh;
  }

  const samplePatch = (lat, lng) => elevAtLatLng(elevData, lat, lng);

  const midSouth = B25_LAT - B25_SAT_MID_PAD;
  const midNorth = B25_LAT + B25_SAT_MID_PAD;
  const midWest = B25_LNG - B25_SAT_MID_PAD;
  const midEast = B25_LNG + B25_SAT_MID_PAD;

  // Neighborhood mid patch from full elev grid footprint
  if (texMid) {
    buildGridMesh(
      elevData.south, elevData.north, elevData.west, elevData.east,
      elevData.cols, elevData.rows,
      samplePatch, texMid,
      midSouth, midNorth, midWest, midEast,
      0.18
    );
  }

  // Hero hi-res patch: denser grid over sat-hi footprint
  const hiSouth = B25_LAT - B25_SAT_HI_PAD;
  const hiNorth = B25_LAT + B25_SAT_HI_PAD;
  const hiWest = B25_LNG - B25_SAT_HI_PAD;
  const hiEast = B25_LNG + B25_SAT_HI_PAD;
  if (texHi) {
    buildGridMesh(
      hiSouth, hiNorth, hiWest, hiEast,
      96, 96,
      samplePatch, texHi,
      hiSouth, hiNorth, hiWest, hiEast,
      0.35
    );
  }

  return { elevData };
}

function placeLocalRoads(islandCtx, elevPatch, local) {
  if (!local || !local.roads || !local.roads.length) return 0;
  const { centerLat, centerLng, mLat, mLng, elevs, cols, rows, data } = islandCtx;
  const elevSrc = elevPatch || data;
  const halfW = 2.4;
  let count = 0;
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc9b896, roughness: 0.95, metalness: 0.0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  });

  for (const road of local.roads) {
    const coords = road.coords;
    if (!coords || coords.length < 2) continue;
    // Prefer Whidbey Island Drive + nearby unnamed/residential close to B25
    const name = (road.name || "").toLowerCase();
    const isWhidbey = name.includes("whidbey");
    const isNear = coords.some(([lat, lng]) => {
      const dlat = (lat - B25_LAT) * mLat;
      const dlng = (lng - B25_LNG) * mLng;
      return Math.hypot(dlat, dlng) < 220;
    });
    if (!isWhidbey && !isNear) continue;

    const left = [], right = [], idx = [];
    for (let i = 0; i < coords.length; i++) {
      const [lat, lng] = coords[i];
      let elev;
      if (elevSrc.elevations) {
        elev = elevAtLatLng(
          Array.isArray(elevSrc.elevations)
            ? { ...elevSrc, elevations: Float32Array.from(elevSrc.elevations) }
            : elevSrc,
          lat, lng
        );
      } else {
        const g = latLngToGrid(lat, lng, data);
        elev = sampleElev(elevs, cols, rows, g.c, g.r);
      }
      // Prefer denser patch elev when inside its bbox
      if (elevPatch && lat >= elevPatch.south && lat <= elevPatch.north &&
          lng >= elevPatch.west && lng <= elevPatch.east) {
        elev = elevAtLatLng({
          cols: elevPatch.cols, rows: elevPatch.rows,
          south: elevPatch.south, north: elevPatch.north,
          west: elevPatch.west, east: elevPatch.east,
          elevations: Float32Array.from(elevPatch.elevations)
        }, lat, lng);
      }
      const w = latLngToWorld(lat, lng, Math.max(elev, 0.5), centerLat, centerLng, mLat, mLng);
      let tx = 0, tz = 1;
      if (i < coords.length - 1) {
        const [lat2, lng2] = coords[i + 1];
        tx = (lng2 - lng) * mLng;
        tz = (lat2 - lat) * mLat;
      } else if (i > 0) {
        const [lat0, lng0] = coords[i - 1];
        tx = (lng - lng0) * mLng;
        tz = (lat - lat0) * mLat;
      }
      const len = Math.hypot(tx, tz) || 1;
      const nx = -tz / len, nz = tx / len;
      const y = w.y + 0.45;
      left.push(w.x + nx * halfW, y, w.z + nz * halfW);
      right.push(w.x - nx * halfW, y, w.z - nz * halfW);
    }
    const n = coords.length;
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
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 2;
    scene.add(mesh);
    count++;
  }
  return count;
}

function placeLocalB25Trees(islandCtx, elevPatch, houseXY, featured) {
  const { centerLat, centerLng, mLat, mLng } = islandCtx;
  if (!elevPatch) return 0;
  const elevData = {
    cols: elevPatch.cols, rows: elevPatch.rows,
    south: elevPatch.south, north: elevPatch.north,
    west: elevPatch.west, east: elevPatch.east,
    elevations: Float32Array.from(elevPatch.elevations)
  };
  const rand = mulberry32(0xB25EE);
  const fx = featured?.x ?? 0;
  const fz = featured?.z ?? 0;
  const placements = [];

  // Dense ring around B25; clear yard (~14 m) and driveway corridor north
  const N = 140;
  for (let i = 0; i < N; i++) {
    const ang = rand() * Math.PI * 2;
    const rad = 14 + rand() * 55;
    const x = fx + Math.cos(ang) * rad;
    const z = fz + Math.sin(ang) * rad;
    // Driveway corridor: north (+z) strip
    const localX = x - fx, localZ = z - fz;
    if (localZ > 2 && localZ < 22 && Math.abs(localX) < 4.5) continue;
    // Yard clear
    if (Math.hypot(localX, localZ) < 14) continue;
    // Avoid other houses
    let near = false;
    for (let h = 0; h < houseXY.length; h += 2) {
      if (Math.hypot(x - houseXY[h], z - houseXY[h + 1]) < 10) { near = true; break; }
    }
    if (near) continue;

    const lng = centerLng + x / mLng;
    const lat = centerLat + z / mLat;
    if (lat < elevData.south || lat > elevData.north || lng < elevData.west || lng > elevData.east) continue;
    const elev = elevAtLatLng(elevData, lat, lng);
    if (elev < 1.5) continue;
    placements.push({ x, y: elev * VERT_EXAG, z, sc: 2.0 + rand() * 2.8 });
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
      _c.setHSL(0.30 + rand() * 0.06, 0.5 + rand() * 0.2, 0.22 + rand() * 0.1);
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

function placeHouses(ctx, buildings, lots, elevPatch) {
  const { elevs, cols, rows, centerLat, centerLng, mLat, mLng, data, maxElev } = ctx;
  const rand = mulberry32(0xB25A);
  const houseXY = [];
  const placements = [];

  function elevFor(lat, lng) {
    if (elevPatch && lat >= elevPatch.south && lat <= elevPatch.north &&
        lng >= elevPatch.west && lng <= elevPatch.east) {
      return elevAtLatLng({
        cols: elevPatch.cols, rows: elevPatch.rows,
        south: elevPatch.south, north: elevPatch.north,
        west: elevPatch.west, east: elevPatch.east,
        elevations: Float32Array.from(elevPatch.elevations)
      }, lat, lng);
    }
    const { c, r } = latLngToGrid(lat, lng, data);
    return sampleElev(elevs, cols, rows, c, r);
  }

  for (const b of buildings) {
    const elev = elevFor(b.lat, b.lng);
    const { c, r } = latLngToGrid(b.lat, b.lng, data);
    if (c < 0 || r < 0 || c > cols - 1 || r > rows - 1) continue;
    if (elev < 0.8 || elev > maxElev * 0.98) continue;
    const w = latLngToWorld(b.lat, b.lng, elev, centerLat, centerLng, mLat, mLng);
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
    let best = Infinity, featuredIdx = -1;
    for (let i = 0; i < placements.length; i++) {
      const dlat = (placements[i].lat - featuredLot.lat) * mLat;
      const dlng = (placements[i].lng - featuredLot.lng) * mLng;
      const d = Math.hypot(dlat, dlng);
      if (d < best) { best = d; featuredIdx = i; }
    }
    const elev = Math.max(elevFor(featuredLot.lat, featuredLot.lng), 2);
    const w = latLngToWorld(featuredLot.lat, featuredLot.lng, elev, centerLat, centerLng, mLat, mLng);
    // Face roughly north toward Whidbey Island Drive (porch +Z local → world after yaw)
    // Aerial: road is north of house; driveway runs north. yaw=0 keeps local +Z as world +Z (north).
    const feat = {
      x: w.x, y: w.y + 0.5, z: w.z,
      yaw: 0.08,
      color: 0xf2e2c4,
      elev,
      lat: featuredLot.lat, lng: featuredLot.lng,
      id: featuredLot.id,
      featured: true,
      label: featuredLot.label || featuredLot.id
    };
    // Drop any OSM building within 45 m of pin so we don't double-up the hero lot
    if (featuredIdx >= 0 && best < 45) {
      placements.splice(featuredIdx, 1);
    }
    placements.push(feat);
    houseXY.length = 0;
    for (const p of placements) houseXY.push(p.x, p.z);
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
    const featGeo = makeHeroHouseGeometry();
    const featMat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.68, metalness: 0.04,
      emissive: 0x2a1c0c, emissiveIntensity: 0.12
    });
    const featMesh = new THREE.Mesh(featGeo, featMat);
    featMesh.position.set(h.x, h.y, h.z);
    featMesh.rotation.y = h.yaw;
    featMesh.scale.setScalar(1.05);
    scene.add(featMesh);

    // Driveway stub toward road (north)
    const drive = new THREE.Mesh(
      makeDrivewayGeometry(),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
    );
    drive.position.set(h.x, h.y + 0.02, h.z);
    drive.rotation.y = h.yaw;
    scene.add(drive);

    // Extra emissive windows
    const wMat = new THREE.MeshStandardMaterial({
      color: 0xfff2c4, emissive: 0xffc56a, emissiveIntensity: 1.25, roughness: 0.35
    });
    for (const ox of [-2.4, -0.8, 0.8, 2.4]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.08), wMat);
      const cy = Math.cos(h.yaw), sy = Math.sin(h.yaw);
      win.position.set(
        h.x + cy * ox + sy * 3.25,
        h.y + 2.05,
        h.z - sy * ox + cy * 3.25
      );
      win.rotation.y = h.yaw;
      scene.add(win);
    }

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 10, 6),
      new THREE.MeshStandardMaterial({ color: 0xc4a35a, roughness: 0.65 })
    );
    pole.position.set(h.x + 6.5, h.y + 5.0, h.z + 3.5);
    scene.add(pole);

    const label = makeLabelSprite(h.label || "B25");
    label.position.set(h.x + 6.5, h.y + 12.5, h.z + 3.5);
    scene.add(label);

    // Closer default camera on B25
    defaultTarget.set(h.x, h.y + 5, h.z);
    defaultCamPos.set(h.x + 52, h.y + 38, h.z + 62);
    camera.position.copy(defaultCamPos);
    controls.target.copy(defaultTarget);
    controls.minDistance = 22;
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
  // World position of B25 for wider clear so local patch trees own that zone
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
      // Leave B25 neighborhood to local dense trees
      if (Math.hypot(x - b25x, z - b25z) < 70) continue;
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
  defaultTarget.set(p.x, p.y + 5, p.z);
  defaultCamPos.set(p.x + 52, p.y + 38, p.z + 62);
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

async function loadOptionalTexture(path) {
  const loader = new THREE.TextureLoader();
  try {
    return await loader.loadAsync(path);
  } catch (_) {
    return null;
  }
}

async function main() {
  try {
    const [elevRes, tex, buildingsRes, lotsRes, b25ElevRes, b25LocalRes, texMid, texHi] = await Promise.all([
      fetch("./elevation.json").then(r => {
        if (!r.ok) throw new Error("elevation.json " + r.status);
        return r.json();
      }),
      loadTexture(),
      fetch("./buildings.json").then(r => (r.ok ? r.json() : { buildings: [] })).catch(() => ({ buildings: [] })),
      fetch("./lots.json").then(r => (r.ok ? r.json() : { lots: [] })).catch(() => ({ lots: [] })),
      fetch("./b25-elevation.json").then(r => (r.ok ? r.json() : null)).catch(() => null),
      fetch("./b25-local.json").then(r => (r.ok ? r.json() : null)).catch(() => null),
      loadOptionalTexture("./b25-sat-mid.jpg"),
      loadOptionalTexture("./b25-sat-hi.jpg")
    ]);
    const ctx = buildTerrain(elevRes, tex);
    if (b25ElevRes && (texMid || texHi)) {
      buildB25LocalPatches(ctx, b25ElevRes, texMid, texHi);
    }
    const buildings = buildingsRes.buildings || [];
    const lots = lotsRes.lots || [];
    const { houseCount, houseXY, featuredCount, featuredPos } = placeHouses(ctx, buildings, lots, b25ElevRes);
    const treeCount = placeTrees(ctx, houseXY);
    const localTrees = placeLocalB25Trees(ctx, b25ElevRes, houseXY, featuredPos);
    const roadCount = placeLocalRoads(ctx, b25ElevRes, b25LocalRes);
    placeDock(ctx);
    console.info("Hat Island terrain ready", {
      maxElev: ctx.maxElev, widthM: ctx.widthM, heightM: ctx.heightM, dataset: ctx.dataset,
      houses: houseCount, featured: featuredCount, trees: treeCount,
      b25LocalTrees: localTrees, b25Roads: roadCount,
      b25Patch: !!b25ElevRes, b25SatHi: !!texHi, b25SatMid: !!texMid
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
