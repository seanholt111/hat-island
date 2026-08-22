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
    "Elevation: OpenTopoData " + dataset + " · Imagery © Esri, Maxar, Earthstar Geographics · Vert. ×" + VERT_EXAG;

  return {
    maxElev, widthM, heightM, dataset, elevs, cols, rows, positions,
    centerLat, centerLng, mLat, mLng, south, north, west, east, data
  };
}

const CABIN_PALETTE = [
  0xf0e6d4, 0xd2a679, 0xc45c4a, 0x7a9bb5, 0xe8c9a0, 0xb86b4a, 0xdfe7ef, 0xc9a66b
];

function placeHouses(ctx, buildings, lots) {
  const { elevs, cols, rows, centerLat, centerLng, mLat, mLng, data, maxElev } = ctx;
  const rand = mulberry32(0xB25A);
  const houseXY = [];
  const placements = [];

  for (const b of buildings) {
    const { c, r } = latLngToGrid(b.lat, b.lng, data);
    if (c < 0 || r < 0 || c > cols - 1 || r > rows - 1) continue;
    const elev = sampleElev(elevs, cols, rows, c, r);
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
  let featuredIdx = -1;
  if (featuredLot) {
    let best = Infinity;
    for (let i = 0; i < placements.length; i++) {
      const dlat = (placements[i].lat - featuredLot.lat) * mLat;
      const dlng = (placements[i].lng - featuredLot.lng) * mLng;
      const d = Math.hypot(dlat, dlng);
      if (d < best) { best = d; featuredIdx = i; }
    }
    // Always place a featured cabin at the lot pin (even if OSM is offset)
    const { c, r } = latLngToGrid(featuredLot.lat, featuredLot.lng, data);
    const elev = sampleElev(elevs, cols, rows, c, r);
    const w = latLngToWorld(featuredLot.lat, featuredLot.lng, Math.max(elev, 2), centerLat, centerLng, mLat, mLng);
    const feat = {
      x: w.x, y: w.y + 0.45, z: w.z,
      yaw: rand() * Math.PI * 2,
      color: 0xf2e2c4,
      elev: Math.max(elev, 2),
      lat: featuredLot.lat, lng: featuredLot.lng,
      id: featuredLot.id,
      featured: true,
      label: featuredLot.label || featuredLot.id
    };
    // If nearest OSM is within ~40 m, upgrade it instead of doubling
    if (featuredIdx >= 0 && best < 40) {
      placements[featuredIdx].featured = true;
      placements[featuredIdx].label = feat.label;
      placements[featuredIdx].color = feat.color;
      // nudge slightly toward lot pin
      placements[featuredIdx].x = (placements[featuredIdx].x + feat.x) * 0.5;
      placements[featuredIdx].z = (placements[featuredIdx].z + feat.z) * 0.5;
      placements[featuredIdx].y = (placements[featuredIdx].y + feat.y) * 0.5;
    } else {
      placements.push(feat);
      houseXY.push(feat.x, feat.z);
      featuredIdx = placements.length - 1;
    }
  }

  const regular = placements.filter(p => !p.featured);
  const featured = placements.filter(p => p.featured);

  const cabinGeo = makeCabinGeometry(false);
  const cabinMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.78, metalness: 0.05
  });
  const mesh = new THREE.InstancedMesh(cabinGeo, cabinMat, regular.length);
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  mesh.frustumCulled = true;
  const hasIC = "setColorAt" in mesh;
  if (hasIC) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(regular.length * 3), 3);

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
      // soft dusk window glow tint via slight warm boost
      if (rand() < 0.28) _c.offsetHSL(0.05, 0.15, 0.08);
      mesh.setColorAt(i, _c);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);

  // Emissive window glow on a subset: tiny boxes on random regular houses
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
    const featGeo = makeCabinGeometry(true);
    const featMat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.7, metalness: 0.04,
      emissive: 0x3a2810, emissiveIntensity: 0.15
    });
    const featMesh = new THREE.Mesh(featGeo, featMat);
    featMesh.position.set(h.x, h.y, h.z);
    featMesh.rotation.y = h.yaw;
    featMesh.scale.setScalar(1.15);
    scene.add(featMesh);

    // warm window emissives
    const wMat = new THREE.MeshStandardMaterial({
      color: 0xfff2c4, emissive: 0xffc56a, emissiveIntensity: 1.1, roughness: 0.4
    });
    for (const ox of [-1.35, 1.35]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.95, 0.1), wMat);
      win.position.set(h.x + Math.cos(h.yaw) * ox + Math.sin(h.yaw) * 2.6,
        h.y + 2.0,
        h.z - Math.sin(h.yaw) * ox + Math.cos(h.yaw) * 2.6);
      win.rotation.y = h.yaw;
      scene.add(win);
    }

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 9, 6),
      new THREE.MeshStandardMaterial({ color: 0xc4a35a, roughness: 0.65 })
    );
    pole.position.set(h.x + 4.5, h.y + 4.5, h.z + 2.5);
    scene.add(pole);

    const label = makeLabelSprite(h.label || "B25");
    label.position.set(h.x + 4.5, h.y + 11.5, h.z + 2.5);
    scene.add(label);

    // Lock default camera on featured lot (B25) from Sean's Maps pin
    defaultTarget.set(h.x, h.y + 6, h.z);
    defaultCamPos.set(h.x + 95, h.y + 70, h.z + 110);
    camera.position.copy(defaultCamPos);
    controls.target.copy(defaultTarget);
    controls.minDistance = 40;
    controls.update();
    window.__b25 = { x: h.x, y: h.y, z: h.z };
  }

  return { houseCount: placements.length, houseXY, featuredCount: featured.length };
}

function placeTrees(ctx, houseXY) {
  const { elevs, cols, rows, positions, maxElev } = ctx;
  const rand = mulberry32(0x7EE5);
  const candidates = [];

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
      let nearHouse = false;
      for (let h = 0; h < houseXY.length; h += 2) {
        if (Math.hypot(x - houseXY[h], z - houseXY[h + 1]) < TREE_CLEAR_M) {
          nearHouse = true;
          break;
        }
      }
      if (nearHouse) continue;
      // Prefer mid slopes / forested feel; slight random reject for natural gaps
      const prefer = e > 8 && e < maxElev * 0.7 ? 0.55 : 0.28;
      if (rand() > prefer) continue;
      candidates.push(i);
    }
  }

  // Shuffle-ish subsample to target count
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
  // Sheltered north harbour (OSM harbour node)
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
  defaultTarget.set(p.x, p.y + 6, p.z);
  defaultCamPos.set(p.x + 95, p.y + 70, p.z + 110);
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
    const [elevRes, tex, buildingsRes, lotsRes] = await Promise.all([
      fetch("./elevation.json").then(r => {
        if (!r.ok) throw new Error("elevation.json " + r.status);
        return r.json();
      }),
      loadTexture(),
      fetch("./buildings.json").then(r => (r.ok ? r.json() : { buildings: [] })).catch(() => ({ buildings: [] })),
      fetch("./lots.json").then(r => (r.ok ? r.json() : { lots: [] })).catch(() => ({ lots: [] }))
    ]);
    const ctx = buildTerrain(elevRes, tex);
    const buildings = buildingsRes.buildings || [];
    const lots = lotsRes.lots || [];
    const { houseCount, houseXY, featuredCount } = placeHouses(ctx, buildings, lots);
    const treeCount = placeTrees(ctx, houseXY);
    placeDock(ctx);
    console.info("Hat Island terrain ready", {
      ...{ maxElev: ctx.maxElev, widthM: ctx.widthM, heightM: ctx.heightM, dataset: ctx.dataset },
      houses: houseCount, featured: featuredCount, trees: treeCount
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
