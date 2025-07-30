import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import "@babylonjs/loaders";

const EPS = 1e-4;
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function setZoneAlpha(zone, alpha) {
  if (!zone.loaded || !zone.root) return;
  const enable = alpha > 0.001;
  if (zone.root.isEnabled() !== enable) zone.root.setEnabled(enable);
  if (!enable) return;
  const meshes = zone.root.getChildMeshes(false);
  for (const m of meshes) m.visibility = alpha;
}

const canvas = document.getElementById("renderCanvas");
const engine = new Engine(canvas, true);

async function createScene() {
  const scene = new Scene(engine);
  new HemisphericLight("light", new Vector3(0, 1, 0), scene);

  const camera = new UniversalCamera("flycam", new Vector3(0, 2, -10), scene);
  camera.setTarget(Vector3.Zero());
  camera.attachControl(canvas, true);
  camera.keysUp = [87];    // W
  camera.keysDown = [83];  // S
  camera.keysLeft = [65];  // A
  camera.keysRight = [68]; // D
  camera.speed = 0.35;
  camera.inertia = 0.7;
  camera.angularSensibility = 3000;
  camera.minZ = 0.01;
  canvas.addEventListener("click", () => canvas.requestPointerLock?.());

  const splatZones = [
    {
      name: "town_green.ply",
      position: new Vector3(0, 0, 0),
      radius: 5,
      fade: 3,
      root: null,
      loaded: false,
    },
    {
      name: "maxwell_rotunda.splat",
      position: new Vector3(-10, 0.5, -0.7),
      radius: 13,
      fade: 3,
      root: null,
      loaded: false,
    },
  ];

  // Load all splats once and keep in RAM
  await Promise.all(
    splatZones.map(async (zone) => {
      try {
        const result = await SceneLoader.ImportMeshAsync("", "/assets/", zone.name, scene);
        const root = new TransformNode(`${zone.name}-root`, scene);
        for (const mesh of result.meshes) {
          mesh.parent = root;
          mesh.visibility = 0;
        }
        root.position.copyFrom(zone.position);
        root.setEnabled(false);
        zone.root = root;
        zone.loaded = true;
        console.log(`${zone.name} loaded.`);
      } catch (e) {
        console.error(`Failed to load ${zone.name}:`, e);
      }
    })
  );

  scene.onBeforeRenderObservable.add(() => {
    const camPos = camera.position;

    // Find active zone with highest opacity based on distance and radius+fade
    let activeZone = null;
    let activeOpacity = 0;

    for (const zone of splatZones) {
      if (!zone.loaded || !zone.root) continue;
      const dist = Vector3.Distance(camPos, zone.position);
      if (dist <= zone.radius + zone.fade) {
        let opacity = 1;
        if (dist > zone.radius) {
          opacity = 1 - (dist - zone.radius) / zone.fade;
          opacity = clamp01(opacity);
        }
        if (opacity > activeOpacity) {
          activeOpacity = opacity;
          activeZone = zone;
        }
      }
    }

    // Set opacities: active splat fades in, others fade out inversely
    for (const zone of splatZones) {
      if (!zone.loaded || !zone.root) continue;
      if (activeZone === null) {
        // Outside all ranges: full opacity
        setZoneAlpha(zone, 1);
      } else if (zone === activeZone) {
        setZoneAlpha(zone, activeOpacity);
      } else {
        setZoneAlpha(zone, 1 - activeOpacity);
      }
    }
  });

  return scene;
}

createScene().then(scene => {
  engine.runRenderLoop(() => scene.render());
});

window.addEventListener("resize", () => engine.resize());
