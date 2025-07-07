import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";

// This is the module-level function for loading!
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";

// This is CRITICAL. It imports the side effects for the splat loader and registers it.
import "@babylonjs/loaders/Splat/splatFileLoader";


const canvas = document.getElementById("renderCanvas");
const engine = new Engine(canvas, true);

const createScene = async function () {
    const scene = new Scene(engine);

    const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 10, Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 2;
    camera.upperRadiusLimit = 50;
    camera.wheelDeltaPercentage = 0.01;

    new HemisphericLight("light", new Vector3(0, 1, 0), scene);

    try {
        console.log("Attempting to load Gaussian Splat via SceneLoader...");
        
        // NOTE: We are assuming your .ply file is now in a 'public' folder.
        // Vite serves everything from the 'public' folder at the root URL.
        const result = await SceneLoader.ImportMeshAsync(
            "",         // Import all meshes
            "/",        // Root URL (from the 'public' folder)
            "360_portch_gs2(export).ply", // The actual filename (no URL encoding needed)
            scene
        );

        console.log("Splat loaded successfully!", result);

    } catch (err) {
        console.error("Failed to load Gaussian Splat:", err);
    }

    return scene;
};

const scene = await createScene();

engine.runRenderLoop(() => {
    scene.render();
});

window.addEventListener("resize", () => {
    engine.resize();
});
