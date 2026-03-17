// src/App.js
import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';

// 第一人称控制组件（鼠标拖拽旋转 + 键盘移动 + 滚轮缩放）
function FirstPersonControls({ speed = 0.2, zoomSpeed = 0.5 }) {
  const { camera, gl } = useThree();
  const moveState = useRef({ forward: false, backward: false, left: false, right: false });
  const pitch = useRef(0); // 上下旋转角度
  const yaw = useRef(0);   // 左右旋转角度
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // 初始化相机角度（可选）
  useEffect(() => {
    // 设置初始方向（例如看向正前方）
    yaw.current = 0;
    pitch.current = 0;
    camera.rotation.set(0, 0, 0);
  }, [camera]);

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.code) {
        case 'KeyW': moveState.current.forward = true; break;
        case 'KeyS': moveState.current.backward = true; break;
        case 'KeyA': moveState.current.left = true; break;
        case 'KeyD': moveState.current.right = true; break;
        default: break;
      }
    };
    const handleKeyUp = (e) => {
      switch (e.code) {
        case 'KeyW': moveState.current.forward = false; break;
        case 'KeyS': moveState.current.backward = false; break;
        case 'KeyA': moveState.current.left = false; break;
        case 'KeyD': moveState.current.right = false; break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 鼠标事件：左键拖拽旋转
  useEffect(() => {
    const canvas = gl.domElement;

    const handleMouseDown = (e) => {
      if (e.button === 0) { // 左键
        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
      }
    };

    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      // 灵敏度系数
      const sensitivity = 0.005;
      yaw.current -= dx * sensitivity;
      pitch.current -= dy * sensitivity;
      // 限制俯仰角在 -PI/2 到 PI/2 之间，防止翻转
      pitch.current = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch.current));
      
      // 应用旋转：欧拉角顺序 YXZ（偏航、俯仰、滚转）
      camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ');
      
      lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      canvas.style.cursor = 'default';
    };

    // 滚轮缩放
    const handleWheel = (e) => {
      const delta = Math.sign(e.deltaY) * -zoomSpeed; // 向下滚动缩小（向内移动）
      const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
      camera.position.addScaledVector(direction, delta);
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [camera, gl, zoomSpeed]);

  // 每帧移动相机
  useFrame(() => {
    const direction = new THREE.Vector3();
    // 获取相机当前的前向和右向向量（忽略垂直分量）
    const front = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    front.y = 0;
    right.y = 0;
    front.normalize();
    right.normalize();

    if (moveState.current.forward) direction.add(front);
    if (moveState.current.backward) direction.sub(front);
    if (moveState.current.left) direction.sub(right);
    if (moveState.current.right) direction.add(right);

    if (direction.lengthSq() > 0) {
      direction.normalize().multiplyScalar(speed);
      camera.position.add(direction);
    }
  });

  return null; // 不渲染任何内容
}

// 加载模型并处理信息牌的组件
function CampusModel() {
  const { scene } = useGLTF('/models/your-campus.glb'); // 请替换为你的模型路径

  const [infoPoints, setInfoPoints] = useState([]);

  useEffect(() => {
    if (scene) {
      const points = [];
      scene.traverse((child) => {
        if (child.isObject3D && child.name.startsWith('info_')) {
          // 兼容多种属性读取方式
          const title = child.userData?.title || child.title || '未命名地点';
          points.push({
            position: child.position.clone(),
            title: title,
          });
        }
      });
      setInfoPoints(points);
      console.log('找到信息点:', points);
    }
  }, [scene]);

  return (
    <>
      <primitive object={scene} />
      {infoPoints.map((point, index) => (
        <Html key={index} position={point.position} center distanceFactor={10}>
          <div style={{
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '8px 15px',
            borderRadius: '20px',
            fontSize: '16px',
            border: '2px solid gold',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            transform: 'translateY(-20px)'
          }}>
            {point.title}
          </div>
        </Html>
      ))}
    </>
  );
}

// 主组件
function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Canvas
        camera={{ position: [10, 5, 15], fov: 60 }}
        shadows
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />

        {/* 使用自定义第一人称控制，替代 OrbitControls */}
        <FirstPersonControls speed={0.3} zoomSpeed={0.8} />

        <CampusModel />

        <gridHelper args={[100, 20]} />
      </Canvas>
    </div>
  );
}

export default App;
