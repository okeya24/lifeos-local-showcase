import { Html, Line, MeshDistortMaterial, OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Mesh, PerspectiveCamera } from "three";
import type { Domain, DomainId } from "../types";

interface UniverseSceneProps {
  domains: Domain[];
  selected: DomainId;
  paused: boolean;
  onSelect: (domain: DomainId) => void;
}

function ResponsiveCamera() {
  const { camera, size } = useThree();
  const lastMode = useRef("");

  useEffect(() => {
    const perspective = camera as PerspectiveCamera;
    const mode = size.width < 620 ? "compact" : "wide";
    if (mode === lastMode.current) return;
    lastMode.current = mode;
    perspective.fov = mode === "compact" ? 50 : 42;
    perspective.position.z = mode === "compact" ? 15.2 : 10.1;
    perspective.updateProjectionMatrix();
  }, [camera, size.width]);

  return null;
}

function LifeCore({ selected }: { selected: DomainId }) {
  const mesh = useRef<Mesh>(null);
  const wire = useRef<Mesh>(null);
  const accent = "#8b72ff";

  useFrame((state, delta) => {
    if (mesh.current) {
      mesh.current.rotation.y += delta * 0.12;
      mesh.current.rotation.x += delta * 0.025;
    }
    if (wire.current) {
      wire.current.rotation.y -= delta * 0.055;
      wire.current.rotation.z += delta * 0.018;
    }
  });

  return (
    <group>
      <pointLight color={accent} intensity={60} distance={12} />
      <pointLight color="#56ead5" intensity={22} position={[4, -2, 5]} distance={12} />
      <mesh ref={mesh} castShadow>
        <icosahedronGeometry args={[1.08, 5]} />
        <MeshDistortMaterial
          color={accent}
          emissive="#3c1d8f"
          emissiveIntensity={1.35}
          distort={selected === "future" ? 0.2 : 0.1}
          speed={1.1}
          roughness={0.24}
          metalness={0.08}
        />
      </mesh>
      <mesh ref={wire} scale={1.14}>
        <icosahedronGeometry args={[1.08, 3]} />
        <meshBasicMaterial color="#b7adff" wireframe transparent opacity={0.11} />
      </mesh>
      <mesh rotation={[1.17, 0.12, -0.38]}>
        <torusGeometry args={[1.92, 0.008, 12, 180]} />
        <meshBasicMaterial color={accent} transparent opacity={0.38} />
      </mesh>
      <mesh rotation={[1.32, -0.22, 0.34]}>
        <torusGeometry args={[2.40, 0.007, 12, 180]} />
        <meshBasicMaterial color="#56ead5" transparent opacity={0.22} />
      </mesh>
      <mesh rotation={[1.01, 0.42, 0.72]}>
        <torusGeometry args={[2.92, 0.006, 12, 180]} />
        <meshBasicMaterial color="#ff78b3" transparent opacity={0.15} />
      </mesh>
      <pointLight color={accent} intensity={24} distance={9} />
    </group>
  );
}

function DomainNode({
  domain,
  selected,
  onSelect
}: {
  domain: Domain;
  selected: boolean;
  onSelect: () => void;
}) {
  const mesh = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state, delta) => {
    if (!mesh.current) return;
    const target = selected ? 1.35 : hovered ? 1.18 : 1;
    const current = mesh.current.scale.x;
    mesh.current.scale.setScalar(current + (target - current) * Math.min(delta * 8, 1));
    mesh.current.position.y += Math.sin(state.clock.elapsedTime * 0.55 + domain.position[0]) * 0.0008;
  });

  return (
    <group position={domain.position}>
      <mesh
        ref={mesh}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        onPointerEnter={(event) => {
          event.stopPropagation();
          document.body.style.cursor = "pointer";
          setHovered(true);
        }}
        onPointerLeave={() => {
          document.body.style.cursor = "";
          setHovered(false);
        }}
      >
        <sphereGeometry args={[domain.id === "future" ? 0.17 : 0.22, 32, 32]} />
        <meshStandardMaterial
          color={domain.color}
          emissive={domain.color}
          emissiveIntensity={selected ? 2.2 : hovered ? 1.8 : 1.2}
          roughness={0.2}
          metalness={0.08}
        />
      </mesh>
      <mesh scale={selected ? 2.9 : hovered ? 2.5 : 2.1}>
        <sphereGeometry args={[domain.id === "future" ? 0.17 : 0.22, 24, 24]} />
        <meshBasicMaterial color={domain.color} transparent opacity={selected ? 0.09 : 0.045} />
      </mesh>
      <Html center distanceFactor={8} zIndexRange={[20, 0]}>
        <button
          className={`universe-node-label ${selected ? "is-selected" : ""}`}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          style={{ "--node-color": domain.color } as CSSProperties}
        >
          <strong>{domain.label}</strong>
          <span>{domain.value}</span>
        </button>
      </Html>
    </group>
  );
}

export function UniverseScene({ domains, selected, paused, onSelect }: UniverseSceneProps) {
  return (
    <div className="universe-scene" aria-label="可旋转的三维人生宇宙">
      <Canvas
        camera={{ position: [0, 0.3, 10.1], fov: 42 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <ResponsiveCamera />
        <ambientLight intensity={1.2} color="#8b83d8" />
        <Stars radius={70} depth={38} count={1700} factor={2.4} saturation={0.25} fade speed={0.18} />
        <LifeCore selected={selected} />
        {domains.map((domain) => (
          <group key={domain.id}>
            <Line
              points={[[0, 0, 0], domain.position]}
              color={domain.color}
              lineWidth={0.65}
              transparent
              opacity={domain.id === selected ? 0.42 : 0.14}
            />
            <DomainNode
              domain={domain}
              selected={domain.id === selected}
              onSelect={() => onSelect(domain.id)}
            />
          </group>
        ))}
        <OrbitControls
          makeDefault
          enablePan={false}
          enableDamping
          dampingFactor={0.06}
          minDistance={7}
          maxDistance={18}
          autoRotate={!paused}
          autoRotateSpeed={0.25}
        />
      </Canvas>
      <div className="universe-scene-hud" aria-hidden="true">
        <span>拖拽旋转</span>
        <span>滚轮缩放</span>
        <span>点击星球</span>
      </div>
    </div>
  );
}
