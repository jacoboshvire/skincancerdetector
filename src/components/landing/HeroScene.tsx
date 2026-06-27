"use client";

import { useRef } from "react";
import { Canvas, useFrame, type RootState } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import type { Mesh } from "three";

function GlassBlob() {
  const meshRef = useRef<Mesh>(null);

  useFrame((state: RootState) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.rotation.x += 0.0015;
    mesh.rotation.y += 0.002;
    const targetX = state.pointer.y * 0.25;
    const targetY = state.pointer.x * 0.25;
    mesh.rotation.x += (targetX - mesh.rotation.x) * 0.02;
    mesh.rotation.y += (targetY - mesh.rotation.y) * 0.02;
  });

  return (
    <Float speed={1.6} rotationIntensity={0.5} floatIntensity={1.4}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1, 8]} />
        <MeshDistortMaterial
          attach="material"
          color="#c4b5fd"
          distort={0.45}
          speed={1.8}
          roughness={0.1}
          metalness={0.1}
          clearcoat={1}
          clearcoatRoughness={0.1}
          ior={1.4}
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </mesh>
    </Float>
  );
}

export default function HeroScene() {
  return (
    <Canvas
      className="!absolute !inset-0"
      camera={{ position: [0, 0, 4.2], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
      aria-hidden
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 3, 4]} intensity={1.6} color="#2563eb" />
      <directionalLight position={[-3, -2, -3]} intensity={1} color="#db2777" />
      <GlassBlob />
    </Canvas>
  );
}
