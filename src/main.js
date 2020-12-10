import {Vector3,
	Vector2,
	Line3,
	LineBasicMaterial,
	BufferGeometry,
	Line,
	Mesh,
	Euler,
	WebGLRenderer,
	CanvasTexture,
	Scene,
	PerspectiveCamera,
	BoxBufferGeometry,
	MeshNormalMaterial,
	SphereBufferGeometry,
	AmbientLight,
	DataTexture} from "three";
import {XRManager} from "./utils/XRManager.js";
import {BillboardGroup} from "./object/BillboardGroup.js";
import {GUIUtils} from "./utils/GUIUtils.js";
import {Text} from 'troika-three-text'
import {Cursor} from "./object/Cursor.js";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader";
import {AugmentedMaterial} from "./material/AugmentedMaterial.js";
import {World} from "cannon";

/**
 * Physics world used for interaction.
 */
var physics = new World();

/**
 * If true the depth data is shown.
 */
var showDepthDebug = true;

/**
 * Canvas to draw depth information for debug.
 */
var depthCanvas;

/**
 * Depth canvas texture with the calculated depth used to debug.
 */
var depthTexture;

/**
 * Texture with raw depth information packed in 16bit data.
 *
 * Contains depth data in millimeter.
 */
var depthDataTexture;

/**
 * Camera used to view the scene.
 */
var camera = new PerspectiveCamera(60, 1, 0.1, 10);

/**
 * Scene to draw into the screen.
 */
var scene = new Scene();

/**
 * WebGL renderer used to draw the scene.
 */
var renderer;

/**
 * WebXR hit test source, (null until requested).
 */
var hitTestSource = null;
var hitTestSourceRequested = false;

/**
 * List of measurement points.
 */
var measurements = [];

/**
 * Cursor to hit test the scene.
 */
var cursor = null;

/**
 * Line being created currently.
 */
var currentLine = null;

/**
 * Size of the rendererer.
 */
var resolution = new Vector2();
/**
 * Create a line object to draw the measurement in the scene.
 *
 * @param {*} point
 */
function createMeasurement(point)
{
	var geometry = new BufferGeometry().setFromPoints([point, point]);

	return new Line(geometry, new LineBasicMaterial(
	{
		color: 0xffffff,
		linewidth: 5
	}));
}

/**
 * Update measurement line with new position.
 *
 * @param {*} matrix
 */
function updateMeasurement(matrix)
{
	var positions = currentLine.geometry.attributes.position.array;
	positions[3] = matrix.elements[12]
	positions[4] = matrix.elements[13]
	positions[5] = matrix.elements[14]
	currentLine.geometry.attributes.position.needsUpdate = true;
	currentLine.geometry.computeBoundingSphere();
}

/**
 * Create and setup webgl renderer object.
 *
 * @param {*} canvas
 */
function createRenderer(canvas)
{
	var context = canvas.getContext("webgl2", {xrCompatible: true});

	renderer = new WebGLRenderer(
	{
		context: context,
		antialias: true,
		alpha: true,
		canvas: canvas,
		depth: true,
		powerPreference: "high-performance",
		precision: "highp"
	});

	renderer.shadowMap.enabled = false;
	// renderer.extensions.get("WEBGL_depth_texture");

	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.xr.enabled = true;
}

function loadGLTFMesh(url, scene, position, rotation, scale) {

	const loader = new GLTFLoader();
	loader.load(url, function(gltf)
	{
		gltf.scene.traverse(function(child)
		{
			if (child instanceof Mesh)
			{
				child.material = new AugmentedMaterial(child.material.map, depthTexture);
				child.scale.set(scale, scale, scale);
				child.position.copy(position);
				child.rotation.copy(rotation);
				scene.add(child);
			}
		});
	});
}

function initialize()
{
	resolution.set(window.innerWidth, window.innerHeight);

	scene.add(new AmbientLight(0xFFFFFF, 1));

	var container = document.createElement("div");
	container.style.width = "100%";
	container.style.height = "100%";
	document.body.appendChild(container);

	var rulerButton = GUIUtils.createButton("./assets/icon/ruler.svg", 10, 10, 70, 70, function()
	{
		if (cursor.visible)
		{
			// Get cursor position
			var position = new Vector3();
			position.setFromMatrixPosition(cursor.matrix);

			// Add to the measurements list
			measurements.push(position);

			if (measurements.length == 2)
			{
				var distance = Math.round(measurements[0].distanceTo(measurements[1]) * 100);
				var line = new Line3(measurements[0], measurements[1]);

				var group = new BillboardGroup();
				line.getCenter(group.position);
				group.position.y += 0.1;
				scene.add(group);

				var text = new Text();
				text.text = distance + " cm";
				text.fontSize = 0.1
				text.color = 0xFFFFFF;
				text.anchorX = "center";
				text.anchorY = "middle";
				text.rotation.set(Math.PI, Math.PI, Math.PI);
				text.sync();
				group.add(text);

				measurements = [];
				currentLine = null;
			}
			else
			{
				currentLine = createMeasurement(measurements[0]);
				scene.add(currentLine);
			}
		}
	});
	container.appendChild(rulerButton);

	var treeButton = GUIUtils.createButton("./assets/icon/tree.svg", 10, 90, 70, 70, function()
	{
		if (cursor.visible)
		{
			var position = new Vector3();
			position.setFromMatrixPosition(cursor.matrix);

			loadGLTFMesh("./assets/3d/tree/scene.gltf", scene, position, new Euler(0, 0, 0), 0.002);
		}
	});
	container.appendChild(treeButton);

	var flowerButton = GUIUtils.createButton("./assets/icon/flower.svg", 10, 170, 70, 70, function()
	{
		if (cursor.visible)
		{
			var position = new Vector3();
			position.setFromMatrixPosition(cursor.matrix);

			loadGLTFMesh("./assets/3d/flower/scene.gltf", scene, position, new Euler(Math.PI, 0, 0), 0.007);
		}
	});
	container.appendChild(flowerButton);

	var depthButton = GUIUtils.createButton("./assets/icon/3d.svg", 10, 250, 70, 70, function()
	{
		showDepthDebug = !showDepthDebug;
		depthCanvas.style.display = showDepthDebug ? "block" : "none";
	});
	container.appendChild(depthButton);

	depthCanvas = document.createElement("canvas");
	depthCanvas.style.position = "absolute";
	depthCanvas.style.right = "10px";
	depthCanvas.style.bottom = "10px";
	depthCanvas.style.borderRadius = "20px";
	container.appendChild(depthCanvas);

	depthTexture = new CanvasTexture(depthCanvas);

	depthDataTexture = new DataTexture();

	var button = document.createElement("div");
	button.style.position = "absolute";
	button.style.backgroundColor = "#FF6666";
	button.style.width = "100%";
	button.style.height = "20%";
	button.style.borderRadius = "20px";
	button.style.textAlign = "center";
	button.style.fontFamily = "Arial";
	button.style.fontSize = "50px";
	button.innerText = "Enter AR";
	button.onclick = function()
	{
		XRManager.start(renderer,
		{
			optionalFeatures: ["dom-overlay"],
			domOverlay: {root: container},
			requiredFeatures: ["hit-test", "depth-sensing"]
		});
	};
	document.body.appendChild(button);

	var canvas = document.createElement("canvas");
	document.body.appendChild(canvas);
	createRenderer(canvas);

	var box = new Mesh(new BoxBufferGeometry(), new MeshNormalMaterial());
	box.scale.set(0.1, 0.1, 0.1);
	box.position.x = 2;
	scene.add(box);

	var sphere = new Mesh(new SphereBufferGeometry(), new MeshNormalMaterial());
	sphere.scale.set(0.1, 0.1, 0.1);
	sphere.position.z = 2;
	scene.add(sphere);

	// Cursor to select objects
	cursor = new Cursor();
	scene.add(cursor);

	window.addEventListener("resize", resize, false);

	renderer.setAnimationLoop(render);
}

/**
 * Resize the canvas and renderer size.
 */
function resize()
{
	resolution.set(window.innerWidth, window.innerHeight);

	camera.aspect = resolution.x / resolution.y;
	camera.updateProjectionMatrix();

	renderer.setSize(resolution.x, resolution.y);
	renderer.setPixelRatio(window.devicePixelRatio);
}

/**
 * Update logic and render scene into the screen.
 *
 * @param {*} time
 * @param {*} frame
 */
function render(time, frame)
{
	if (!frame)
	{
		return;
	}
	world.step(time);


	scene.traverse(function(child)
	{
		if(child.isMesh && child.material && child.material instanceof AugmentedMaterial)
		{
			child.material.uniforms.uWidth.value = Math.floor(window.devicePixelRatio * window.innerWidth);
			child.material.uniforms.uHeight.value = Math.floor(window.devicePixelRatio * window.innerHeight);
			child.material.uniforms.uNear.value = camera.near;
			child.material.uniforms.uFar.value = camera.far;

			child.material.uniformsNeedUpdate = true;
		}
	});

	var referenceSpace = renderer.xr.getReferenceSpace();
	var session = renderer.xr.getSession();

	// Request hit test source
	if (!hitTestSourceRequested)
	{
		session.requestReferenceSpace("viewer").then(function(referenceSpace)
		{
			session.requestHitTestSource(
			{
				space: referenceSpace
			}).then(function(source)
			{
				hitTestSource = source;
			});
		});

		session.addEventListener("end", function()
		{
			hitTestSourceRequested = false;
			hitTestSource = null;
		});

		hitTestSourceRequested = true;
	}

	// Process Hit test
	if (hitTestSource)
	{
		var hitTestResults = frame.getHitTestResults(hitTestSource);
		if (hitTestResults.length)
		{
			var hit = hitTestResults[0];
			cursor.visible = true;
			cursor.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
		}
		else
		{
			cursor.visible = false;
		}

		if (currentLine)
		{
			updateMeasurement(cursor.matrix);
		}
	}

	// Handle depth
	var pose = frame.getViewerPose(referenceSpace);
	if (pose)
	{
		for(var view of pose.views)
		{
			var depthData = frame.getDepthInformation(view);
			if(depthData)
			{
				drawDepthCanvas(depthData, depthCanvas, camera.near, camera.far);
			}
		}
	}

	renderer.render(scene, camera);
}

/**
 * Draw depth data to a canvas, also sets the size of the canvas.
 *
 * @param {*} depth
 * @param {*} canvas
 */
function drawDepthCanvas(depth, canvas, near, far)
{
	canvas.width = depth.height;
	canvas.height = depth.width;

	canvas.style.width = (2 * canvas.width) + "px";
	canvas.style.height = (2 * canvas.height) + "px";

	var context = canvas.getContext("2d");
	var image = context.getImageData(0, 0, canvas.width, canvas.height);

	for(var x = 0; x < depth.width; x++)
	{
		for(var y = 0; y < depth.height; y++)
		{
			var distance = (depth.getDepth(x, y) - near) / (far - near);
			var j = (x * canvas.width + (canvas.width - y)) * 4;

			if (distance > 1.0) {distance = 1.0;}
			else if (distance < 0.0) {distance = 0.0;}

			image.data[j] = Math.ceil(distance * 256);
			image.data[j + 1] = Math.ceil(distance * 256);
			image.data[j + 2] = Math.ceil(distance * 256);
			image.data[j + 3] = 255;
		}
	}

	depthTexture.needsUpdate = true;
	context.putImageData(image, 0, 0);
}

initialize();
