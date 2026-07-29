"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * The little 3D scene that sits at the bottom of the topics page.
 *
 * A chicken runs laps on a slowly spinning pizza and hops over the Katchup
 * bottle, which rides around on the pizza with it. Everything is built out of
 * plain geometry here, so the page pays for no model download.
 *
 * It is decoration only: it pauses when scrolled out of view, and a visitor who
 * asked for less motion gets a single still frame instead of the loop.
 */

const PIZZA_RADIUS = 3;
const PIZZA_TOP = 0.32;
// The bottle and the chicken share a lap line, so the hop lands on the bottle.
const LAP_RADIUS = 1.9;
const PIZZA_SPIN = 0.32;
const CHICKEN_SPIN = 1.15;
// How much of the lap, in radians either side of the bottle, the hop covers.
const HOP_WINDOW = 0.62;
// Tall enough that the feet clear the bottle's cap at the top of the arc.
const HOP_HEIGHT = 1.5;

function material(color: number, roughness = 0.65) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
}

function buildPizza() {
  const group = new THREE.Group();

  const dough = material(0xe8b268, 0.85);
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(PIZZA_RADIUS, PIZZA_RADIUS * 0.94, 0.3, 64),
    dough,
  );
  base.position.y = 0.15;
  base.receiveShadow = true;
  base.castShadow = true;
  group.add(base);

  const crust = new THREE.Mesh(
    new THREE.TorusGeometry(PIZZA_RADIUS - 0.16, 0.24, 16, 64),
    material(0xdca055, 0.9),
  );
  crust.rotation.x = Math.PI / 2;
  crust.position.y = PIZZA_TOP - 0.06;
  crust.castShadow = true;
  crust.receiveShadow = true;
  group.add(crust);

  const sauce = new THREE.Mesh(
    new THREE.CylinderGeometry(PIZZA_RADIUS - 0.3, PIZZA_RADIUS - 0.3, 0.06, 64),
    material(0xd8422c, 0.75),
  );
  sauce.position.y = PIZZA_TOP - 0.02;
  sauce.receiveShadow = true;
  group.add(sauce);

  const cheese = new THREE.Mesh(
    new THREE.CylinderGeometry(PIZZA_RADIUS - 0.42, PIZZA_RADIUS - 0.42, 0.05, 64),
    material(0xf7cf62, 0.6),
  );
  cheese.position.y = PIZZA_TOP;
  cheese.receiveShadow = true;
  group.add(cheese);

  // Fixed spots rather than random ones, so every visit looks the same.
  const pepperoniGeometry = new THREE.CylinderGeometry(0.26, 0.26, 0.07, 20);
  const pepperoniMaterial = material(0xc0392b, 0.55);
  const spots: Array<[number, number]> = [
    [0.5, 2.4],
    [1.4, 1.2],
    [2.2, 2.3],
    [3.1, 0.9],
    [3.9, 2.5],
    [4.7, 1.4],
    [5.5, 2.4],
    [6.0, 0.8],
  ];
  for (const [angle, radius] of spots) {
    const slice = new THREE.Mesh(pepperoniGeometry, pepperoniMaterial);
    slice.position.set(
      Math.cos(angle) * radius,
      PIZZA_TOP + 0.04,
      Math.sin(angle) * radius,
    );
    slice.castShadow = true;
    slice.receiveShadow = true;
    group.add(slice);
  }

  const basilGeometry = new THREE.SphereGeometry(0.16, 12, 10);
  const basilMaterial = material(0x4c9a52, 0.7);
  const leaves: Array<[number, number]> = [
    [0.9, 2.0],
    [2.7, 1.6],
    [4.3, 2.1],
    [5.2, 1.0],
  ];
  for (const [angle, radius] of leaves) {
    const leaf = new THREE.Mesh(basilGeometry, basilMaterial);
    leaf.position.set(
      Math.cos(angle) * radius,
      PIZZA_TOP + 0.04,
      Math.sin(angle) * radius,
    );
    leaf.scale.set(1.3, 0.4, 0.8);
    leaf.rotation.y = angle;
    leaf.castShadow = true;
    group.add(leaf);
  }

  return group;
}

function buildKetchup() {
  const group = new THREE.Group();
  const red = material(0xe03131, 0.4);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.7, 32), red);
  body.position.y = 0.35;
  body.castShadow = true;
  group.add(body);

  const shoulder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.34, 0.3, 32),
    red,
  );
  shoulder.position.y = 0.85;
  shoulder.castShadow = true;
  group.add(shoulder);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.16, 24), red);
  neck.position.y = 1.06;
  neck.castShadow = true;
  group.add(neck);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.18, 24),
    material(0xf8fafc, 0.5),
  );
  cap.position.y = 1.22;
  cap.castShadow = true;
  group.add(cap);

  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.355, 0.365, 0.34, 32, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      roughness: 0.8,
      side: THREE.DoubleSide,
    }),
  );
  label.position.y = 0.36;
  group.add(label);

  // A face on the front, so it reads as the mascot and not just a bottle.
  const eyeWhite = material(0xffffff, 0.3);
  const pupil = material(0x1e293b, 0.3);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 14), eyeWhite);
    eye.position.set(side * 0.13, 0.7, 0.29);
    eye.scale.z = 0.55;
    group.add(eye);

    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), pupil);
    dot.position.set(side * 0.14, 0.7, 0.33);
    dot.scale.z = 0.5;
    group.add(dot);
  }

  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.028, 10, 24, Math.PI),
    material(0x7f1d1d, 0.5),
  );
  smile.position.set(0, 0.58, 0.3);
  smile.rotation.z = Math.PI;
  group.add(smile);

  return group;
}

function buildChicken() {
  const group = new THREE.Group();
  const feathers = material(0xfff8ec, 0.75);
  const beakColor = material(0xf59f0a, 0.5);
  const combColor = material(0xe11d48, 0.5);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 20), feathers);
  body.position.y = 0.42;
  body.scale.set(1, 0.92, 1.15);
  body.castShadow = true;
  group.add(body);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 12), feathers);
  tail.position.set(0, 0.55, -0.34);
  tail.rotation.x = -Math.PI / 2.6;
  tail.castShadow = true;
  group.add(tail);

  const head = new THREE.Group();
  head.position.set(0, 0.74, 0.14);
  group.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 20), feathers);
  skull.castShadow = true;
  head.add(skull);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 12), beakColor);
  beak.position.set(0, -0.02, 0.24);
  beak.rotation.x = Math.PI / 2;
  head.add(beak);

  const wattle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), combColor);
  wattle.position.set(0, -0.14, 0.17);
  head.add(wattle);

  for (const [x, y, scale] of [
    [0, 0.22, 1],
    [-0.09, 0.19, 0.75],
    [0.09, 0.19, 0.75],
  ] as const) {
    const comb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), combColor);
    comb.position.set(x, y, 0.02);
    comb.scale.setScalar(scale);
    head.add(comb);
  }

  const eyeMaterial = material(0x1e293b, 0.3);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), eyeMaterial);
    eye.position.set(side * 0.12, 0.05, 0.19);
    head.add(eye);
  }

  const wings: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), feathers);
    wing.position.set(side * 0.3, 0.46, 0.02);
    wing.scale.set(0.4, 0.9, 1.1);
    wing.castShadow = true;
    group.add(wing);
    wings.push(wing);
  }

  const legs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.12, 0.24, 0);
    group.add(leg);

    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.26, 10),
      beakColor,
    );
    shin.position.y = -0.13;
    shin.castShadow = true;
    leg.add(shin);

    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), beakColor);
    foot.position.set(0, -0.25, 0.04);
    foot.scale.set(1, 0.4, 1.5);
    foot.castShadow = true;
    leg.add(foot);

    legs.push(leg);
  }

  return { group, head, wings, legs, body };
}

export default function PizzaChickenScene() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
    } catch {
      // No WebGL on this device: the page simply goes without the decoration.
      return undefined;
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "pan-y";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(4, 7, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 20;
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.bias = -0.0015;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xffd9c0, 0.5);
    fill.position.set(-5, 3, -3);
    scene.add(fill);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8b8a0, 1.1));

    const world = new THREE.Group();
    scene.add(world);

    world.add(buildPizza());

    const ketchup = buildKetchup();
    ketchup.scale.setScalar(0.85);
    ketchup.position.set(LAP_RADIUS, PIZZA_TOP, 0);
    // Faces the middle of the pizza, so the hop goes past its front.
    ketchup.rotation.y = -Math.PI / 2;
    world.add(ketchup);

    const chicken = buildChicken();
    scene.add(chicken.group);

    // The camera can be swung around by dragging, but it keeps drifting on its
    // own the moment the pointer lets go.
    let cameraAngle = 0;
    let cameraDistance = 7.2;
    let dragging = false;
    let lastPointerX = 0;

    const handlePointerDown = (event: PointerEvent) => {
      dragging = true;
      lastPointerX = event.clientX;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (!dragging) {
        return;
      }
      cameraAngle -= (event.clientX - lastPointerX) * 0.006;
      lastPointerX = event.clientX;
    };
    const handlePointerUp = (event: PointerEvent) => {
      dragging = false;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    };

    if (!reducedMotion) {
      renderer.domElement.addEventListener("pointerdown", handlePointerDown);
      renderer.domElement.addEventListener("pointermove", handlePointerMove);
      renderer.domElement.addEventListener("pointerup", handlePointerUp);
      renderer.domElement.addEventListener("pointercancel", handlePointerUp);
      renderer.domElement.style.cursor = "grab";
    }

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (width === 0 || height === 0) {
        return;
      }
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      // Close enough that the pizza fills a wide strip, but backing off on a
      // narrow phone until the whole pizza fits across the frame again.
      cameraDistance = Math.max(6.4, 9.8 / camera.aspect);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const draw = (time: number) => {
      const pizzaAngle = time * PIZZA_SPIN;
      const chickenAngle = time * CHICKEN_SPIN;

      world.rotation.y = pizzaAngle;

      // Where the chicken is on the lap relative to the bottle, wrapped into
      // (-pi, pi] so the hop can be timed off how close the two are. A spin of
      // +y carries the bottle the other way round the lap from the chicken,
      // hence the plus: the two close on each other.
      let gap = chickenAngle + pizzaAngle;
      gap = Math.atan2(Math.sin(gap), Math.cos(gap));

      const inHop = Math.abs(gap) < HOP_WINDOW;
      const hop = inHop ? Math.cos((gap / HOP_WINDOW) * (Math.PI / 2)) : 0;
      const height = hop * hop * HOP_HEIGHT;

      chicken.group.position.set(
        Math.cos(chickenAngle) * LAP_RADIUS,
        PIZZA_TOP + height,
        Math.sin(chickenAngle) * LAP_RADIUS,
      );
      chicken.group.rotation.y = -chickenAngle;
      // A lean into the jump, and a small squash on the landing steps.
      chicken.group.rotation.x = -hop * 0.35;
      chicken.body.scale.y = 0.92 - Math.abs(Math.sin(time * 9)) * 0.05;

      const stride = Math.sin(time * 9);
      chicken.legs[0].rotation.x = inHop ? -0.9 - hop * 0.5 : stride * 0.9;
      chicken.legs[1].rotation.x = inHop ? -0.6 - hop * 0.5 : -stride * 0.9;

      const flap = inHop ? 1 : 0.25;
      chicken.wings[0].rotation.z = -Math.sin(time * 14) * flap - 0.15;
      chicken.wings[1].rotation.z = Math.sin(time * 14) * flap + 0.15;

      chicken.head.rotation.x = Math.sin(time * 9) * 0.08 - hop * 0.2;
      chicken.head.position.z = 0.14 + Math.sin(time * 9) * 0.03;

      if (!dragging) {
        cameraAngle += 0.0012;
      }
      camera.position.set(
        Math.sin(cameraAngle) * cameraDistance,
        cameraDistance * 0.54,
        Math.cos(cameraAngle) * cameraDistance,
      );
      camera.lookAt(0, 0.7, 0);

      renderer.render(scene, camera);
    };

    let frame = 0;
    let running = false;
    let clockStart = 0;
    let elapsed = 0;

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      elapsed = (now - clockStart) / 1000;
      draw(elapsed);
    };

    const start = () => {
      if (running || reducedMotion) {
        return;
      }
      running = true;
      // Picks up where it left off, so scrolling away and back is seamless.
      clockStart = performance.now() - elapsed * 1000;
      frame = requestAnimationFrame(loop);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    if (reducedMotion) {
      // A single still frame, posed mid-hop over the bottle.
      draw(0);
    }

    // Off-screen the loop is pure waste, and this block lives at the very
    // bottom of a page most visitors never scroll to.
    const visibility = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !document.hidden) {
          start();
        } else {
          stop();
        }
      },
      { threshold: 0.01 },
    );
    visibility.observe(host);

    const handleDocumentVisibility = () => {
      if (document.hidden) {
        stop();
      }
    };
    document.addEventListener("visibilitychange", handleDocumentVisibility);

    return () => {
      stop();
      visibility.disconnect();
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleDocumentVisibility);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointercancel", handlePointerUp);

      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const used = Array.isArray(object.material)
            ? object.material
            : [object.material];
          for (const item of used) {
            item.dispose();
          }
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className="h-70 w-full select-none sm:h-95"
    />
  );
}
