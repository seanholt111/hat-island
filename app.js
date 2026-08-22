import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvas = document.getElementById("c");
const loaderEl = document.getElementById("loader");
const hintEl = document.getElementById("hint");
const attribEl = document.getElementById("attrib");

const VERT_EXAG = 3.0;
const WATER_Y = -0.4;

const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, alpha: false, powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

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

scene.add(new THREE.AmbientLight(0xb8d4e8, 0.55));
const sun = new THREE.DirectionalLight(0xfff2dd, 1.35);
sun.position.set(800, 1200, 400);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x7eb6d9, 0.35);
fill.position.set(-600, 400, -300);
scene.add(fill);
scene.add(new THREE.HemisphereLight(0xc8e4f8, 0x1a3040, 0.35));

let defaultCamPos = new THREE.Vector3(900, 720, 1100);
let defaultTarget = new THREE.Vector3(0, 40, 0);

function metersPerDeg(latDeg) {
  const lat = latDeg * Math.PI / 180;
  const mLat = 111132.92 - 559.82 * Math.cos(2 * lat) + 1.175 * Math.cos(4 * lat);
  const mLng = 111412.84 * Math.cos(lat) - 93.5 * Math.cos(3 * lat);
  return { mLat, mLng };
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
  return { maxElev, widthM, heightM, dataset };
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

document.getElementById("btnReset").addEventListener("click", resetView);
document.getElementById("btnZoomIn").addEventListener("click", () => zoomBy(0.82));
document.getElementById("btnZoomOut").addEventListener("click", () => zoomBy(1.22));

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

async function main() {
  try {
    const [elevRes, tex] = await Promise.all([
      fetch("./elevation.json").then(r => {
        if (!r.ok) throw new Error("elevation.json " + r.status);
        return r.json();
      }),
      new THREE.TextureLoader().loadAsync("./terrain-sat.jpg")
    ]);
    const info = buildTerrain(elevRes, tex);
    console.info("Hat Island terrain ready", info);
    loaderEl.classList.add("hidden");
    setTimeout(() => loaderEl.remove(), 500);
    animate();
  } catch (err) {
    console.error(err);
    loaderEl.innerHTML = "<p style=\"color:#ffb4b4;padding:1rem;text-align:center\">Failed to load terrain.<br>" + String(err.message || err) + "</p>";
  }
}
main();
